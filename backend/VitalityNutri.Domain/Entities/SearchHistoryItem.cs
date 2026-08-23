namespace VitalityNutri.Domain.Entities;

public sealed class SearchHistoryItem
{
    public long Id { get; private set; }
    public long PlanId { get; private set; }
    public string PlanName { get; private set; } = string.Empty;
    public string Day { get; private set; } = string.Empty;
    public string Meal { get; private set; } = string.Empty;
    public string RecipeName { get; private set; } = string.Empty;
    public string Image { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public long? UserId { get; private set; }
    public DateTimeOffset ClickedAtUtc { get; private set; }

    private SearchHistoryItem()
    {
    }

    public SearchHistoryItem(long planId, string planName, string day, string meal, string recipeName, string image, bool isActive, long? userId = null)
    {
        PlanId = planId;
        PlanName = planName ?? string.Empty;
        Day = day;
        Meal = meal;
        RecipeName = recipeName;
        Image = image ?? string.Empty;
        IsActive = isActive;
        UserId = userId;
        ClickedAtUtc = DateTimeOffset.UtcNow;
    }
}