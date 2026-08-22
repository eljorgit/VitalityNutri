using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
using VitalityNutri.Application.Plans.GetActivePlan;

namespace VitalityNutri.Application.Plans.GetPlanTranslation;

public sealed record GetPlanTranslationQuery(long? PlanId, string TargetLanguage) : IRequest<PlanEnvelope?>;

internal sealed class GetPlanTranslationQueryHandler(
    IPlanRepository planRepository,
    IPlanTranslationRepository translationRepository)
    : IRequestHandler<GetPlanTranslationQuery, PlanEnvelope?>
{
    public async Task<PlanEnvelope?> Handle(GetPlanTranslationQuery request, CancellationToken cancellationToken)
    {
        var plan = request.PlanId.HasValue
            ? await planRepository.GetByIdAsync(request.PlanId.Value, cancellationToken)
            : await planRepository.GetActiveAsync(cancellationToken);

        if (plan is null)
        {
            return null;
        }

        var sourceLanguage = string.IsNullOrWhiteSpace(plan.OriginalLanguage) ? "es" : plan.OriginalLanguage.Trim().ToLowerInvariant();
        var targetLanguage = string.IsNullOrWhiteSpace(request.TargetLanguage) ? "en" : request.TargetLanguage.Trim().ToLowerInvariant();

        var metadataNode = System.Text.Json.Nodes.JsonNode.Parse(plan.MetadataJson) as System.Text.Json.Nodes.JsonObject ?? new System.Text.Json.Nodes.JsonObject();
        metadataNode["id"] = plan.Id;
        metadataNode["originalLanguage"] = plan.OriginalLanguage;
        var enrichedMetadataJson = metadataNode.ToJsonString();

        if (string.Equals(sourceLanguage, targetLanguage, StringComparison.OrdinalIgnoreCase))
        {
            return new PlanEnvelope(
                JsonElementParser.Parse(plan.PlanJson),
                JsonElementParser.Parse(enrichedMetadataJson));
        }

        var cached = await translationRepository.GetAsync(plan.Id, targetLanguage, cancellationToken);
        if (cached is not null)
        {
            return new PlanEnvelope(
                JsonElementParser.Parse(cached.PlanJson),
                JsonElementParser.Parse(enrichedMetadataJson));
        }

        return null;
    }
}
