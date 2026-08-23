namespace VitalityNutri.Domain.Entities;

/// <summary>
/// Weekly aggregate of AI credits spent by a user on platform AI (one row per ISO week).
/// BYOK usage is never recorded here — users pay their own providers directly.
/// </summary>
public sealed class AiUsageWeekly
{
    public long Id { get; private set; }
    public long UserId { get; private set; }
    /// <summary>Monday (00:00 UTC) of the week the usage belongs to.</summary>
    public DateOnly WeekStartUtc { get; private set; }
    public decimal CreditsUsed { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private AiUsageWeekly()
    {
    }

    public AiUsageWeekly(long userId, DateOnly weekStartUtc, decimal initialCredits = 0m)
    {
        UserId = userId;
        WeekStartUtc = weekStartUtc;
        CreditsUsed = Math.Max(0m, initialCredits);
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void AddCredits(decimal credits)
    {
        CreditsUsed += credits;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    /// <summary>Refunds credits when an operation ultimately fails; never goes negative.</summary>
    public void RefundCredits(decimal credits)
    {
        CreditsUsed = Math.Max(0m, CreditsUsed - credits);
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
