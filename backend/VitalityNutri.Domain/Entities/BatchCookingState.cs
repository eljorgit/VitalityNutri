namespace VitalityNutri.Domain.Entities;

public sealed class BatchCookingState
{
    public long PlanId { get; private set; }
    public string GuideJson { get; private set; } = "{}";
    public string ParamsJson { get; private set; } = "{}";
    public long? UserId { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private BatchCookingState()
    {
    }

    public BatchCookingState(long planId, string guideJson, string paramsJson, long? userId = null)
    {
        PlanId = planId;
        GuideJson = guideJson;
        ParamsJson = paramsJson;
        UserId = userId;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void AssignUser(long userId)
    {
        UserId = userId;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Update(string guideJson, string paramsJson)
    {
        GuideJson = guideJson;
        ParamsJson = paramsJson;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}