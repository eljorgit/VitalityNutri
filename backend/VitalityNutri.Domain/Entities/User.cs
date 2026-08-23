namespace VitalityNutri.Domain.Entities;

public sealed class User
{
    public long Id { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string PasswordSalt { get; private set; } = string.Empty;
    public string FirstName { get; private set; } = string.Empty;
    public string Surname { get; private set; } = string.Empty;
    public string Role { get; private set; } = "User"; // "User", "Admin", "Demo"
    public string AuthProvider { get; private set; } = "local"; // "local", "google", "apple", "demo"
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public bool IsActive { get; private set; }

    /// <summary>Computed display name (not persisted). Kept for JWT/display backward compatibility.</summary>
    public string FullName => ComposeDisplayName(FirstName, Surname, Email);

    private User()
    {
    }

    public User(
        string email,
        string passwordHash,
        string passwordSalt,
        string firstName,
        string surname,
        string role = "User",
        string authProvider = "local")
    {
        Email = email.Trim().ToLowerInvariant();
        PasswordHash = passwordHash;
        PasswordSalt = passwordSalt;
        FirstName = firstName.Trim();
        Surname = surname.Trim();
        if (string.IsNullOrWhiteSpace(FirstName))
        {
            FirstName = Email;
        }
        Role = string.IsNullOrWhiteSpace(role) ? "User" : role.Trim();
        AuthProvider = string.IsNullOrWhiteSpace(authProvider) ? "local" : authProvider.Trim().ToLowerInvariant();
        IsActive = true;
        CreatedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAtUtc = CreatedAtUtc;
    }

    public void UpdateProfile(string firstName, string surname)
    {
        if (!string.IsNullOrWhiteSpace(firstName))
        {
            FirstName = firstName.Trim();
        }
        Surname = surname?.Trim() ?? string.Empty;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void UpdateEmail(string newEmail)
    {
        Email = newEmail.Trim().ToLowerInvariant();
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void UpdatePassword(string newHash, string newSalt)
    {
        PasswordHash = newHash;
        PasswordSalt = newSalt;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    /// <summary>Splits a legacy display name ("Name Surname") into first/surname parts.</summary>
    public static (string FirstName, string Surname) SplitDisplayName(string? displayName)
    {
        var trimmed = displayName?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            return (string.Empty, string.Empty);
        }

        var separatorIndex = trimmed.IndexOf(' ');
        return separatorIndex < 0
            ? (trimmed, string.Empty)
            : (trimmed[..separatorIndex].Trim(), trimmed[(separatorIndex + 1)..].Trim());
    }

    private static string ComposeDisplayName(string firstName, string surname, string email)
    {
        var composed = $"{firstName} {surname}".Trim();
        return composed.Length > 0 ? composed : email;
    }
}
