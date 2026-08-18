using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
namespace VitalityNutri.Application.Plans.GetPlanHistory;
public sealed record GetPlanHistoryQuery : IRequest<IReadOnlyList<PlanHistoryItem>>;
public sealed record PlanHistoryItem(long Id, string? FileName, string? SavedFileName, JsonElement Metadata, bool IsActive, DateTimeOffset CreatedAt);
internal sealed class GetPlanHistoryQueryHandler(IPlanRepository repository) : IRequestHandler<GetPlanHistoryQuery, IReadOnlyList<PlanHistoryItem>>
{
    public async Task<IReadOnlyList<PlanHistoryItem>> Handle(GetPlanHistoryQuery request, CancellationToken cancellationToken) =>
        (await repository.GetHistoryAsync(cancellationToken)).Select(plan => new PlanHistoryItem(plan.Id, plan.FileName, plan.SavedFileName,
            JsonElementParser.Parse(plan.MetadataJson), plan.IsActive, plan.CreatedAtUtc)).ToArray();
}