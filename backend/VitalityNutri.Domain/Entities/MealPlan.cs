namespace VitalityNutri.Domain.Entities;

public sealed class MealPlan
{
    public long Id { get; private set; }
    public string? FileName { get; private set; }
    public string? SavedFileName { get; private set; }
    public string PlanJson { get; private set; } = "{}";
    public string MetadataJson { get; private set; } = "{}";
    public bool IsActive { get; private set; }
    public string? FileHash { get; private set; }
    public string OriginalLanguage { get; private set; } = "es";
    public long? UserId { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private MealPlan()
    {
    }

    public MealPlan(string planJson, string metadataJson, string? fileName = null, string? savedFileName = null, string originalLanguage = "es", long? userId = null)
    {
        PlanJson = planJson;
        MetadataJson = metadataJson;
        FileName = fileName;
        SavedFileName = savedFileName;
        OriginalLanguage = string.IsNullOrWhiteSpace(originalLanguage) ? "es" : originalLanguage.Trim().ToLowerInvariant();
        UserId = userId;
        IsActive = true;
        CreatedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAtUtc = CreatedAtUtc;
    }

    public void AssignUser(long userId)
    {
        UserId = userId;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void ReplacePlanJson(string planJson)
    {
        PlanJson = planJson;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
