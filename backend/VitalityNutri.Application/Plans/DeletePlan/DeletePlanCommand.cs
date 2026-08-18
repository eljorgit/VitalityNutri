using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
namespace VitalityNutri.Application.Plans.DeletePlan;
public sealed record DeletePlanCommand(long Id) : IRequest<bool>;
internal sealed class DeletePlanCommandHandler(IPlanRepository repository) : IRequestHandler<DeletePlanCommand, bool>
{
    public Task<bool> Handle(DeletePlanCommand request, CancellationToken token) => repository.DeleteAsync(request.Id, token);
}