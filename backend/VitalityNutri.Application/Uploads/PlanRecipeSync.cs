using System.Text.Json;
using System.Text.Json.Nodes;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Recipes;

namespace VitalityNutri.Application.Uploads;

internal static class PlanRecipeSync
{
    public static async Task<string> SyncAsync(
        string planJson,
        string metadataJson,
        IRecipeRepository recipes,
        CancellationToken cancellationToken)
    {
        var sourcePlanId = TryReadPlanId(metadataJson);
        var projectedRecipes = ExtractRecipes(planJson, sourcePlanId);
        if (projectedRecipes.Count == 0)
        {
            return planJson;
        }

        var existingRecipes = await recipes.GetAllAsync(cancellationToken);
        var existingByName = existingRecipes
            .GroupBy(recipe => recipe.RecipeName, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var nameToId = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);

        foreach (var projected in projectedRecipes)
        {
            if (existingByName.TryGetValue(projected.RecipeName, out var existing))
            {
                await recipes.UpdateAsync(existing.Id, projected with { IsFavorite = existing.IsFavorite }, cancellationToken);
                nameToId[projected.RecipeName] = existing.Id;
                continue;
            }

            var newId = await recipes.AddAsync(RecipeMappings.ToEntity(projected), cancellationToken);
            nameToId[projected.RecipeName] = newId;
        }

        return InjectRecipeIds(planJson, nameToId);
    }

    private static string InjectRecipeIds(string planJson, IReadOnlyDictionary<string, long> nameToId)
    {
        try
        {
            var root = JsonNode.Parse(planJson) as JsonObject;
            if (root?["days"] is not JsonObject days)
            {
                return planJson;
            }

            foreach (var dayProp in days)
            {
                if (dayProp.Value is not JsonObject dayObj)
                {
                    continue;
                }

                foreach (var mealProp in dayObj)
                {
                    if (mealProp.Value is not JsonObject mealObj)
                    {
                        continue;
                    }

                    var targetObj = mealObj;
                    if (mealObj["recipe"] is JsonObject nestedObj && nestedObj["recipeName"] is not null)
                    {
                        targetObj = nestedObj;
                    }

                    if (targetObj["recipeName"]?.GetValue<string>() is string recipeName &&
                        nameToId.TryGetValue(recipeName.Trim(), out var recipeId))
                    {
                        targetObj["id"] = recipeId;
                    }
                }
            }

            return root.ToJsonString();
        }
        catch
        {
            return planJson;
        }
    }

    private static long? TryReadPlanId(string metadataJson)
    {
        if (string.IsNullOrWhiteSpace(metadataJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(metadataJson);
            if (!document.RootElement.TryGetProperty("id", out var idElement))
            {
                return null;
            }

            return idElement.ValueKind switch
            {
                JsonValueKind.Number when idElement.TryGetInt64(out var id) => id,
                JsonValueKind.String when long.TryParse(idElement.GetString(), out var id) => id,
                _ => null
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static IReadOnlyList<RecipeWriteModel> ExtractRecipes(string planJson, long? sourcePlanId)
    {
        using var document = JsonDocument.Parse(planJson);
        if (!document.RootElement.TryGetProperty("days", out var days) || days.ValueKind != JsonValueKind.Object)
        {
            return [];
        }

        var results = new Dictionary<string, RecipeWriteModel>(StringComparer.OrdinalIgnoreCase);

        foreach (var day in days.EnumerateObject())
        {
            if (day.Value.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            foreach (var meal in day.Value.EnumerateObject())
            {
                if (meal.Value.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var recipeElement = ResolveRecipeElement(meal.Value);
                if (recipeElement is null)
                {
                    continue;
                }

                var recipeName = ReadString(recipeElement.Value, "recipeName");
                if (string.IsNullOrWhiteSpace(recipeName) || results.ContainsKey(recipeName))
                {
                    continue;
                }

                var ingredients = ReadElement(recipeElement.Value, "ingredients", "[]");
                var steps = ReadElement(recipeElement.Value, "steps", ReadElement(recipeElement.Value, "instructions", "[]").GetRawText());

                var model = new RecipeWriteModel(
                    recipeName,
                    ReadInt(recipeElement.Value, "calories"),
                    ReadString(recipeElement.Value, "time") ?? "20 min",
                    ReadString(recipeElement.Value, "tag") ?? meal.Name,
                    ReadString(recipeElement.Value, "image"),
                    ingredients,
                    ReadString(recipeElement.Value, "tips") ?? string.Empty,
                    steps,
                    ReadString(recipeElement.Value, "nutritionistTips"),
                    TryReadOptionalElement(recipeElement.Value, "nutrition"),
                    Math.Max(1, ReadInt(recipeElement.Value, "servings", 1)),
                    "plan",
                    sourcePlanId,
                    true,
                    false,
                    ReadString(recipeElement.Value, "season") ?? "Todas");

                results[recipeName] = model;
            }
        }

        return results.Values.ToArray();
    }

    private static JsonElement? ResolveRecipeElement(JsonElement mealElement)
    {
        if (mealElement.TryGetProperty("recipeName", out _))
        {
            return mealElement;
        }

        if (mealElement.TryGetProperty("recipe", out var nestedRecipe) && nestedRecipe.ValueKind == JsonValueKind.Object)
        {
            return nestedRecipe;
        }

        return null;
    }

    private static string? ReadString(JsonElement parent, string propertyName)
    {
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        if (value.ValueKind == JsonValueKind.String)
        {
            var text = value.GetString();
            return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        }

        return null;
    }

    private static int ReadInt(JsonElement parent, string propertyName, int defaultValue = 0)
    {
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return defaultValue;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var numberValue))
        {
            return numberValue;
        }

        if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var parsedValue))
        {
            return parsedValue;
        }

        return defaultValue;
    }

    private static JsonElement ReadElement(JsonElement parent, string propertyName, string fallbackJson)
    {
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return JsonSerializer.Deserialize<JsonElement>(fallbackJson);
        }

        if (value.ValueKind is JsonValueKind.Object or JsonValueKind.Array)
        {
            return value.Clone();
        }

        return JsonSerializer.Deserialize<JsonElement>(fallbackJson);
    }

    private static JsonElement? TryReadOptionalElement(JsonElement parent, string propertyName)
    {
        if (!parent.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        return value.ValueKind is JsonValueKind.Object or JsonValueKind.Array
            ? value.Clone()
            : null;
    }
}
