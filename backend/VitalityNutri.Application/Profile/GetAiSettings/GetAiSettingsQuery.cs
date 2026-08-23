using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.Profile.GetAiSettings;

public sealed record GetAiSettingsQuery : IRequest<AiSettingsDto>;

public sealed class GetAiSettingsQueryHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IAiUsageLedgerRepository aiUsageLedgerRepository,
    IAiCreditLimits aiCreditLimits)
    : IRequestHandler<GetAiSettingsQuery, AiSettingsDto>
{
    public async Task<AiSettingsDto> Handle(GetAiSettingsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("AI settings are not available in demo mode.");
        }

        var settings = await userAiSettingsRepository.EnsureSettingsAsync(userId, cancellationToken);
        var keys = await userAiSettingsRepository.GetKeysAsync(userId, cancellationToken);

        var weekStart = AiWeek.WeekStartUtc();
        var usage = await aiUsageLedgerRepository.GetOrCreateAsync(userId, weekStart, cancellationToken);
        var recentEvents = await aiUsageLedgerRepository.GetRecentEventsAsync(userId, weekStart, 50, cancellationToken);

        var usageMetrics = BuildUsageMetrics();
        var usageInteractions = recentEvents
            .Select(e => new AiUsageInteractionDto(
                e.CreatedAtUtc,
                e.Operation,
                Math.Abs(e.CreditsDelta),
                e.ChainName,
                e.CreditsDelta < 0m ? "Refunded" : "Charged"))
            .ToList();

        return AiSettingsMapper.ToDto(
            settings,
            keys,
            aiCreditLimits.GetWeeklyPlatformLimit(),
            usage.CreditsUsed,
            weekStart,
            usageMetrics,
            usageInteractions);
    }

    private static IReadOnlyList<AiUsageMetricDto> BuildUsageMetrics()
    {
        return
        [
            new AiUsageMetricDto("plan-text", "Plan upload (text)", AiCreditPolicy.PlanUploadTextCost, AiCreditPolicy.PlanUploadTextCost),
            new AiUsageMetricDto("plan-vision", "Plan upload (vision/PDF)", AiCreditPolicy.PlanUploadVisionCost, AiCreditPolicy.PlanUploadVisionCost),
            new AiUsageMetricDto("batch-cooking", "Batch cooking", AiCreditPolicy.BatchCookingCost, AiCreditPolicy.BatchCookingCost),
            new AiUsageMetricDto("recipe-text", "Recipe AI (text, size-based)", AiCreditPolicy.RecipeTextMinCost, AiCreditPolicy.RecipeTextMaxCost),
            new AiUsageMetricDto("recipe-vision", "Recipe AI (vision)", AiCreditPolicy.RecipeVisionCost, AiCreditPolicy.RecipeVisionCost),
            new AiUsageMetricDto("translation-text", "Translation (text)", AiCreditPolicy.TranslationTextCost, AiCreditPolicy.TranslationTextCost),
            new AiUsageMetricDto("translation-plan", "Translation (whole plan)", AiCreditPolicy.PlanTranslationCost, AiCreditPolicy.PlanTranslationCost)
        ];
    }
}
