using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Security;

public sealed class JwtTokenGenerator(ApiConfiguration apiConfiguration) : IJwtTokenGenerator
{
    public string GenerateToken(long userId, string email, string role, string fullName)
    {
        var authConfig = apiConfiguration.Auth;
        var secret = !string.IsNullOrWhiteSpace(authConfig.JwtSecret)
            ? authConfig.JwtSecret
            : "VitalityNutri_Default_Development_Secret_Salt_Key_64_Characters_Long_Minimum!";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Email, email),
            new(ClaimTypes.Name, fullName),
            new(ClaimTypes.Role, role),
            new("is_demo", string.Equals(role, "Demo", StringComparison.OrdinalIgnoreCase).ToString().ToLowerInvariant()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(authConfig.ExpirationMinutes > 0 ? authConfig.ExpirationMinutes : 1440),
            Issuer = !string.IsNullOrWhiteSpace(authConfig.Issuer) ? authConfig.Issuer : "VitalityNutri",
            Audience = !string.IsNullOrWhiteSpace(authConfig.Audience) ? authConfig.Audience : "VitalityNutriApp",
            SigningCredentials = credentials
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(randomBytes);
    }
}
