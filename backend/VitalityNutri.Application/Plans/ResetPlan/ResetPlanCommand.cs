using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
namespace VitalityNutri.Application.Plans.ResetPlan;
public sealed record ResetPlanCommand : IRequest;
internal sealed class ResetPlanCommandHandler(IPlanRepository repository) : IRequestHandler<ResetPlanCommand>
{
    public Task Handle(ResetPlanCommand request, CancellationToken token) => repository.ResetActiveAsync(token);
}