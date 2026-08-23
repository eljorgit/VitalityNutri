using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.AiSettings;

/// <summary>Named chains that can carry per-user overrides; must mirror UnifiedAiGateway chain names.</summary>
public static class NamedAiChains
{
    public static readonly IReadOnlyList<string> All =
    [
        "PlanText",
        "PlanVision",
        "BatchCooking",
        "RecipeAi",
        "RecipeVision",
        "Translation"
    ];

    public static bool IsValid(string name) =>
        All.Any(c => string.Equals(c, name.Trim(), StringComparison.OrdinalIgnoreCase));
}

public sealed record ProviderKeyDto(
    long Id,
    string ProviderType,
    string Alias,
    string MaskedKey,
    string? BaseUrl,
    bool IsValidated,
    DateTimeOffset? ValidatedAtUtc,
    DateTimeOffset CreatedAtUtc);

public sealed record ChainOverrideDto(string ChainName, IReadOnlyList<string> Tokens);

public sealed record AiSettingsDto(
    string Mode,
    IReadOnlyList<ProviderKeyDto> ProviderKeys,
    IReadOnlyList<ChainOverrideDto> ChainOverrides,
    IReadOnlyList<string> AvailableChains,
    decimal WeeklyPlatformLimit,
    decimal CreditsUsedThisWeek,
    DateTimeOffset CurrentWeekStartUtc);

internal static class AiSettingsMapper
{
    public static AiSettingsDto ToDto(
        UserAiSettings settings,
        IReadOnlyCollection<UserAiProviderKey> keys,
        decimal weeklyPlatformLimit,
        decimal creditsUsedThisWeek,
        DateOnly weekStartUtc)
    {
        var overrides = new List<ChainOverrideDto>();
        if (!string.IsNullOrWhiteSpace(settings.ChainOverridesJson))
        {
            try
            {
                var parsed = System.Text.Json.JsonSerializer.Deserialize<
                    Dictionary<string, System.Text.Json.JsonElement>>(settings.ChainOverridesJson);
                if (parsed is not null)
                {
                    foreach (var (chain, element) in parsed)
                    {
                        if (element.ValueKind == System.Text.Json.JsonValueKind.Array)
                        {
                            var tokens = element.EnumerateArray()
                                .Where(e => e.ValueKind == System.Text.Json.JsonValueKind.String)
                                .Select(e => e.GetString()!)
                                .Where(s => !string.IsNullOrWhiteSpace(s))
                                .ToList();
                            if (tokens.Count > 0)
                            {
                                overrides.Add(new ChainOverrideDto(chain, tokens));
                            }
                        }
                    }
                }
            }
            catch (System.Text.Json.JsonException)
            {
                // Corrupt JSON should never happen (we always serialize it ourselves); surface empty list.
            }
        }

        return new AiSettingsDto(
            settings.Mode,
            [.. keys.Select(k => new ProviderKeyDto(
                k.Id,
                k.ProviderType,
                k.Alias,
                $"••••{k.KeyLast4}",
                k.BaseUrl,
                k.IsValidated,
                k.ValidatedAtUtc,
                k.CreatedAtUtc))],
            overrides,
            NamedAiChains.All,
            weeklyPlatformLimit,
            creditsUsedThisWeek,
            weekStartUtc.ToDateTime(TimeOnly.MinValue));
    }
}
