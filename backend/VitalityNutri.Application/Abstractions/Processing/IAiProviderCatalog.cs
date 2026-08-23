namespace VitalityNutri.Application.Abstractions.Processing;

/// <summary>
/// Application-side facade over provider key validation and model discovery,
/// implemented in Infrastructure on top of the concrete BYOK adapters.
/// </summary>
public interface IAiProviderCatalog
{
    Task<(bool IsValid, string? Error)> ValidateKeyAsync(string providerType, string apiKey, string? baseUrl, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ListModelsAsync(string providerType, string apiKey, string? baseUrl, CancellationToken cancellationToken = default);
}

/// <summary>Platform-AI quota limits sourced from configuration.</summary>
public interface IAiCreditLimits
{
    decimal GetWeeklyPlatformLimit();
}
