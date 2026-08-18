using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

internal sealed class SearchHistoryRepository(VitalityNutriDbContext dbContext) : ISearchHistoryRepository
{
    public async Task<IReadOnlyList<SearchHistoryItem>> GetRecentAsync(int limit, CancellationToken cancellationToken)
    {
        var items = await dbContext.SearchHistoryItems.AsNoTracking().ToArrayAsync(cancellationToken);
        return items
            .OrderByDescending(item => item.ClickedAtUtc)
            .ThenByDescending(item => item.Id)
            .Take(limit)
            .ToArray();
    }

    public async Task AddAsync(SearchHistoryItem item, int limit, CancellationToken cancellationToken)
    {
        dbContext.SearchHistoryItems.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        var allItems = await dbContext.SearchHistoryItems.ToArrayAsync(cancellationToken);
        var itemsToDelete = allItems
            .OrderByDescending(historyItem => historyItem.ClickedAtUtc)
            .ThenByDescending(historyItem => historyItem.Id)
            .Skip(limit)
            .ToArray();

        if (itemsToDelete.Length == 0)
        {
            return;
        }

        dbContext.SearchHistoryItems.RemoveRange(itemsToDelete);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken)
    {
        var item = await dbContext.SearchHistoryItems.FindAsync([id], cancellationToken);
        if (item is null)
        {
            return;
        }

        dbContext.SearchHistoryItems.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ClearAsync(CancellationToken cancellationToken)
    {
        var allItems = await dbContext.SearchHistoryItems.ToArrayAsync(cancellationToken);
        if (allItems.Length == 0)
        {
            return;
        }

        dbContext.SearchHistoryItems.RemoveRange(allItems);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}