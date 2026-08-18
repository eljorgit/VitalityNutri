using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Google.GenAI;
using Google.GenAI.Types;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.BatchCooking;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class DeterministicBatchCookingAiService(
    ApiConfiguration apiConfiguration,
    IHttpClientFactory httpClientFactory,
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
            var aiResponseText = await TryGenerateFromAiAsync(prompt, cancellationToken);
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

    private async Task<string?> TryGenerateFromAiAsync(string prompt, CancellationToken cancellationToken)
    {
        var isSaaS = apiConfiguration.App.Mode.Equals("SaaS", StringComparison.OrdinalIgnoreCase);

        if (isSaaS || apiConfiguration.Ai.UseOmniRoute)
        {
            if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.OmniRoute.Url))
            {
                return await CallOmniRouteAsync(prompt, cancellationToken);
            }
        }

        if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.Providers.Groq.ApiKey))
        {
            var groqResult = await CallGroqAsync(prompt, cancellationToken);
            if (!string.IsNullOrWhiteSpace(groqResult)) return groqResult;
        }

        if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.Providers.Gemini.ApiKey))
        {
            return await CallGeminiAsync(prompt, cancellationToken);
        }

        return null;
    }

    private async Task<string?> CallGeminiAsync(string prompt, CancellationToken cancellationToken)
    {
        var gemini = new Client(
            apiKey: apiConfiguration.Ai.Providers.Gemini.ApiKey,
            httpOptions: new HttpOptions
            {
                Timeout = (int)TimeSpan.FromSeconds(Math.Clamp(apiConfiguration.Ai.Providers.Gemini.TimeoutSeconds, 30, 300)).TotalMilliseconds
            });

        var response = await gemini.Models.GenerateContentAsync(
            model: "gemini-2.5-flash",
            contents: new Content { Parts = [Part.FromText(prompt)] },
            config: new GenerateContentConfig
            {
                ResponseMimeType = "application/json",
                Temperature = 0.2f
            },
            cancellationToken: cancellationToken);

        if (response.Candidates is null || response.Candidates.Count == 0) return null;
        var parts = response.Candidates[0].Content?.Parts;
        if (parts is null || parts.Count == 0) return null;
        return string.Join(string.Empty, parts.Where(p => !string.IsNullOrWhiteSpace(p.Text)).Select(p => p.Text));
    }

    private async Task<string?> CallGroqAsync(string prompt, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(60);

        var requestBody = new
        {
            model = "llama-3.3-70b-versatile",
            messages = new object[]
            {
                new { role = "user", content = prompt }
            },
            response_format = new { type = "json_object" },
            temperature = 0.2
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiConfiguration.Ai.Providers.Groq.ApiKey);

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
    }

    private async Task<string?> CallOmniRouteAsync(string prompt, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(Math.Clamp(apiConfiguration.Ai.Providers.Gemini.TimeoutSeconds, 30, 300));

        var requestBody = new
        {
            model = apiConfiguration.Ai.Models.BatchCooking,
            messages = new object[]
            {
                new { role = "user", content = prompt }
            },
            temperature = 0.2
        };

        var request = new HttpRequestMessage(HttpMethod.Post, apiConfiguration.Ai.OmniRoute.Url)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.OmniRoute.ApiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiConfiguration.Ai.OmniRoute.ApiKey);
        }

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
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

    private static string ExtractJsonFromText(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.StartsWith("```"))
        {
            var lines = trimmed.Split('\n');
            var innerLines = lines.Skip(1).TakeWhile(line => !line.Trim().StartsWith("```"));
            return string.Join('\n', innerLines).Trim();
        }
        return trimmed;
    }

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
