using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
using VitalityNutri.Application.Uploads;

namespace VitalityNutri.Application.Plans.GetActivePlan;

public sealed record GetActivePlanQuery : IRequest<PlanEnvelope?>;

public sealed record PlanEnvelope(System.Text.Json.JsonElement Plan, System.Text.Json.JsonElement Metadata);

internal sealed class GetActivePlanQueryHandler(
    IPlanRepository repository,
    IRecipeRepository recipeRepository)
    : IRequestHandler<GetActivePlanQuery, PlanEnvelope?>
{
    public async Task<PlanEnvelope?> Handle(GetActivePlanQuery request, CancellationToken cancellationToken)
    {
        var entity = await repository.GetActiveAsync(cancellationToken);
        if (entity is null)
        {
            return null;
        }

        var syncedPlanJson = await PlanRecipeSync.SyncAsync(
            entity.PlanJson,
            entity.MetadataJson,
            recipeRepository,
            cancellationToken);

        if (syncedPlanJson != entity.PlanJson)
        {
            entity.ReplacePlanJson(syncedPlanJson);
            await repository.SaveAsync(entity, cancellationToken);
        }

        var metadataNode = System.Text.Json.Nodes.JsonNode.Parse(entity.MetadataJson) as System.Text.Json.Nodes.JsonObject ?? new System.Text.Json.Nodes.JsonObject();
        metadataNode["id"] = entity.Id;
        metadataNode["originalLanguage"] = entity.OriginalLanguage;
        var enrichedMetadataJson = metadataNode.ToJsonString();

        return new PlanEnvelope(
            JsonElementParser.Parse(syncedPlanJson),
            JsonElementParser.Parse(enrichedMetadataJson));
    }
}
