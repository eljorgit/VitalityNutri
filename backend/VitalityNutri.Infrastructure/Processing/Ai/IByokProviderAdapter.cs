using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace VitalityNutri.Infrastructure.Processing.Ai;

/// <summary>Thrown when a provider rejects a BYOK credential or model-list request.</summary>
public sealed class ByokProviderException(string message) : Exception(message);

/// <summary>Outcome of validating a user-supplied provider API key.</summary>
public sealed record ByokValidationResult(bool Success, string? Error = null)
{
    public IReadOnlyList<string> Models { get; init; } = [];
}

/// <summary>
/// Adapter contract so newly supported providers can be plugged in without schema or
/// UI changes. Implementations validate credentials and list usable model ids.
/// </summary>
public interface IByokProviderAdapter
{
    /// <summary>Lowercase provider type stored in UserAiProviderKey.ProviderType.</summary>
    string ProviderType { get; }

    bool SupportsMultimodal { get; }

    Task<ByokValidationResult> ValidateAsync(string apiKey, string? baseUrl, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ListModelsAsync(string apiKey, string? baseUrl, CancellationToken cancellationToken = default);
}

/// <summary>Resolves BYOK adapters by provider type.</summary>
public interface IByokProviderRegistry
{
    IByokProviderAdapter? Resolve(string providerType);

    IReadOnlyList<IByokProviderAdapter> All { get; }
}

public sealed class ByokProviderRegistry(IEnumerable<IByokProviderAdapter> adapters) : IByokProviderRegistry
{
    private readonly Dictionary<string, IByokProviderAdapter> _adapters =
        adapters.ToDictionary(a => a.ProviderType, StringComparer.OrdinalIgnoreCase);

    public IByokProviderAdapter? Resolve(string providerType) =>
        _adapters.TryGetValue(providerType.Trim().ToLowerInvariant(), out var adapter) ? adapter : null;

    public IReadOnlyList<IByokProviderAdapter> All => [.. _adapters.Values];
}

internal static class ByokHttpErrorDescriber
{
    public static async Task<string> DescribeErrorAsync(HttpResponseMessage response)
    {
        return response.StatusCode switch
        {
            HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden =>
                "The API key was rejected by the provider (unauthorized).",
            HttpStatusCode.TooManyRequests =>
                "The provider rejected the request due to rate limiting. Try again shortly.",
            _ => $"The provider responded with HTTP {(int)response.StatusCode}."
        };
    }
}
