using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Common;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing.Ai;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class DeterministicTranslationService(
    ApiConfiguration apiConfiguration,
    IUnifiedAiGateway aiGateway,
    ILogger<DeterministicTranslationService> logger)
    : ITextTranslationService
{
    public async Task<RecipeTranslationResult> TranslateRecipeAsync(RecipeTranslationInput input, CancellationToken cancellationToken)
    {
        if (string.Equals(input.SourceLanguage, input.TargetLanguage, StringComparison.OrdinalIgnoreCase))
        {
            return new RecipeTranslationResult(
                input.RecipeName,
                input.Tips,
                input.NutritionistTips,
                input.Ingredients,
                input.Steps,
                input.TargetLanguage,
                false);
        }

        try
        {
            var systemPrompt = BuildRecipeTranslationPrompt(input.TargetLanguage);
            var userPayload = JsonSerializer.Serialize(new
            {
                recipeName = input.RecipeName,
                tips = input.Tips,
                nutritionistTips = input.NutritionistTips,
                ingredients = input.Ingredients,
                steps = input.Steps
            });

            var chain = apiConfiguration.Ai.FallbackChains.Translation;
            var aiJson = await aiGateway.GenerateTextAsync(
                chainConfig: chain,
                prompt: userPayload,
                systemPrompt: systemPrompt,
                jsonMode: true,
                temperature: 0.2f,
                usageContext: new AiUsageContext(AiUsageOperation.TranslationText, userPayload.Length),
                cancellationToken: cancellationToken);

            if (!string.IsNullOrWhiteSpace(aiJson))
            {
                var parsed = ParseRecipeTranslationResponse(aiJson, input.TargetLanguage);
                if (parsed is not null)
                {
                    logger.LogInformation("[Translation] Successfully live-translated recipe '{Name}' to {Lang} via AI.", input.RecipeName, input.TargetLanguage);
                    return parsed;
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Translation] Live AI translation failed for recipe '{Name}'. Returning original.", input.RecipeName);
        }

        return new RecipeTranslationResult(
            input.RecipeName,
            input.Tips,
            input.NutritionistTips,
            input.Ingredients,
            input.Steps,
            input.TargetLanguage,
            false);
    }

    public async Task<string> TranslateTextAsync(string text, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(text) || string.Equals(sourceLanguage, targetLanguage, StringComparison.OrdinalIgnoreCase))
        {
            return text;
        }

        try
        {
            var systemPrompt = $"You are an expert culinary translator. Translate the given text accurately and naturally into {(targetLanguage.Equals("es", StringComparison.OrdinalIgnoreCase) ? "Spanish" : "English")}. Return only the direct translation with no explanations or commentary.";
            var chain = apiConfiguration.Ai.FallbackChains.Translation;
            var aiText = await aiGateway.GenerateTextAsync(
                chainConfig: chain,
                prompt: text,
                systemPrompt: systemPrompt,
                jsonMode: false,
                temperature: 0.2f,
                usageContext: new AiUsageContext(AiUsageOperation.TranslationText, text.Length),
                cancellationToken: cancellationToken);

            if (!string.IsNullOrWhiteSpace(aiText))
            {
                return aiText.Trim();
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Translation] Live AI text translation failed.");
        }

        return text;
    }

    public async Task<string> TranslatePlanJsonAsync(string planJson, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(planJson) || string.Equals(sourceLanguage, targetLanguage, StringComparison.OrdinalIgnoreCase))
        {
            return planJson;
        }

        try
        {
            var rootNode = JsonNode.Parse(planJson);
            if (rootNode is null) return planJson;

            var itemsToTranslate = ExtractTranslatableItems(rootNode);
            if (itemsToTranslate.Count == 0) return planJson;

            var prompt = JsonSerializer.Serialize(itemsToTranslate);
            var systemPrompt = BuildCompactPlanTranslationPrompt(targetLanguage);
            var chain = apiConfiguration.Ai.FallbackChains.Translation;

            var aiJson = await aiGateway.GenerateTextAsync(
                chainConfig: chain,
                prompt: prompt,
                systemPrompt: systemPrompt,
                jsonMode: true,
                temperature: 0.2f,
                usageContext: new AiUsageContext(AiUsageOperation.PlanTranslation, prompt.Length),
                cancellationToken: cancellationToken);

            if (!string.IsNullOrWhiteSpace(aiJson))
            {
                var translatedItems = ParsePlanTranslationItems(aiJson, logger);

                if (translatedItems is not null && translatedItems.Count > 0)
                {
                    var recombined = RecombinePlanJson(rootNode, translatedItems);
                    logger.LogInformation("[Translation] Successfully translated meal plan to {Lang} via lean text extraction (items: {Count}).", targetLanguage, translatedItems.Count);
                    return recombined;
                }

                logger.LogWarning("[Translation] Parsed 0 translated items from AI plan translation response: {Raw}", aiJson);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Translation] Lean AI translation failed for full meal plan.");
        }

        return planJson;
    }

    private sealed class TranslatableMealItem
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Tag { get; set; } = string.Empty;
        public string Tips { get; set; } = string.Empty;
        public string? NutritionistTips { get; set; }
        public Dictionary<string, List<TranslatableIngredient>> Ingredients { get; set; } = [];
        public Dictionary<string, List<string>> Steps { get; set; } = [];
    }

    private sealed class TranslatableIngredient
    {
        public string Name { get; set; } = string.Empty;
        public string? Unit { get; set; }
    }

    private static List<TranslatableMealItem> ExtractTranslatableItems(JsonNode rootNode)
    {
        var items = new List<TranslatableMealItem>();
        if (rootNode["days"] is not JsonObject daysObj)
        {
            return items;
        }

        string[] days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        string[] meals = ["breakfast", "lunch", "snack", "dinner"];

        foreach (var day in days)
        {
            if (daysObj[day] is not JsonObject dayObj) continue;

            foreach (var meal in meals)
            {
                if (dayObj[meal] is not JsonObject mealObj) continue;

                var id = $"{day}_{meal}";
                var name = mealObj["recipeName"]?.ToString() ?? string.Empty;
                var tag = mealObj["tag"]?.ToString() ?? string.Empty;
                var tips = mealObj["tips"]?.ToString() ?? string.Empty;
                var nutritionistTips = mealObj["nutritionistTips"]?.ToString();

                var ingredientsMap = ExtractIngredientsMap(mealObj["ingredients"]);
                var stepsMap = ExtractStepsMap(mealObj["steps"] ?? mealObj["instructions"]);

                if (!string.IsNullOrWhiteSpace(name))
                {
                    items.Add(new TranslatableMealItem
                    {
                        Id = id,
                        Name = name,
                        Tag = tag,
                        Tips = tips,
                        NutritionistTips = nutritionistTips,
                        Ingredients = ingredientsMap,
                        Steps = stepsMap
                    });
                }
            }
        }

        return items;
    }

    private static Dictionary<string, List<TranslatableIngredient>> ExtractIngredientsMap(JsonNode? ingredientsNode)
    {
        var map = new Dictionary<string, List<TranslatableIngredient>>();
        if (ingredientsNode is JsonObject ingObj)
        {
            foreach (var kvp in ingObj)
            {
                if (kvp.Value is JsonArray array)
                {
                    var list = ExtractIngredientList(array);
                    if (list.Count > 0) map[kvp.Key] = list;
                }
            }
        }
        else if (ingredientsNode is JsonArray ingArray)
        {
            var list = ExtractIngredientList(ingArray);
            if (list.Count > 0) map["general"] = list;
        }
        return map;
    }

    private static List<TranslatableIngredient> ExtractIngredientList(JsonArray array)
    {
        var list = new List<TranslatableIngredient>();
        foreach (var item in array)
        {
            if (item is JsonObject obj)
            {
                var name = obj["name"]?.ToString() ?? string.Empty;
                var unit = obj["unit"]?.ToString();
                if (!string.IsNullOrWhiteSpace(name))
                {
                    list.Add(new TranslatableIngredient { Name = name, Unit = unit });
                }
            }
            else if (item is not null)
            {
                list.Add(new TranslatableIngredient { Name = item.ToString() });
            }
        }
        return list;
    }

    private static Dictionary<string, List<string>> ExtractStepsMap(JsonNode? stepsNode)
    {
        var map = new Dictionary<string, List<string>>();
        if (stepsNode is JsonObject stepsObj)
        {
            foreach (var kvp in stepsObj)
            {
                if (kvp.Value is JsonArray array)
                {
                    var list = ExtractStepList(array);
                    if (list.Count > 0) map[kvp.Key] = list;
                }
            }
        }
        else if (stepsNode is JsonArray stepsArray)
        {
            var list = ExtractStepList(stepsArray);
            if (list.Count > 0) map["general"] = list;
        }
        return map;
    }

    private static List<string> ExtractStepList(JsonArray array)
    {
        var list = new List<string>();
        foreach (var item in array)
        {
            if (item is JsonObject obj && obj["text"] is not null)
            {
                list.Add(obj["text"]!.ToString());
            }
            else if (item is not null)
            {
                list.Add(item.ToString());
            }
        }
        return list;
    }

    private static string RecombinePlanJson(JsonNode rootNode, List<TranslatableMealItem> translatedItems)
    {
        var lookup = new Dictionary<string, TranslatableMealItem>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in translatedItems)
        {
            if (string.IsNullOrWhiteSpace(item.Id)) continue;
            var normalizedKey = item.Id.Replace("-", "_").Replace(" ", "").ToLowerInvariant();
            lookup[normalizedKey] = item;
            lookup[item.Id] = item;
        }

        if (rootNode["days"] is not JsonObject daysObj)
        {
            return rootNode.ToJsonString();
        }

        string[] days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        string[] meals = ["breakfast", "lunch", "snack", "dinner"];

        foreach (var day in days)
        {
            if (daysObj[day] is not JsonObject dayObj) continue;

            foreach (var meal in meals)
            {
                if (dayObj[meal] is not JsonObject mealObj) continue;

                var id = $"{day}_{meal}";
                var normalizedId = $"{day}_{meal}".ToLowerInvariant();
                if (!lookup.TryGetValue(id, out var trans) && !lookup.TryGetValue(normalizedId, out trans)) continue;

                if (!string.IsNullOrWhiteSpace(trans.Name))
                {
                    mealObj["recipeName"] = trans.Name;
                }

                if (!string.IsNullOrWhiteSpace(trans.Tag))
                {
                    mealObj["tag"] = trans.Tag;
                }

                if (!string.IsNullOrWhiteSpace(trans.Tips))
                {
                    mealObj["tips"] = trans.Tips;
                }

                if (trans.NutritionistTips is not null)
                {
                    mealObj["nutritionistTips"] = trans.NutritionistTips;
                }

                RecombineIngredients(mealObj["ingredients"], trans.Ingredients);
                RecombineSteps(mealObj["steps"] ?? mealObj["instructions"], trans.Steps);
            }
        }

        return rootNode.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
    }

    private static List<TranslatableMealItem>? ParsePlanTranslationItems(string rawJson, ILogger logger)
    {
        try
        {
            var cleaned = UnifiedAiGateway.CleanMarkdownCodeBlock(rawJson);
            var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

            var rootNode = JsonNode.Parse(cleaned);
            if (rootNode is JsonArray)
            {
                return JsonSerializer.Deserialize<List<TranslatableMealItem>>(cleaned, jsonOptions);
            }

            if (rootNode is JsonObject obj)
            {
                string[] candidates = ["items", "meals", "recipes", "plan", "translations", "data"];
                foreach (var candidate in candidates)
                {
                    if (obj.TryGetPropertyValue(candidate, out var node) && node is JsonArray arr)
                    {
                        var deserialized = JsonSerializer.Deserialize<List<TranslatableMealItem>>(arr.ToJsonString(), jsonOptions);
                        if (deserialized is not null && deserialized.Count > 0) return deserialized;
                    }
                }

                foreach (var kvp in obj)
                {
                    if (kvp.Value is JsonArray arr)
                    {
                        var deserialized = JsonSerializer.Deserialize<List<TranslatableMealItem>>(arr.ToJsonString(), jsonOptions);
                        if (deserialized is not null && deserialized.Count > 0) return deserialized;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[Translation] Error while parsing plan translation items from AI output: {Json}", rawJson);
        }

        return null;
    }

    private static void RecombineIngredients(JsonNode? ingredientsNode, Dictionary<string, List<TranslatableIngredient>> translatedMap)
    {
        if (ingredientsNode is JsonObject ingObj)
        {
            foreach (var kvp in translatedMap)
            {
                if (ingObj[kvp.Key] is JsonArray sectionArray)
                {
                    UpdateIngredientArray(sectionArray, kvp.Value);
                }
            }
        }
        else if (ingredientsNode is JsonArray ingArray && translatedMap.TryGetValue("general", out var list))
        {
            UpdateIngredientArray(ingArray, list);
        }
    }

    private static void UpdateIngredientArray(JsonArray array, List<TranslatableIngredient> list)
    {
        for (var i = 0; i < array.Count && i < list.Count; i++)
        {
            if (array[i] is JsonObject itemObj)
            {
                if (!string.IsNullOrWhiteSpace(list[i].Name))
                {
                    itemObj["name"] = list[i].Name;
                }
                if (!string.IsNullOrWhiteSpace(list[i].Unit) && itemObj.ContainsKey("unit"))
                {
                    itemObj["unit"] = list[i].Unit;
                }
            }
            else
            {
                array[i] = list[i].Name;
            }
        }
    }

    private static void RecombineSteps(JsonNode? stepsNode, Dictionary<string, List<string>> translatedMap)
    {
        if (stepsNode is JsonObject stepsObj)
        {
            foreach (var kvp in translatedMap)
            {
                if (stepsObj[kvp.Key] is JsonArray sectionArray)
                {
                    UpdateStepArray(sectionArray, kvp.Value);
                }
            }
        }
        else if (stepsNode is JsonArray stepsArray && translatedMap.TryGetValue("general", out var list))
        {
            UpdateStepArray(stepsArray, list);
        }
    }

    private static void UpdateStepArray(JsonArray array, List<string> list)
    {
        for (var i = 0; i < array.Count && i < list.Count; i++)
        {
            if (array[i] is JsonObject itemObj && itemObj.ContainsKey("text"))
            {
                itemObj["text"] = list[i];
            }
            else
            {
                array[i] = list[i];
            }
        }
    }

    private static string BuildRecipeTranslationPrompt(string targetLanguage)
    {
        var targetName = targetLanguage.Equals("es", StringComparison.OrdinalIgnoreCase) ? "Spanish (Español)" : "English";
        return $$"""
        You are a specialized culinary translator. Translate the provided recipe JSON into {{targetName}}.
        Maintain the exact schema and data types.
        
        Required JSON output schema:
        {
          "recipeName": "Translated recipe title",
          "tips": "Translated general culinary/preparation tips (string)",
          "nutritionistTips": "Translated clinical/dietitian nutrition advice (string or null if input was null/empty)",
          "ingredients": [ ... array or structured object with translated 'name' and 'unit' fields ... ],
          "steps": [ "Translated step 1", "Translated step 2", ... ]
        }
        
        IMPORTANT INSTRUCTIONS:
        - If the input contains 'nutritionistTips', translate it accurately as 'nutritionistTips'. Do NOT discard or merge it into 'tips'.
        - If the input contains 'tips', translate it as 'tips'.
        - Preserve ingredient quantities, numbers, preparation times, and categories accurately. Return ONLY valid JSON.
        """;
    }

    private static string BuildCompactPlanTranslationPrompt(string targetLanguage)
    {
        var targetName = targetLanguage.Equals("es", StringComparison.OrdinalIgnoreCase) ? "Spanish (Español)" : "English";
        return $$"""
        You are a specialized culinary translator. Translate the array of recipe texts into {{targetName}}.
        Maintain the exact array structure, section keys (e.g., "general", "primerPlato", "postre", "segundoPlato"), and item order.

        Rules:
        - Translate "name", "tag" (e.g. Desayuno->Breakfast, Comida->Lunch, Merienda->Snack, Cena->Dinner), "tips", "nutritionistTips", ingredient "name" and "unit", and step text strings into {{targetName}}.
        - Return ONLY valid JSON array matching this exact schema:
        [
          {
            "id": "monday_breakfast",
            "name": "Translated recipe name",
            "tag": "Translated tag (e.g. Breakfast/Lunch/Snack/Dinner)",
            "tips": "Translated tips",
            "nutritionistTips": "Translated nutritionist advice or null",
            "ingredients": {
              "general": [
                { "name": "Translated ingredient name", "unit": "Translated unit (e.g. unit/tbsp/serving/cup)" }
              ]
            },
            "steps": {
              "general": [
                "Translated step instruction"
              ]
            }
          }
        ]
        """;
    }

    private static RecipeTranslationResult? ParseRecipeTranslationResponse(string rawJson, string targetLanguage)
    {
        try
        {
            var cleaned = UnifiedAiGateway.CleanMarkdownCodeBlock(rawJson);
            using var doc = JsonDocument.Parse(cleaned);
            var root = doc.RootElement;

            var name = root.TryGetProperty("recipeName", out var n) && n.ValueKind == JsonValueKind.String ? n.GetString() : null;
            if (string.IsNullOrWhiteSpace(name)) return null;

            var tips = root.TryGetProperty("tips", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() ?? string.Empty : string.Empty;
            var nutritionistTips = root.TryGetProperty("nutritionistTips", out var nt) && nt.ValueKind == JsonValueKind.String ? nt.GetString() : null;
            var ingredients = root.TryGetProperty("ingredients", out var ing) ? JsonElementParser.Parse(ing.GetRawText()) : JsonElementParser.Parse("[]");
            var steps = root.TryGetProperty("steps", out var st) ? JsonElementParser.Parse(st.GetRawText()) : JsonElementParser.Parse("[]");

            return new RecipeTranslationResult(name, tips, nutritionistTips, ingredients, steps, targetLanguage, true);
        }
        catch
        {
            return null;
        }
    }
}
