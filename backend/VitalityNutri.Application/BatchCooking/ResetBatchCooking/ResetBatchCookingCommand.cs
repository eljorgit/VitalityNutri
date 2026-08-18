using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.BatchCooking.ResetBatchCooking;

public sealed record ResetBatchCookingCommand : IRequest<bool>;

internal sealed class ResetBatchCookingCommandHandler(IPlanRepository plans, IBatchCookingRepository batch)
    : IRequestHandler<ResetBatchCookingCommand, bool>
{
    public async Task<bool> Handle(ResetBatchCookingCommand request, CancellationToken cancellationToken)
    {
        var active = await plans.GetActiveAsync(cancellationToken);
        if (active is null)
        {
            return false;
        }

        await batch.ResetAsync(active.Id, cancellationToken);
        return true;
    }
}