using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Infrastructure.Processing.Ai;

/// <summary>Bridges the Application-layer catalog abstraction to the concrete provider adapters.</summary>
internal sealed class AiProviderCatalog(IByokProviderRegistry registry) : IAiProviderCatalog
{
    public Task<(bool IsValid, string? Error)> ValidateKeyAsync(string providerType, string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
    {
        var adapter = ResolveOrThrow(providerType);
        return adapter.ValidateAsync(apiKey, baseUrl, cancellationToken)
            .ContinueWith(t => (t.Result.Success, t.Result.Error), cancellationToken);
    }

    public async Task<IReadOnlyList<string>> ListModelsAsync(string providerType, string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
    {
        var adapter = ResolveOrThrow(providerType);
        try
        {
            return await adapter.ListModelsAsync(apiKey, baseUrl, cancellationToken);
        }
        catch (ByokProviderException ex)
        {
            throw new InvalidOperationException(ex.Message, ex);
        }
    }

    private IByokProviderAdapter ResolveOrThrow(string providerType) =>
        registry.Resolve(providerType)
            ?? throw new ArgumentException($"Unsupported AI provider '{providerType}'.");
}
