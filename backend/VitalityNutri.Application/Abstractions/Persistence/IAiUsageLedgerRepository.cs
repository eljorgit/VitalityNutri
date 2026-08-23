using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IAiUsageLedgerRepository
{
    Task<AiUsageWeekly> GetOrCreateAsync(long userId, DateOnly weekStartUtc, CancellationToken cancellationToken = default);

    Task UpdateAsync(AiUsageWeekly usage, CancellationToken cancellationToken = default);

    Task AddEventAsync(AiUsageEvent usageEvent, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AiUsageEvent>> GetRecentEventsAsync(
        long userId,
        DateOnly weekStartUtc,
        int limit = 50,
        CancellationToken cancellationToken = default);
}
