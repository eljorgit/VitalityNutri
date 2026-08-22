using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
using VitalityNutri.Application.Plans.GetActivePlan;
using VitalityNutri.Application.Uploads;

namespace VitalityNutri.Application.Plans.GetPlanById;

public sealed record GetPlanByIdQuery(long Id) : IRequest<PlanByIdResult?>;

public sealed record PlanByIdResult(PlanEnvelope Envelope, bool IsActive);

internal sealed class GetPlanByIdQueryValidator : AbstractValidator<GetPlanByIdQuery>
{
    public GetPlanByIdQueryValidator() => RuleFor(query => query.Id).GreaterThan(0);
}

internal sealed class GetPlanByIdQueryHandler(
    IPlanRepository repository,
    IRecipeRepository recipeRepository)
    : IRequestHandler<GetPlanByIdQuery, PlanByIdResult?>
{
    public async Task<PlanByIdResult?> Handle(GetPlanByIdQuery request, CancellationToken cancellationToken)
    {
        var plan = await repository.GetByIdAsync(request.Id, cancellationToken);
        if (plan is null)
        {
            return null;
        }

        var syncedPlanJson = await PlanRecipeSync.SyncAsync(
            plan.PlanJson,
            plan.MetadataJson,
            recipeRepository,
            cancellationToken);

        if (syncedPlanJson != plan.PlanJson)
        {
            plan.ReplacePlanJson(syncedPlanJson);
            await repository.SaveAsync(plan, cancellationToken);
        }

        var metadataNode = System.Text.Json.Nodes.JsonNode.Parse(plan.MetadataJson) as System.Text.Json.Nodes.JsonObject ?? new System.Text.Json.Nodes.JsonObject();
        metadataNode["id"] = plan.Id;
        metadataNode["originalLanguage"] = plan.OriginalLanguage;
        var enrichedMetadataJson = metadataNode.ToJsonString();

        return new PlanByIdResult(
            new PlanEnvelope(
                JsonElementParser.Parse(syncedPlanJson),
                JsonElementParser.Parse(enrichedMetadataJson)),
            plan.IsActive);
    }
}