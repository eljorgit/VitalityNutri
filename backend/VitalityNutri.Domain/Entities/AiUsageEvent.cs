namespace VitalityNutri.Domain.Entities;

/// <summary>
/// Immutable per-call ledger rows for platform AI weekly credit accounting.
/// Positive CreditsDelta means charge; negative means refund.
/// </summary>
public sealed class AiUsageEvent
{
    public long Id { get; private set; }
    public long UserId { get; private set; }
    public DateOnly WeekStartUtc { get; private set; }
    public string Operation { get; private set; } = string.Empty;
    public string ChainName { get; private set; } = string.Empty;
    public decimal CreditsDelta { get; private set; }
    public decimal BalanceAfter { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }

    private AiUsageEvent()
    {
    }

    public AiUsageEvent(
        long userId,
        DateOnly weekStartUtc,
        string operation,
        string chainName,
        decimal creditsDelta,
        decimal balanceAfter)
    {
        UserId = userId;
        WeekStartUtc = weekStartUtc;
        Operation = operation;
        ChainName = chainName;
        CreditsDelta = creditsDelta;
        BalanceAfter = Math.Max(0m, balanceAfter);
        CreatedAtUtc = DateTimeOffset.UtcNow;
    }
}