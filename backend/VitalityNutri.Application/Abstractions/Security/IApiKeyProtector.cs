namespace VitalityNutri.Application.Abstractions.Security;

/// <summary>
/// Encrypts user-provided provider API keys before persistence and decrypts them
/// for server-side AI calls. Implementations must never return full plaintext keys
/// through any read path exposed to clients.
/// </summary>
public interface IApiKeyProtector
{
    string Protect(string plainTextApiKey);

    string? Unprotect(string protectedApiKey);

    /// <summary>Returns a stable non-reversible fingerprint (e.g. "sk-...ab12") for UI display.</summary>
    string Mask(string protectedApiKey);
}
