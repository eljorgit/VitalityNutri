using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.BatchCooking;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing.Ai;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class DeterministicBatchCookingAiService(
    ApiConfiguration apiConfiguration,
    IUnifiedAiGateway aiGateway,
    ILogger<DeterministicBatchCookingAiService> logger)
    : IBatchCookingAiService
{
    private static readonly string[] Days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    private static readonly string[] Meals = ["lunch", "dinner"];

    public async Task<JsonElement> GenerateGuideAsync(
        string planJson,
        BatchCookingParams parameters,
        string language,
        CancellationToken cancellationToken)
    {
        var filteredData = FilterLunchesAndDinners(planJson);

        try
        {
            var prompt = BuildPrompt(filteredData.FilteredDaysJson, filteredData.UniqueRecipeNames, parameters, language);
            var chain = apiConfiguration.Ai.FallbackChains.BatchCooking;
            var aiResponseText = await aiGateway.GenerateTextAsync(
                chainConfig: chain,
                prompt: prompt,
                systemPrompt: null,
                jsonMode: true,
                temperature: 0.2f,
                cancellationToken: cancellationToken);

            if (!string.IsNullOrWhiteSpace(aiResponseText))
            {
                var cleanedJson = ExtractJsonFromText(aiResponseText);
                var parsedGuide = JsonNode.Parse(cleanedJson) as JsonObject;
                if (parsedGuide is not null && parsedGuide["steps"] is JsonArray)
                {
                    EnrichRecipesAffected(parsedGuide, filteredData.RecipeNameToId);
                    logger.LogInformation("[BatchCooking] Successfully generated batch cooking guide via AI.");
                    return JsonSerializer.Deserialize<JsonElement>(parsedGuide.ToJsonString());
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[BatchCooking] Live AI batch cooking generation failed. Falling back to deterministic generator.");
        }

        return GenerateDeterministicFallback(filteredData, parameters);
    }

    private static string BuildPrompt(string filteredDaysJson, IReadOnlyList<string> uniqueRecipeNames, BatchCookingParams parameters, string language)
    {
        var basePrompt = LoadBatchCookingPromptTemplate(language);

        var isSpanish = string.IsNullOrWhiteSpace(language) || language.StartsWith("es", StringComparison.OrdinalIgnoreCase);

        var burnersText = isSpanish
            ? $"{parameters.BurnersCount} fuegos activos simultáneamente"
            : $"{parameters.BurnersCount} active burners simultaneously";

        var appliancesList = new List<string>();
        if (parameters.HasOven) appliancesList.Add(isSpanish ? "Horno" : "Oven");
        if (parameters.HasMicrowave) appliancesList.Add(isSpanish ? "Microondas" : "Microwave");
        if (parameters.HasAirfryer) appliancesList.Add(isSpanish ? "Freidora de Aire (Airfryer)" : "Airfryer");
        if (parameters.HasRobot) appliancesList.Add(isSpanish ? "Robot de Cocina (Thermomix o similar)" : "Kitchen Robot");

        var appliancesText = appliancesList.Count > 0
            ? string.Join(", ", appliancesList)
            : (isSpanish ? "Ningún electrodoméstico adicional (solo fuegos)" : "No additional appliances (burners only)");

        var customToolsText = !string.IsNullOrWhiteSpace(parameters.CustomTools)
            ? parameters.CustomTools.Trim()
            : (isSpanish ? "Ninguno" : "None");

        var kitchenContext = isSpanish
            ? $"""

            INFORMACIÓN DE LA COCINA DEL USUARIO (CRÍTICO: Debes adaptarte estrictamente a estos límites):
            1. Fuegos/Hornillas disponibles simultáneamente: {burnersText}.
               *¡ATENCIÓN! No planifiques pasos que requieran usar más fuegos de los disponibles a la vez.*
            2. Electrodomésticos disponibles: {appliancesText}.
               *Aprovecha estos electrodomésticos para realizar cocciones paralelas.*
            3. Herramientas adicionales disponibles: {customToolsText}.

            EL PLAN DE COMIDAS A PREPARAR ES:
            {filteredDaysJson}

            LISTA DE RECETAS EN EL PLAN (ESTRICTAMENTE OBLIGATORIO PARA "recipesAffected"):
            Las únicas recetas válidas en este plan con sus nombres exactos son:
            {JsonSerializer.Serialize(uniqueRecipeNames)}
            """
            : $"""

            USER KITCHEN INFORMATION (CRITICAL: Strictly adapt to these limits):
            1. Available simultaneous burners: {burnersText}.
               *Do not schedule steps requiring more burners than available.*
            2. Available appliances: {appliancesText}.
               *Utilize appliances for parallel cooking.*
            3. Additional tools: {customToolsText}.

            MEAL PLAN TO PREPARE:
            {filteredDaysJson}

            VALID RECIPES IN THE PLAN (STRICTLY REQUIRED FOR "recipesAffected"):
            {JsonSerializer.Serialize(uniqueRecipeNames)}
            """;

        return basePrompt + kitchenContext;
    }

    private static string LoadBatchCookingPromptTemplate(string language)
    {
        var basePath = AppContext.BaseDirectory;
        var canonicalPath = Path.Combine(basePath, "prompts", "batch-cooking", "prompt.md");
        if (System.IO.File.Exists(canonicalPath))
        {
            var content = System.IO.File.ReadAllText(canonicalPath);
            var isSpanish = string.IsNullOrWhiteSpace(language) || language.StartsWith("es", StringComparison.OrdinalIgnoreCase);
            var suffix = isSpanish ? "\n\nIMPORTANTE: Responde en ESPAÑOL." : "\n\nIMPORTANT: Respond in ENGLISH.";
            return content + suffix;
        }

        return "You are a professional chef expert in Batch Cooking. Generate an optimized timeline in JSON format.";
    }

    private static void EnrichRecipesAffected(JsonObject guide, IReadOnlyDictionary<string, long?> nameToId)
    {
        if (guide["steps"] is not JsonArray steps) return;

        foreach (var stepNode in steps)
        {
            if (stepNode is not JsonObject stepObj) continue;

            if (stepObj["recipesAffected"] is JsonArray recipesAffected)
            {
                var enrichedList = new JsonArray();
                foreach (var item in recipesAffected)
                {
                    if (item is null) continue;

                    string? recipeName = null;
                    if (item.GetValueKind() == JsonValueKind.String)
                    {
                        recipeName = item.GetValue<string>();
                    }
                    else if (item is JsonObject itemObj && itemObj["name"] is not null)
                    {
                        recipeName = itemObj["name"]?.GetValue<string>();
                    }

                    if (!string.IsNullOrWhiteSpace(recipeName))
                    {
                        nameToId.TryGetValue(recipeName.Trim(), out var recipeId);
                        enrichedList.Add(new JsonObject
                        {
                            ["id"] = recipeId,
                            ["name"] = recipeName
                        });
                    }
                }

                stepObj["recipesAffected"] = enrichedList;
            }
        }
    }

    private static string ExtractJsonFromText(string text) =>
        UnifiedAiGateway.CleanMarkdownCodeBlock(text);

    private static JsonElement GenerateDeterministicFallback(FilteredPlanData filteredData, BatchCookingParams parameters)
    {
        var utensils = GetUtensils(parameters);
        var stepRows = filteredData.RecipesList.Select((recipe, index) => new
        {
            stepNumber = index + 1,
            title = $"Preparar {recipe.RecipeName}",
            description = $"Cocina y porciona {recipe.RecipeName} para {recipe.Day}/{recipe.Meal}.",
            duration = "20 min",
            utensils,
            recipesAffected = new[] { new { id = recipe.Id, name = recipe.RecipeName } },
            ingredients = recipe.IngredientNames,
        }).ToArray();

        var storage = new[]
        {
            new
            {
                preparation = "Enfriar y porcionar en recipientes individuales herméticos.",
                container = "Hermético de vidrio o BPA-free",
                duration = "3-4 días en nevera / 3 meses en congelador",
                freezable = true,
                reheatingAndTips = "Recalentar en sartén tapada o microondas añadiendo una cucharada de agua."
            }
        };

        var guide = new
        {
            introduction = "Guía de batch cooking optimizada a partir del plan de comidas activo.",
            prepTime = $"{Math.Max(45, stepRows.Length * 20)} min",
            steps = stepRows,
            storageTips = storage,
        };

        return JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(guide));
    }

    private static string[] GetUtensils(BatchCookingParams parameters)
    {
        var utensils = new List<string> { "cuchillo", "tabla", $"{parameters.BurnersCount} fogones" };
        if (parameters.HasOven) utensils.Add("horno");
        if (parameters.HasMicrowave) utensils.Add("microondas");
        if (parameters.HasAirfryer) utensils.Add("airfryer");
        if (parameters.HasRobot) utensils.Add("robot de cocina");
        if (!string.IsNullOrWhiteSpace(parameters.CustomTools)) utensils.Add(parameters.CustomTools.Trim());
        return utensils.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private sealed record FilteredPlanData(
        string FilteredDaysJson,
        IReadOnlyList<string> UniqueRecipeNames,
        IReadOnlyDictionary<string, long?> RecipeNameToId,
        IReadOnlyList<(long? Id, string RecipeName, string Day, string Meal, string[] IngredientNames)> RecipesList);

    private static FilteredPlanData FilterLunchesAndDinners(string planJson)
    {
        var filteredDays = new Dictionary<string, Dictionary<string, object?>>();
        var recipeNamesList = new List<string>();
        var nameToId = new Dictionary<string, long?>(StringComparer.OrdinalIgnoreCase);
        var recipesList = new List<(long? Id, string RecipeName, string Day, string Meal, string[] IngredientNames)>();

        try
        {
            using var doc = JsonDocument.Parse(planJson);
            if (doc.RootElement.TryGetProperty("days", out var daysElement) && daysElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var day in Days)
                {
                    var dayMeals = new Dictionary<string, object?>();

                    if (daysElement.TryGetProperty(day, out var dayElement) && dayElement.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var meal in Meals)
                        {
                            if (dayElement.TryGetProperty(meal, out var recipeElement) && recipeElement.ValueKind == JsonValueKind.Object)
                            {
                                var recipeName = ReadString(recipeElement, "recipeName");
                                if (!string.IsNullOrWhiteSpace(recipeName))
                                {
                                    dayMeals[meal] = JsonSerializer.Deserialize<object>(recipeElement.GetRawText());
                                    recipeNamesList.Add(recipeName.Trim());

                                    var recipeId = ReadLong(recipeElement, "id");
                                    if (recipeId.HasValue)
                                    {
                                        nameToId[recipeName.Trim()] = recipeId.Value;
                                    }

                                    recipesList.Add((recipeId, recipeName.Trim(), day, meal, ReadIngredients(recipeElement)));
                                }
                            }
                        }
                    }

                    filteredDays[day] = dayMeals;
                }
            }
        }
        catch
        {
            // Ignore parse errors
        }

        var uniqueRecipeNames = recipeNamesList.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        return new FilteredPlanData(JsonSerializer.Serialize(filteredDays), uniqueRecipeNames, nameToId, recipesList);
    }

    private static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String)
        {
            return string.Empty;
        }

        return property.GetString() ?? string.Empty;
    }

    private static long? ReadLong(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetInt64(out var numericValue))
        {
            return numericValue;
        }

        return null;
    }

    private static string[] ReadIngredients(JsonElement recipeElement)
    {
        if (!recipeElement.TryGetProperty("ingredients", out var ingredients))
        {
            return [];
        }

        if (ingredients.ValueKind == JsonValueKind.Array)
        {
            return ReadArray(ingredients);
        }

        if (ingredients.ValueKind == JsonValueKind.Object)
        {
            return ingredients.EnumerateObject()
                .Where(property => property.Value.ValueKind == JsonValueKind.Array)
                .SelectMany(property => ReadArray(property.Value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        return [];
    }

    private static string[] ReadArray(JsonElement ingredients) =>
        ingredients.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.Object && item.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
            .Select(item => item.GetProperty("name").GetString() ?? string.Empty)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToArray();
}
