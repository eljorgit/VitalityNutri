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
    private Dictionary<string, decimal>? _chainCosts;

    public Task<string?> GenerateTextAsync(
        string chainConfig, string prompt, string? systemPrompt = null, bool jsonMode = true,
        float temperature = 0.2f, CancellationToken cancellationToken = default)
        => MeterAsync(chainConfig,
            () => inner.GenerateTextAsync(chainConfig, prompt, systemPrompt, jsonMode, temperature, cancellationToken),
            cancellationToken);

    public async Task<string?> GenerateMultimodalAsync(
        string chainConfig, string prompt, byte[] fileBytes, string mimeType,
        float temperature = 0.2f, CancellationToken cancellationToken = default)
        => await MeterAsync(chainConfig,
            () => inner.GenerateMultimodalAsync(chainConfig, prompt, fileBytes, mimeType, temperature, cancellationToken),
            cancellationToken);

    public async IAsyncEnumerable<string> StreamTextAsync(
        string chainConfig, string prompt, string? systemPrompt = null, bool jsonMode = true,
        float temperature = 0.2f, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var scope = await ReserveAsync(chainConfig, cancellationToken);
        var emitted = false;
        await foreach (var chunk in inner.StreamTextAsync(chainConfig, prompt, systemPrompt, jsonMode, temperature, cancellationToken))
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
        float temperature = 0.2f, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var scope = await ReserveAsync(chainConfig, cancellationToken);
        var emitted = false;
        await foreach (var chunk in inner.StreamMultimodalAsync(chainConfig, prompt, fileBytes, mimeType, temperature, cancellationToken))
        {
            emitted = true;
            yield return chunk;
        }

        if (!emitted)
        {
            await scope.RefundAsync();
        }
    }

    private async Task<string?> MeterAsync(string chainConfig, Func<Task<string?>> call, CancellationToken cancellationToken)
    {
        var scope = await ReserveAsync(chainConfig, cancellationToken);
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
    private async Task<CreditReservation> ReserveAsync(string chainConfig, CancellationToken cancellationToken)
    {
        var costs = _chainCosts ??= BuildChainCosts();
        if (!costs.TryGetValue(chainConfig, out var cost) || cost <= 0m)
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
        return new CreditReservation(usage, aiUsageLedgerRepository, cost, logger, userId.Value);
    }

    private Dictionary<string, decimal> BuildChainCosts()
    {
        return new Dictionary<string, decimal>(StringComparer.Ordinal)
        {
            [_config.Ai.FallbackChains.PlanText] = AiCreditPolicy.PlanUploadCost,
            [_config.Ai.FallbackChains.PlanVision] = AiCreditPolicy.PlanUploadCost,
            [_config.Ai.FallbackChains.BatchCooking] = AiCreditPolicy.BatchCookingCost,
            [_config.Ai.FallbackChains.RecipeAi] = AiCreditPolicy.RecipeAiCost,
            [_config.Ai.FallbackChains.RecipeVision] = AiCreditPolicy.RecipeAiCost,
            [_config.Ai.FallbackChains.Translation] = AiCreditPolicy.TranslationCost,
        };
    }

    private sealed class CreditReservation(
        Domain.Entities.AiUsageWeekly? usage,
        IAiUsageLedgerRepository? repository,
        decimal cost,
        ILogger logger,
        long userId)
    {
        private bool _refunded;

        public static CreditReservation Unmetered() => new(null, null, 0m, NullLogger.Instance, 0);

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
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to refund {Cost} AI credits for user {UserId}.", cost, userId);
            }
        }
    }
}
