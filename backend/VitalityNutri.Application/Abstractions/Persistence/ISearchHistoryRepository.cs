using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface ISearchHistoryRepository
{
    Task<IReadOnlyList<SearchHistoryItem>> GetRecentAsync(int limit, CancellationToken cancellationToken);
    Task AddAsync(SearchHistoryItem item, int limit, CancellationToken cancellationToken);
    Task DeleteAsync(long id, CancellationToken cancellationToken);
    Task ClearAsync(CancellationToken cancellationToken);
}