namespace VitalityNutri.Domain.Entities;

/// <summary>
/// Single-use verification tokens for sensitive account operations
/// (e.g., email change confirmation links sent over SMTP).
/// Intentionally NOT covered by the tenant query filter: verification happens pre-authentication.
/// </summary>
public sealed class UserVerificationToken
{
    public const string TypeEmailChange = "EmailChange";

    public long Id { get; private set; }
    public long UserId { get; private set; }
    public string Type { get; private set; } = string.Empty;
    /// <summary>SHA-256 of the raw token; the raw token only ever exists in the emailed link.</summary>
    public string TokenHash { get; private set; } = string.Empty;
    /// <summary>Email pending confirmation (email change scenario).</summary>
    public string? PendingEmail { get; private set; }
    public DateTimeOffset ExpiresAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset? ConsumedAtUtc { get; private set; }

    private UserVerificationToken()
    {
    }

    public UserVerificationToken(
        long userId,
        string type,
        string tokenHash,
        string? pendingEmail,
        TimeSpan lifetime)
    {
        UserId = userId;
        Type = type.Trim();
        TokenHash = tokenHash;
        PendingEmail = string.IsNullOrWhiteSpace(pendingEmail) ? null : pendingEmail.Trim().ToLowerInvariant();
        ExpiresAtUtc = DateTimeOffset.UtcNow.Add(lifetime);
        CreatedAtUtc = DateTimeOffset.UtcNow;
    }

    public bool IsUsable => ConsumedAtUtc is null && DateTimeOffset.UtcNow < ExpiresAtUtc;

    public void Consume()
    {
        ConsumedAtUtc = DateTimeOffset.UtcNow;
    }
}
