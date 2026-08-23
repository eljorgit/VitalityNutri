namespace VitalityNutri.Application.Abstractions.Common;

public interface IJwtTokenGenerator
{
    string GenerateToken(long userId, string email, string role, string fullName);
    string GenerateRefreshToken();
}
