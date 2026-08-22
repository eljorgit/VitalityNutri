namespace VitalityNutri.Domain.Entities;

public sealed class MealPlanTranslation
{
    public long Id { get; private set; }
    public long PlanId { get; private set; }
    public string TargetLanguage { get; private set; } = string.Empty;
    public string PlanJson { get; private set; } = "{}";
    public bool IsAiTranslated { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private MealPlanTranslation()
    {
    }

    public MealPlanTranslation(
        long planId,
        string targetLanguage,
        string planJson,
        bool isAiTranslated)
    {
        PlanId = planId;
        TargetLanguage = targetLanguage.Trim().ToLowerInvariant();
        PlanJson = planJson;
        IsAiTranslated = isAiTranslated;
        CreatedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAtUtc = CreatedAtUtc;
    }

    public void Update(string planJson, bool isAiTranslated)
    {
        PlanJson = planJson;
        IsAiTranslated = isAiTranslated;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
