using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Common;
using VitalityNutri.Application.Plans.GetActivePlan;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Plans.TranslatePlan;

public sealed record TranslatePlanCommand(long? PlanId, string TargetLanguage) : IRequest<PlanEnvelope?>;

internal sealed class TranslatePlanCommandHandler(
    IPlanRepository planRepository,
    IPlanTranslationRepository translationRepository,
    ITextTranslationService translationService)
    : IRequestHandler<TranslatePlanCommand, PlanEnvelope?>
{
    public async Task<PlanEnvelope?> Handle(TranslatePlanCommand request, CancellationToken cancellationToken)
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

        if (string.Equals(sourceLanguage, targetLanguage, StringComparison.OrdinalIgnoreCase))
        {
            return new PlanEnvelope(
                JsonElementParser.Parse(plan.PlanJson),
                JsonElementParser.Parse(plan.MetadataJson));
        }

        var cached = await translationRepository.GetAsync(plan.Id, targetLanguage, cancellationToken);
        if (cached is not null)
        {
            return new PlanEnvelope(
                JsonElementParser.Parse(cached.PlanJson),
                JsonElementParser.Parse(plan.MetadataJson));
        }

        var translatedPlanJson = await translationService.TranslatePlanJsonAsync(
            plan.PlanJson,
            sourceLanguage,
            targetLanguage,
            cancellationToken);

        if (!string.IsNullOrWhiteSpace(translatedPlanJson) && translatedPlanJson != plan.PlanJson)
        {
            var entity = new MealPlanTranslation(
                plan.Id,
                targetLanguage,
                translatedPlanJson,
                true);

            await translationRepository.SaveAsync(entity, cancellationToken);

            return new PlanEnvelope(
                JsonElementParser.Parse(translatedPlanJson),
                JsonElementParser.Parse(plan.MetadataJson));
        }

        return new PlanEnvelope(
            JsonElementParser.Parse(plan.PlanJson),
            JsonElementParser.Parse(plan.MetadataJson));
    }
}
