using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

public sealed class EfAiUsageLedgerRepository(VitalityNutriDbContext dbContext) : IAiUsageLedgerRepository
{
    public async Task<AiUsageWeekly> GetOrCreateAsync(long userId, DateOnly weekStartUtc, CancellationToken cancellationToken = default)
    {
        var existing = await dbContext.AiUsageWeeklies.FirstOrDefaultAsync(
            u => u.UserId == userId && u.WeekStartUtc == weekStartUtc,
            cancellationToken);

        if (existing is not null)
        {
            return existing;
        }

        var created = new AiUsageWeekly(userId, weekStartUtc);
        dbContext.AiUsageWeeklies.Add(created);
        await dbContext.SaveChangesAsync(cancellationToken);
        return created;
    }

    public async Task UpdateAsync(AiUsageWeekly usage, CancellationToken cancellationToken = default)
    {
        dbContext.AiUsageWeeklies.Update(usage);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task AddEventAsync(AiUsageEvent usageEvent, CancellationToken cancellationToken = default)
    {
        dbContext.AiUsageEvents.Add(usageEvent);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AiUsageEvent>> GetRecentEventsAsync(
        long userId,
        DateOnly weekStartUtc,
        int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var boundedLimit = Math.Clamp(limit, 1, 200);

        return await dbContext.AiUsageEvents
            .AsNoTracking()
            .Where(e => e.UserId == userId && e.WeekStartUtc == weekStartUtc)
            .OrderByDescending(e => e.CreatedAtUtc)
            .Take(boundedLimit)
            .ToListAsync(cancellationToken);
    }
}
