using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Security;

public sealed class AppleAuthValidator(
    ApiConfiguration apiConfiguration,
    IHttpClientFactory httpClientFactory) : IAppleAuthValidator
{
    private const string AppleIssuer = "https://appleid.apple.com";
    private const string AppleJwksUrl = "https://appleid.apple.com/auth/keys";

    private static JsonWebKeySet? _cachedJwks;
    private static DateTimeOffset _jwksExpiry = DateTimeOffset.MinValue;
    private static readonly SemaphoreSlim JwksLock = new(1, 1);

    public async Task<AppleUserProfile?> ValidateIdTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            return null;
        }

        try
        {
            var handler = new JwtSecurityTokenHandler();
            if (!handler.CanReadToken(idToken))
            {
                return null;
            }

            var jwt = handler.ReadJwtToken(idToken);
            var kid = jwt.Header.Kid;
            if (string.IsNullOrWhiteSpace(kid))
            {
                return null;
            }

            var jwks = await GetAppleJwksAsync(cancellationToken);
            if (jwks is null)
            {
                return null;
            }

            var matchingKey = jwks.Keys.FirstOrDefault(k => string.Equals(k.Kid, kid, StringComparison.Ordinal));
            if (matchingKey is null)
            {
                // Force refresh JWKS once in case key was rotated
                jwks = await RefreshAppleJwksAsync(cancellationToken);
                matchingKey = jwks?.Keys.FirstOrDefault(k => string.Equals(k.Kid, kid, StringComparison.Ordinal));
                if (matchingKey is null)
                {
                    return null;
                }
            }

            var appleConfig = apiConfiguration.Auth.Apple;
            var validateAudience = appleConfig.Enabled && !string.IsNullOrWhiteSpace(appleConfig.ClientId);

            var validationParameters = new TokenValidationParameters
            {
                ValidIssuer = AppleIssuer,
                ValidateIssuer = true,
                ValidateAudience = validateAudience,
                ValidAudience = appleConfig.ClientId,
                IssuerSigningKey = matchingKey,
                ValidateIssuerSigningKey = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(5)
            };

            var principal = handler.ValidateToken(idToken, validationParameters, out _);

            var email = principal.FindFirst(ClaimTypes.Email)?.Value
                ?? principal.FindFirst("email")?.Value;

            var sub = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? principal.FindFirst("sub")?.Value
                ?? jwt.Subject;

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(sub))
            {
                return null;
            }

            return new AppleUserProfile(
                Email: email,
                FullName: null,
                SubjectId: sub);
        }
        catch
        {
            return null;
        }
    }

    private async Task<JsonWebKeySet?> GetAppleJwksAsync(CancellationToken cancellationToken)
    {
        if (_cachedJwks is not null && DateTimeOffset.UtcNow < _jwksExpiry)
        {
            return _cachedJwks;
        }

        return await RefreshAppleJwksAsync(cancellationToken);
    }

    private async Task<JsonWebKeySet?> RefreshAppleJwksAsync(CancellationToken cancellationToken)
    {
        await JwksLock.WaitAsync(cancellationToken);
        try
        {
            if (_cachedJwks is not null && DateTimeOffset.UtcNow < _jwksExpiry)
            {
                return _cachedJwks;
            }

            var client = httpClientFactory.CreateClient();
            var json = await client.GetStringAsync(AppleJwksUrl, cancellationToken);
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            var jwks = new JsonWebKeySet(json);
            _cachedJwks = jwks;
            _jwksExpiry = DateTimeOffset.UtcNow.AddHours(24);
            return jwks;
        }
        catch
        {
            return null;
        }
        finally
        {
            JwksLock.Release();
        }
    }
}
