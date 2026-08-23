using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Security;

namespace VitalityNutri.Infrastructure.Processing.Ai;

/// <summary>Decrypted BYOK credentials for a single AI call.</summary>
public sealed record ByokCredentials(string ProviderType, string ApiKey, string? BaseUrl);

/// <summary>
/// Resolves "#&lt;keyId&gt;" chain tokens into decrypted provider credentials for the
/// current authenticated user. Returns null when the caller is anonymous, the key
/// does not belong to them, or it can no longer be decrypted.
/// </summary>
public interface IByokCredentialResolver
{
    Task<ByokCredentials?> ResolveAsync(string token, CancellationToken cancellationToken = default);
}

public sealed class ByokCredentialResolver(
    IUserAiSettingsRepository aiSettingsRepository,
    ICurrentUserProvider currentUserProvider,
    IApiKeyProtector apiKeyProtector) : IByokCredentialResolver
{
    public async Task<ByokCredentials?> ResolveAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || !token.StartsWith('#'))
        {
            return null;
        }

        if (!long.TryParse(token.AsSpan(1), out var keyId))
        {
            return null;
        }

        var userId = currentUserProvider.GetCurrentUserId();
        if (userId is null || currentUserProvider.IsDemo())
        {
            return null;
        }

        var key = await aiSettingsRepository.GetKeyAsync(userId.Value, keyId, cancellationToken);
        if (key is null)
        {
            return null;
        }

        var plain = apiKeyProtector.Unprotect(key.EncryptedApiKey);
        if (string.IsNullOrWhiteSpace(plain))
        {
            return null;
        }

        return new ByokCredentials(NormalizeProviderType(key.ProviderType), plain, key.BaseUrl);
    }

    private static string NormalizeProviderType(string providerType)
    {
        var normalized = providerType.Trim().ToLowerInvariant();
        // "openai-compatible" routes through the OpenAI chat-completions path with a custom base URL.
        return normalized.Length == 0 ? "openai" : normalized;
    }
}
