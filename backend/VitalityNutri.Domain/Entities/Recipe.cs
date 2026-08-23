namespace VitalityNutri.Domain.Entities;

public sealed class Recipe
{
    public long Id { get; private set; }
    public string RecipeName { get; private set; } = string.Empty;
    public int Calories { get; private set; }
    public string Time { get; private set; } = "20 min";
    public string? Tag { get; private set; }
    public string? Image { get; private set; }
    public string IngredientsJson { get; private set; } = "[]";
    public string Tips { get; private set; } = string.Empty;
    public string StepsJson { get; private set; } = "[]";
    public string? NutritionistTips { get; private set; }
    public string? NutritionJson { get; private set; }
    public int Servings { get; private set; } = 1;
    public string Source { get; private set; } = "manual";
    public long? SourcePlanId { get; private set; }
    public bool IsAiGenerated { get; private set; }
    public bool IsFavorite { get; private set; }
    public string Season { get; private set; } = "Todas";
    public string OriginalLanguage { get; private set; } = "es";
    public long? UserId { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private Recipe()
    {
    }

    public Recipe(
        string recipeName,
        int calories,
        string time,
        string? tag,
        string? image,
        string ingredientsJson,
        string tips,
        string stepsJson,
        string? nutritionistTips,
        string? nutritionJson,
        int servings,
        string source,
        long? sourcePlanId,
        bool isAiGenerated,
        bool isFavorite,
        string season,
        string originalLanguage = "es",
        long? userId = null)
    {
        CreatedAtUtc = DateTimeOffset.UtcNow;
        UserId = userId;
        Update(recipeName, calories, time, tag, image, ingredientsJson, tips, stepsJson,
            nutritionistTips, nutritionJson, servings, source, sourcePlanId,
            isAiGenerated, isFavorite, season, originalLanguage);
        CreatedAtUtc = UpdatedAtUtc;
    }

    public void AssignUser(long userId)
    {
        UserId = userId;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Update(
        string recipeName,
        int calories,
        string time,
        string? tag,
        string? image,
        string ingredientsJson,
        string tips,
        string stepsJson,
        string? nutritionistTips,
        string? nutritionJson,
        int servings,
        string source,
        long? sourcePlanId,
        bool isAiGenerated,
        bool isFavorite,
        string season,
        string originalLanguage = "es")
    {
        RecipeName = recipeName.Trim();
        Calories = calories;
        Time = string.IsNullOrWhiteSpace(time) ? "20 min" : time.Trim();
        Tag = string.IsNullOrWhiteSpace(tag) ? null : tag.Trim();
        Image = string.IsNullOrWhiteSpace(image) ? null : image.Trim();
        IngredientsJson = ingredientsJson;
        Tips = tips ?? string.Empty;
        StepsJson = stepsJson;
        NutritionistTips = string.IsNullOrWhiteSpace(nutritionistTips) ? null : nutritionistTips.Trim();
        NutritionJson = string.IsNullOrWhiteSpace(nutritionJson) ? null : nutritionJson;
        Servings = Math.Max(1, servings);
        Source = string.IsNullOrWhiteSpace(source) ? "manual" : source.Trim();
        SourcePlanId = sourcePlanId;
        IsAiGenerated = isAiGenerated;
        IsFavorite = isFavorite;
        Season = string.IsNullOrWhiteSpace(season) ? "Todas" : season.Trim();
        OriginalLanguage = string.IsNullOrWhiteSpace(originalLanguage) ? "es" : originalLanguage.Trim().ToLowerInvariant();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public bool ToggleFavorite()
    {
        IsFavorite = !IsFavorite;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
        return IsFavorite;
    }
}
