using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
using VitalityNutri.Application.Plans.GetActivePlan;
namespace VitalityNutri.Application.Plans.GetPlanById;
public sealed record GetPlanByIdQuery(long Id) : IRequest<PlanByIdResult?>;
public sealed record PlanByIdResult(PlanEnvelope Envelope, bool IsActive);
internal sealed class GetPlanByIdQueryValidator : AbstractValidator<GetPlanByIdQuery>
{
    public GetPlanByIdQueryValidator() => RuleFor(query => query.Id).GreaterThan(0);
}
internal sealed class GetPlanByIdQueryHandler(IPlanRepository repository) : IRequestHandler<GetPlanByIdQuery, PlanByIdResult?>
{
    public async Task<PlanByIdResult?> Handle(GetPlanByIdQuery request, CancellationToken cancellationToken)
    {
        var plan = await repository.GetByIdAsync(request.Id, cancellationToken);
        return plan is null ? null : new PlanByIdResult(new PlanEnvelope(JsonElementParser.Parse(plan.PlanJson), JsonElementParser.Parse(plan.MetadataJson)), plan.IsActive);
    }
}