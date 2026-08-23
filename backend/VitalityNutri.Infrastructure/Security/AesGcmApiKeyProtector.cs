using System.Security.Cryptography;
using System.Text;
using VitalityNutri.Application.Abstractions.Security;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Security;

/// <summary>
/// Encrypts user provider API keys with AES-256-GCM. The data-encryption key is derived
/// from the server's JwtSecret via HKDF, so ciphertexts survive container restarts and
/// require no external key-ring state.
/// </summary>
public sealed class AesGcmApiKeyProtector(ApiConfiguration apiConfiguration) : IApiKeyProtector
{
    private const int NonceSizeBytes = 12;
    private const int TagSizeBytes = 16;
    private const string HkdfInfo = "VitalityNutri.UserApiKeys.v1";

    private readonly byte[] _derivedKey = DeriveKey(apiConfiguration.Auth.JwtSecret);

    public string Protect(string plainTextApiKey)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(plainTextApiKey);

        var plain = Encoding.UTF8.GetBytes(plainTextApiKey);
        var nonce = RandomNumberGenerator.GetBytes(NonceSizeBytes);
        var cipherText = new byte[plain.Length];
        var tag = new byte[TagSizeBytes];

        using var aes = new AesGcm(_derivedKey, TagSizeBytes);
        aes.Encrypt(nonce, plain, cipherText, tag);

        var payload = new byte[NonceSizeBytes + cipherText.Length + TagSizeBytes];
        Buffer.BlockCopy(nonce, 0, payload, 0, NonceSizeBytes);
        Buffer.BlockCopy(cipherText, 0, payload, NonceSizeBytes, cipherText.Length);
        Buffer.BlockCopy(tag, 0, payload, NonceSizeBytes + cipherText.Length, TagSizeBytes);

        return Convert.ToBase64String(payload);
    }

    public string? Unprotect(string protectedApiKey)
    {
        if (string.IsNullOrWhiteSpace(protectedApiKey))
        {
            return null;
        }

        try
        {
            var payload = Convert.FromBase64String(protectedApiKey);
            if (payload.Length < NonceSizeBytes + TagSizeBytes)
            {
                return null;
            }

            var nonce = payload.AsSpan(0, NonceSizeBytes);
            var cipherText = payload.AsSpan(NonceSizeBytes, payload.Length - NonceSizeBytes - TagSizeBytes);
            var tag = payload.AsSpan(payload.Length - TagSizeBytes);
            var plain = new byte[cipherText.Length];

            using var aes = new AesGcm(_derivedKey, TagSizeBytes);
            aes.Decrypt(nonce, cipherText, tag, plain);

            return Encoding.UTF8.GetString(plain);
        }
        catch (FormatException)
        {
            return null;
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    public string Mask(string protectedApiKey)
    {
        var plain = Unprotect(protectedApiKey);
        if (string.IsNullOrEmpty(plain))
        {
            return "••••";
        }

        var suffix = plain.Length <= 4 ? plain : plain[^4..];
        return $"••••{suffix}";
    }

    private static byte[] DeriveKey(string secret)
    {
        // RFC 5869 HKDF-SHA256 expand-only step over a high-entropy server secret.
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var infoBytes = Encoding.UTF8.GetBytes(HkdfInfo);
        var okm = new byte[32];
        const int L = 32;
        var t = Array.Empty<byte>();
        var offset = 0;
        var counter = 1;

        while (offset < L)
        {
            var input = new byte[t.Length + infoBytes.Length + 1];
            Buffer.BlockCopy(t, 0, input, 0, t.Length);
            Buffer.BlockCopy(infoBytes, 0, input, t.Length, infoBytes.Length);
            input[^1] = (byte)counter;
            t = hmac.ComputeHash(input);

            var toCopy = Math.Min(t.Length, L - offset);
            Buffer.BlockCopy(t, 0, okm, offset, toCopy);
            offset += toCopy;
            counter++;
        }

        return okm;
    }
}
