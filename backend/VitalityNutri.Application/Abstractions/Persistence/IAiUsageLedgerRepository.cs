using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IAiUsageLedgerRepository
{
    Task<AiUsageWeekly> GetOrCreateAsync(long userId, DateOnly weekStartUtc, CancellationToken cancellationToken = default);

    Task UpdateAsync(AiUsageWeekly usage, CancellationToken cancellationToken = default);
}
