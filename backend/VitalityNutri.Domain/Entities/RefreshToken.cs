namespace VitalityNutri.Domain.Entities;

public sealed class RefreshToken
{
    public long Id { get; private set; }
    public long UserId { get; private set; }
    public string Token { get; private set; } = string.Empty;
    public DateTimeOffset ExpiresAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public bool IsRevoked { get; private set; }

    // Session metadata (nullable for legacy rows created before session tracking).
    public string? UserAgent { get; private set; }
    public string? IpAddress { get; private set; }
    public DateTimeOffset LastUsedAtUtc { get; private set; }

    private RefreshToken()
    {
    }

    public RefreshToken(
        long userId,
        string token,
        DateTimeOffset expiresAtUtc,
        string? userAgent = null,
        string? ipAddress = null)
    {
        UserId = userId;
        Token = token;
        ExpiresAtUtc = expiresAtUtc;
        CreatedAtUtc = DateTimeOffset.UtcNow;
        LastUsedAtUtc = CreatedAtUtc;
        IsRevoked = false;
        UserAgent = userAgent;
        IpAddress = ipAddress;
    }

    /// <summary>Rotates the token in place, preserving session identity for the sessions screen.</summary>
    public void RotateTo(string newToken, DateTimeOffset expiresAtUtc)
    {
        Token = newToken;
        ExpiresAtUtc = expiresAtUtc;
        LastUsedAtUtc = DateTimeOffset.UtcNow;
    }

    public void MarkUsed(string? userAgent, string? ipAddress)
    {
        LastUsedAtUtc = DateTimeOffset.UtcNow;
        if (!string.IsNullOrWhiteSpace(userAgent))
        {
            UserAgent = userAgent;
        }
        if (!string.IsNullOrWhiteSpace(ipAddress))
        {
            IpAddress = ipAddress;
        }
    }

    public void Revoke()
    {
        IsRevoked = true;
    }

    public bool IsActive => !IsRevoked && DateTimeOffset.UtcNow < ExpiresAtUtc;
}
