using System.Text.Json;
using System.Text.Json.Serialization;
using VitalityNutri.Application.Common;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Recipes;

public sealed record RecipeWriteModel(
    string RecipeName,
    int Calories,
    string Time,
    string? Tag,
    string? Image,
    JsonElement Ingredients,
    string Tips,
    JsonElement Steps,
    string? NutritionistTips,
    JsonElement? Nutrition,
    int Servings,
    string Source,
    long? SourcePlanId,
    bool IsAiGenerated,
    bool IsFavorite,
    string Season);

public sealed record RecipeResult(
    long Id,
    string RecipeName,
    int Calories,
    string Time,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tag,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Image,
    JsonElement Ingredients,
    string Tips,
    JsonElement Steps,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? NutritionistTips,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] JsonElement? Nutrition,
    int Servings,
    string Source,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] long? SourcePlanId,
    bool IsAiGenerated,
    bool IsFavorite,
    string Season,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

internal static class RecipeMappings
{
    public static RecipeResult ToResult(Recipe recipe) => new(
        recipe.Id,
        recipe.RecipeName,
        recipe.Calories,
        recipe.Time,
        recipe.Tag,
        recipe.Image,
        JsonElementParser.Parse(recipe.IngredientsJson),
        recipe.Tips,
        JsonElementParser.Parse(recipe.StepsJson),
        recipe.NutritionistTips,
        string.IsNullOrWhiteSpace(recipe.NutritionJson) ? null : JsonElementParser.Parse(recipe.NutritionJson),
        recipe.Servings,
        recipe.Source,
        recipe.SourcePlanId,
        recipe.IsAiGenerated,
        recipe.IsFavorite,
        recipe.Season,
        recipe.CreatedAtUtc,
        recipe.UpdatedAtUtc);

    public static Recipe ToEntity(RecipeWriteModel model) => new(
        model.RecipeName,
        model.Calories,
        model.Time,
        model.Tag,
        model.Image,
        model.Ingredients.GetRawText(),
        model.Tips,
        model.Steps.GetRawText(),
        model.NutritionistTips,
        model.Nutrition?.GetRawText(),
        model.Servings,
        model.Source,
        model.SourcePlanId,
        model.IsAiGenerated,
        model.IsFavorite,
        model.Season);
}

internal static class RecipeIngredients
{
    private static readonly string[] Sections = ["primerPlato", "segundoPlato", "postre", "general"];

    public static IReadOnlyCollection<(string Name, string Category)> Extract(JsonElement ingredients)
    {
        var items = ingredients.ValueKind == JsonValueKind.Array
            ? ingredients.EnumerateArray()
            : Sections
                .Where(section => ingredients.ValueKind == JsonValueKind.Object &&
                    ingredients.TryGetProperty(section, out var value) && value.ValueKind == JsonValueKind.Array)
                .SelectMany(section => ingredients.GetProperty(section).EnumerateArray());

        return items
            .Where(item => item.ValueKind == JsonValueKind.Object && item.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
            .Select(item => (
                item.GetProperty("name").GetString()!,
                item.TryGetProperty("category", out var category) && category.ValueKind == JsonValueKind.String
                    ? category.GetString() ?? "Otros"
                    : "Otros"))
            .ToArray();
    }
}