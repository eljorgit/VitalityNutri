using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
using VitalityNutri.Application.Plans.GetActivePlan;
namespace VitalityNutri.Application.Plans.RestorePlan;
public sealed record RestorePlanCommand(long Id) : IRequest<PlanEnvelope?>;
internal sealed class RestorePlanCommandHandler(IPlanRepository repository) : IRequestHandler<RestorePlanCommand, PlanEnvelope?>
{
    public async Task<PlanEnvelope?> Handle(RestorePlanCommand request, CancellationToken token)
    {
        var plan = await repository.RestoreAsync(request.Id, token);
        return plan is null ? null : new(JsonElementParser.Parse(plan.PlanJson), JsonElementParser.Parse(plan.MetadataJson));
    }
}