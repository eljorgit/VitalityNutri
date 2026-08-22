namespace VitalityNutri.Domain.Entities;

public sealed class RecipeTranslation
{
    public long Id { get; private set; }
    public long RecipeId { get; private set; }
    public string TargetLanguage { get; private set; } = string.Empty;
    public string RecipeName { get; private set; } = string.Empty;
    public string Tips { get; private set; } = string.Empty;
    public string? NutritionistTips { get; private set; }
    public string IngredientsJson { get; private set; } = "[]";
    public string StepsJson { get; private set; } = "[]";
    public bool IsAiTranslated { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private RecipeTranslation()
    {
    }

    public RecipeTranslation(
        long recipeId,
        string targetLanguage,
        string recipeName,
        string tips,
        string? nutritionistTips,
        string ingredientsJson,
        string stepsJson,
        bool isAiTranslated)
    {
        RecipeId = recipeId;
        TargetLanguage = targetLanguage.Trim().ToLowerInvariant();
        CreatedAtUtc = DateTimeOffset.UtcNow;
        Update(recipeName, tips, nutritionistTips, ingredientsJson, stepsJson, isAiTranslated);
        CreatedAtUtc = UpdatedAtUtc;
    }

    public void Update(
        string recipeName,
        string tips,
        string? nutritionistTips,
        string ingredientsJson,
        string stepsJson,
        bool isAiTranslated)
    {
        RecipeName = recipeName.Trim();
        Tips = tips ?? string.Empty;
        NutritionistTips = string.IsNullOrWhiteSpace(nutritionistTips) ? null : nutritionistTips.Trim();
        IngredientsJson = string.IsNullOrWhiteSpace(ingredientsJson) ? "[]" : ingredientsJson;
        StepsJson = string.IsNullOrWhiteSpace(stepsJson) ? "[]" : stepsJson;
        IsAiTranslated = isAiTranslated;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
