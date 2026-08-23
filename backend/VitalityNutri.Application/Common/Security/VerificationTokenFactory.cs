using System.Security.Cryptography;
using System.Text;

namespace VitalityNutri.Application.Common.Security;

public static class VerificationTokenFactory
{
    /// <summary>URL-safe 256-bit random token; only ever exists inside the emailed link.</summary>
    public static string GenerateRawToken()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static string HashToken(string rawToken)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();
    }
}
