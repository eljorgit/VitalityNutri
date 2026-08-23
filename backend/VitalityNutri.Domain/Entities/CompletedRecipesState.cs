namespace VitalityNutri.Domain.Entities;

public sealed class CompletedRecipesState
{
    public long PlanId { get; private set; }
    public string CompletedJson { get; private set; } = "{}";
    public long? UserId { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private CompletedRecipesState() { }

    public CompletedRecipesState(long planId, string completedJson, long? userId = null)
    {
        PlanId = planId;
        CompletedJson = completedJson;
        UserId = userId;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void AssignUser(long userId)
    {
        UserId = userId;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Update(string completedJson)
    {
        CompletedJson = completedJson;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}