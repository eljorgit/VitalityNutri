using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Search.GetAllRecipes;

public sealed record GetAllRecipesQuery : IRequest<IReadOnlyList<SearchRecipeItemResult>>;

public sealed record SearchRecipeItemResult(
    long PlanId,
    string PlanName,
    bool IsActive,
    string Day,
    string Meal,
    string RecipeName,
    int Calories,
    string Time,
    string Tag,
    string Image,
    IReadOnlyList<string> IngredientNames,
    bool? IsRecetario = null,
    long? RecetarioId = null);

internal sealed class GetAllRecipesQueryHandler(IPlanRepository plans, IRecipeRepository recipes)
    : IRequestHandler<GetAllRecipesQuery, IReadOnlyList<SearchRecipeItemResult>>
{
    private static readonly string[] Days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    private static readonly string[] Meals = ["breakfast", "lunch", "snack", "dinner"];

    public async Task<IReadOnlyList<SearchRecipeItemResult>> Handle(GetAllRecipesQuery request, CancellationToken cancellationToken)
    {
        var results = new List<SearchRecipeItemResult>();

        foreach (var plan in await plans.GetHistoryAsync(cancellationToken))
        {
            try
            {
                using var doc = JsonDocument.Parse(plan.PlanJson);
                if (!doc.RootElement.TryGetProperty("days", out var daysElement) || daysElement.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                foreach (var day in Days)
                {
                    if (!daysElement.TryGetProperty(day, out var dayElement) || dayElement.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    foreach (var meal in Meals)
                    {
                        if (!dayElement.TryGetProperty(meal, out var recipeElement) ||
                            recipeElement.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
                        {
                            continue;
                        }

                        var recipeName = ReadString(recipeElement, "recipeName");
                        if (string.IsNullOrWhiteSpace(recipeName))
                        {
                            continue;
                        }

                        results.Add(new SearchRecipeItemResult(
                            plan.Id,
                            plan.FileName ?? string.Empty,
                            plan.IsActive,
                            day,
                            meal,
                            recipeName,
                            ReadInt(recipeElement, "calories"),
                            ReadString(recipeElement, "time"),
                            ReadString(recipeElement, "tag"),
                            ReadString(recipeElement, "image"),
                            ExtractIngredientNamesFromRecipe(recipeElement)));
                    }
                }
            }
            catch (JsonException)
            {
                // Ignore malformed legacy rows and keep behavior tolerant.
            }
        }

        foreach (var recipe in await recipes.GetAllAsync(cancellationToken))
        {
            results.Add(new SearchRecipeItemResult(
                -1,
                "Recetario",
                false,
                string.Empty,
                string.Empty,
                recipe.RecipeName,
                recipe.Calories,
                recipe.Time,
                recipe.Tag ?? string.Empty,
                recipe.Image ?? string.Empty,
                ExtractIngredientNames(recipe.IngredientsJson),
                true,
                recipe.Id));
        }

        return results;
    }

    private static IReadOnlyList<string> ExtractIngredientNamesFromRecipe(JsonElement recipeElement)
    {
        if (!recipeElement.TryGetProperty("ingredients", out var ingredientsElement))
        {
            return [];
        }

        return ExtractIngredientNames(ingredientsElement.GetRawText());
    }

    private static IReadOnlyList<string> ExtractIngredientNames(string ingredientsJson)
    {
        if (string.IsNullOrWhiteSpace(ingredientsJson))
        {
            return [];
        }

        try
        {
            using var doc = JsonDocument.Parse(ingredientsJson);
            return ExtractIngredientNames(doc.RootElement);
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static IReadOnlyList<string> ExtractIngredientNames(JsonElement ingredientsElement)
    {
        if (ingredientsElement.ValueKind == JsonValueKind.Array)
        {
            return ReadIngredientArray(ingredientsElement);
        }

        if (ingredientsElement.ValueKind == JsonValueKind.Object)
        {
            return ingredientsElement.EnumerateObject()
                .Where(property => property.Value.ValueKind == JsonValueKind.Array)
                .SelectMany(property => ReadIngredientArray(property.Value))
                .ToArray();
        }

        return [];
    }

    private static string[] ReadIngredientArray(JsonElement value) =>
        value.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.Object && item.TryGetProperty("name", out var nameElement) && nameElement.ValueKind == JsonValueKind.String)
            .Select(item => item.GetProperty("name").GetString()!.ToLowerInvariant())
            .ToArray();

    private static string ReadString(JsonElement value, string property)
    {
        if (!value.TryGetProperty(property, out var propertyValue) || propertyValue.ValueKind != JsonValueKind.String)
        {
            return string.Empty;
        }

        return propertyValue.GetString() ?? string.Empty;
    }

    private static int ReadInt(JsonElement value, string property)
    {
        if (!value.TryGetProperty(property, out var propertyValue) || propertyValue.ValueKind != JsonValueKind.Number)
        {
            return 0;
        }

        return propertyValue.GetInt32();
    }
}