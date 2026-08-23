namespace VitalityNutri.Domain.Entities;

/// <summary>Per-user AI settings: platform-vs-BYOK mode and per-chain overrides.</summary>
public sealed class UserAiSettings
{
    public const string ModePlatform = "Platform";
    public const string ModeByok = "Byok";

    public long Id { get; private set; }
    public long UserId { get; private set; }
    public string Mode { get; private set; } = ModePlatform;
    /// <summary>
    /// JSON map of named chain -> ordered override tokens, e.g.
    /// {"PlanVision":["#12:gemini-2.5-flash","#15:model-x"]}. "#&lt;keyId&gt;" references UserAiProviderKey.Id.
    /// </summary>
    public string ChainOverridesJson { get; private set; } = "{}";
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private UserAiSettings()
    {
    }

    public UserAiSettings(long userId)
    {
        UserId = userId;
        Mode = ModePlatform;
        ChainOverridesJson = "{}";
        CreatedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAtUtc = CreatedAtUtc;
    }

    public void SetMode(string mode)
    {
        Mode = mode;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void ReplaceChainOverrides(string chainOverridesJson)
    {
        ChainOverridesJson = chainOverridesJson;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}
