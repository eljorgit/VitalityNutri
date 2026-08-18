using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Search.GetSearchHistory;

public sealed record GetSearchHistoryQuery : IRequest<IReadOnlyList<SearchHistoryResult>>;

public sealed record SearchHistoryResult(
    long Id,
    long PlanId,
    string PlanName,
    string Day,
    string Meal,
    string RecipeName,
    string Image,
    bool IsActive,
    DateTimeOffset ClickedAt);

internal sealed class GetSearchHistoryQueryHandler(ISearchHistoryRepository repository)
    : IRequestHandler<GetSearchHistoryQuery, IReadOnlyList<SearchHistoryResult>>
{
    public async Task<IReadOnlyList<SearchHistoryResult>> Handle(GetSearchHistoryQuery request, CancellationToken cancellationToken) =>
        (await repository.GetRecentAsync(10, cancellationToken))
        .Select(item => new SearchHistoryResult(item.Id, item.PlanId, item.PlanName, item.Day, item.Meal, item.RecipeName, item.Image, item.IsActive, item.ClickedAtUtc))
        .ToArray();
}