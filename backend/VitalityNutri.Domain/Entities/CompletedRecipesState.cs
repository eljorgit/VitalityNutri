namespace VitalityNutri.Domain.Entities;

public sealed class CompletedRecipesState
{
    public long PlanId { get; private set; }
    public string CompletedJson { get; private set; } = "{}";
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private CompletedRecipesState() { }

    public CompletedRecipesState(long planId, string completedJson)
    {
        PlanId = planId;
        CompletedJson = completedJson;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Update(string completedJson)
    {
        CompletedJson = completedJson;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}