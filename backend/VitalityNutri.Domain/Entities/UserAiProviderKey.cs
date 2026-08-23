namespace VitalityNutri.Domain.Entities;

/// <summary>
/// A BYOK (bring-your-own-key) provider credential registered by a user.
/// ProviderType is an open string so new providers can be added without schema changes.
/// </summary>
public sealed class UserAiProviderKey
{
    public long Id { get; private set; }
    public long UserId { get; private set; }
    public string ProviderType { get; private set; } = string.Empty;
    public string Alias { get; private set; } = string.Empty;
    public string EncryptedApiKey { get; private set; } = string.Empty;
    public string KeyLast4 { get; private set; } = string.Empty;
    public string? BaseUrl { get; private set; }
    public bool IsValidated { get; private set; }
    public DateTimeOffset? ValidatedAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private UserAiProviderKey()
    {
    }

    public UserAiProviderKey(
        long userId,
        string providerType,
        string alias,
        string encryptedApiKey,
        string keyLast4,
        string? baseUrl = null)
    {
        UserId = userId;
        ProviderType = providerType.Trim().ToLowerInvariant();
        Alias = alias.Trim();
        EncryptedApiKey = encryptedApiKey;
        KeyLast4 = keyLast4;
        BaseUrl = string.IsNullOrWhiteSpace(baseUrl) ? null : baseUrl.Trim();
        IsValidated = false;
        CreatedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAtUtc = CreatedAtUtc;
    }

    public void UpdateAlias(string alias)
    {
        Alias = alias.Trim();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    /// <summary>Replaces the stored key and invalidates prior validation.</summary>
    public void UpdateKey(string encryptedApiKey, string keyLast4)
    {
        EncryptedApiKey = encryptedApiKey;
        KeyLast4 = keyLast4;
        IsValidated = false;
        ValidatedAtUtc = null;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void UpdateBaseUrl(string? baseUrl)
    {
        BaseUrl = string.IsNullOrWhiteSpace(baseUrl) ? null : baseUrl.Trim();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void MarkValidated()
    {
        IsValidated = true;
        ValidatedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAtUtc = ValidatedAtUtc.Value;
    }
}
