using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.BatchCooking.GetBatchCooking;

public sealed record GetBatchCookingQuery : IRequest<BatchCookingResponse?>;

internal sealed class GetBatchCookingQueryHandler(IPlanRepository plans, IBatchCookingRepository batch)
    : IRequestHandler<GetBatchCookingQuery, BatchCookingResponse?>
{
    public async Task<BatchCookingResponse?> Handle(GetBatchCookingQuery request, CancellationToken cancellationToken)
    {
        var active = await plans.GetActiveAsync(cancellationToken);
        if (active is null)
        {
            return null;
        }

        var cached = await batch.GetByPlanIdAsync(active.Id, cancellationToken);
        if (cached is null)
        {
            return new BatchCookingResponse(null, null);
        }

        return new BatchCookingResponse(BatchCookingJson.Parse(cached.GuideJson), BatchCookingJson.Parse(cached.ParamsJson));
    }
}