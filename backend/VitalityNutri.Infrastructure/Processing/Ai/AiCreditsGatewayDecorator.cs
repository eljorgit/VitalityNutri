using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing.Ai;

/// <summary>
/// Decorator that meters platform-AI usage against the weekly credit quota.
/// BYOK-mode users, demo accounts, anonymous callers and OSS deployments bypass metering.
/// Credits are refunded when an operation fails outright (null result / exception).
/// </summary>
public sealed class AiCreditsGatewayDecorator(
    UnifiedAiGateway inner,
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IAiUsageLedgerRepository aiUsageLedgerRepository,
    IOptions<ApiConfiguration> apiConfiguration,
    ILogger<AiCreditsGatewayDecorator> logger) : IUnifiedAiGateway
{
    private readonly ApiConfiguration _config = apiConfiguration.Value;

    public Task<string?> GenerateTextAsync(
        string chainConfig, string prompt, string? systemPrompt = null, bool jsonMode = true,
        float temperature = 0.2f, AiUsageContext? usageContext = null, CancellationToken cancellationToken = default)
        => MeterAsync(chainConfig, prompt, usageContext,
            () => inner.GenerateTextAsync(chainConfig, prompt, systemPrompt, jsonMode, temperature, usageContext, cancellationToken),
            cancellationToken);

    public async Task<string?> GenerateMultimodalAsync(
        string chainConfig, string prompt, byte[] fileBytes, string mimeType,
        float temperature = 0.2f, AiUsageContext? usageContext = null, CancellationToken cancellationToken = default)
        => await MeterAsync(chainConfig, prompt, usageContext,
            () => inner.GenerateMultimodalAsync(chainConfig, prompt, fileBytes, mimeType, temperature, usageContext, cancellationToken),
            cancellationToken);

    public async IAsyncEnumerable<string> StreamTextAsync(
        string chainConfig, string prompt, string? systemPrompt = null, bool jsonMode = true,
        float temperature = 0.2f, AiUsageContext? usageContext = null,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var scope = await ReserveAsync(chainConfig, prompt, usageContext, cancellationToken);
        var emitted = false;
        await foreach (var chunk in inner.StreamTextAsync(chainConfig, prompt, systemPrompt, jsonMode, temperature, usageContext, cancellationToken))
        {
            emitted = true;
            yield return chunk;
        }

        if (!emitted)
        {
            await scope.RefundAsync();
        }
    }

    public async IAsyncEnumerable<string> StreamMultimodalAsync(
        string chainConfig, string prompt, byte[] fileBytes, string mimeType,
        float temperature = 0.2f, AiUsageContext? usageContext = null,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var scope = await ReserveAsync(chainConfig, prompt, usageContext, cancellationToken);
        var emitted = false;
        await foreach (var chunk in inner.StreamMultimodalAsync(chainConfig, prompt, fileBytes, mimeType, temperature, usageContext, cancellationToken))
        {
            emitted = true;
            yield return chunk;
        }

        if (!emitted)
        {
            await scope.RefundAsync();
        }
    }

    private async Task<string?> MeterAsync(
        string chainConfig,
        string prompt,
        AiUsageContext? usageContext,
        Func<Task<string?>> call,
        CancellationToken cancellationToken)
    {
        var scope = await ReserveAsync(chainConfig, prompt, usageContext, cancellationToken);
        try
        {
            var result = await call();
            if (result is null)
            {
                await scope.RefundAsync();
            }

            return result;
        }
        catch
        {
            await scope.RefundAsync();
            throw;
        }
    }

    /// <summary>Returns a reservation; refunding it reverses the charge.</summary>
    private async Task<CreditReservation> ReserveAsync(
        string chainConfig,
        string prompt,
        AiUsageContext? usageContext,
        CancellationToken cancellationToken)
    {
        var operation = ResolveOperation(chainConfig, usageContext);
        var sourceTextLength = Math.Max(0, usageContext?.SourceTextLength ?? prompt.Length);
        var cost = ResolveCost(operation, sourceTextLength);

        if (cost <= 0m)
        {
            return CreditReservation.Unmetered();
        }

        var userId = currentUserProvider.GetCurrentUserId();
        if (userId is null || currentUserProvider.IsDemo())
        {
            return CreditReservation.Unmetered();
        }

        // BYOK users pay their own providers: never quota-limited.
        var settings = await userAiSettingsRepository.EnsureSettingsAsync(userId.Value, cancellationToken);
        if (string.Equals(settings.Mode, Domain.Entities.UserAiSettings.ModeByok, StringComparison.OrdinalIgnoreCase))
        {
            return CreditReservation.Unmetered();
        }

        var limit = _config.Ai.Credits.WeeklyPlatformLimit;
        if (limit <= 0m)
        {
            return CreditReservation.Unmetered(); // Quotas disabled by configuration.
        }

        var weekStart = AiWeek.WeekStartUtc();
        var usage = await aiUsageLedgerRepository.GetOrCreateAsync(userId.Value, weekStart, cancellationToken);

        if (usage.CreditsUsed + cost > limit)
        {
            logger.LogWarning("User {UserId} exhausted weekly AI credits ({Used}/{Limit}); rejecting {Cost} credit call.",
                userId, usage.CreditsUsed, limit, cost);
            throw new AiCreditsExhaustedException(
                $"You have used your {limit:0.##} weekly AI credits. Switch to your own provider keys (BYOK) or wait until next week.");
        }

        usage.AddCredits(cost);
        await aiUsageLedgerRepository.UpdateAsync(usage, cancellationToken);

        await TryLogUsageEventAsync(userId.Value, usage.WeekStartUtc, operation, chainConfig, cost, usage.CreditsUsed, cancellationToken);
        return new CreditReservation(usage, aiUsageLedgerRepository, cost, logger, userId.Value, operation, chainConfig);
    }

    private AiUsageOperation ResolveOperation(string chainConfig, AiUsageContext? usageContext)
    {
        if (usageContext is not null && usageContext.Operation != AiUsageOperation.Unspecified)
        {
            return usageContext.Operation;
        }

        if (string.Equals(chainConfig, _config.Ai.FallbackChains.PlanText, StringComparison.Ordinal))
        {
            return AiUsageOperation.PlanUploadText;
        }

        if (string.Equals(chainConfig, _config.Ai.FallbackChains.PlanVision, StringComparison.Ordinal))
        {
            return AiUsageOperation.PlanUploadVision;
        }

        if (string.Equals(chainConfig, _config.Ai.FallbackChains.BatchCooking, StringComparison.Ordinal))
        {
            return AiUsageOperation.BatchCooking;
        }

        if (string.Equals(chainConfig, _config.Ai.FallbackChains.RecipeAi, StringComparison.Ordinal))
        {
            return AiUsageOperation.RecipeText;
        }

        if (string.Equals(chainConfig, _config.Ai.FallbackChains.RecipeVision, StringComparison.Ordinal))
        {
            return AiUsageOperation.RecipeVision;
        }

        if (string.Equals(chainConfig, _config.Ai.FallbackChains.Translation, StringComparison.Ordinal))
        {
            return AiUsageOperation.TranslationText;
        }

        return AiUsageOperation.Unspecified;
    }

    private static decimal ResolveCost(AiUsageOperation operation, int sourceTextLength)
        => operation switch
        {
            AiUsageOperation.PlanUploadText => AiCreditPolicy.PlanUploadTextCost,
            AiUsageOperation.PlanUploadVision => AiCreditPolicy.PlanUploadVisionCost,
            AiUsageOperation.BatchCooking => AiCreditPolicy.BatchCookingCost,
            AiUsageOperation.RecipeText => AiCreditPolicy.GetRecipeTextCost(sourceTextLength),
            AiUsageOperation.RecipeVision => AiCreditPolicy.RecipeVisionCost,
            AiUsageOperation.TranslationText => AiCreditPolicy.TranslationTextCost,
            AiUsageOperation.PlanTranslation => AiCreditPolicy.PlanTranslationCost,
            _ => 0m
        };

    private async Task TryLogUsageEventAsync(
        long userId,
        DateOnly weekStartUtc,
        AiUsageOperation operation,
        string chainConfig,
        decimal creditsDelta,
        decimal balanceAfter,
        CancellationToken cancellationToken)
    {
        try
        {
            var usageEvent = new Domain.Entities.AiUsageEvent(
                userId,
                weekStartUtc,
                operation.ToString(),
                chainConfig,
                creditsDelta,
                balanceAfter);

            await aiUsageLedgerRepository.AddEventAsync(usageEvent, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to persist AI usage event for user {UserId}.", userId);
        }
    }

    private sealed class CreditReservation(
        Domain.Entities.AiUsageWeekly? usage,
        IAiUsageLedgerRepository? repository,
        decimal cost,
        ILogger logger,
        long userId,
        AiUsageOperation operation,
        string chainConfig)
    {
        private bool _refunded;

        public static CreditReservation Unmetered() => new(
            null,
            null,
            0m,
            NullLogger.Instance,
            0,
            AiUsageOperation.Unspecified,
            string.Empty);

        public async Task RefundAsync()
        {
            if (usage is null || repository is null || _refunded)
            {
                return;
            }

            _refunded = true;
            usage.RefundCredits(cost);
            try
            {
                await repository.UpdateAsync(usage);
                await repository.AddEventAsync(new Domain.Entities.AiUsageEvent(
                    userId,
                    usage.WeekStartUtc,
                    operation.ToString(),
                    chainConfig,
                    -cost,
                    usage.CreditsUsed));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to refund {Cost} AI credits for user {UserId}.", cost, userId);
            }
        }
    }
}
