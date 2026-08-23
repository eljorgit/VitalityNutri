using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Security;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class JwtTokenGeneratorTests
{
    [Fact]
    public void GenerateToken_ProducesValidJwtWithExpectedClaims()
    {
        var config = new ApiConfiguration
        {
            Auth = new AuthConfiguration
            {
                JwtSecret = "Test_Secret_Key_For_Unit_Tests_That_Is_Long_Enough_To_Satisfy_HmacSha256_Requirement!!",
                Issuer = "VitalityNutriTest",
                Audience = "VitalityNutriAppTest",
                ExpirationMinutes = 60
            }
        };

        var generator = new JwtTokenGenerator(config);
        var tokenString = generator.GenerateToken(
            userId: 42,
            email: "demo@vitalitynutri.com",
            role: "Demo",
            fullName: "Usuario Demostración");

        Assert.NotEmpty(tokenString);

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(tokenString);

        Assert.Equal("VitalityNutriTest", jwt.Issuer);
        Assert.Contains("VitalityNutriAppTest", jwt.Audiences);

        var subClaim = jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub || c.Type == ClaimTypes.NameIdentifier);
        Assert.NotNull(subClaim);
        Assert.Equal("42", subClaim.Value);

        var emailClaim = jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Email || c.Type == ClaimTypes.Email);
        Assert.NotNull(emailClaim);
        Assert.Equal("demo@vitalitynutri.com", emailClaim.Value);

        var roleClaim = jwt.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role");
        Assert.NotNull(roleClaim);
        Assert.Equal("Demo", roleClaim.Value);

        var demoClaim = jwt.Claims.FirstOrDefault(c => c.Type == "is_demo");
        Assert.NotNull(demoClaim);
        Assert.Equal("true", demoClaim.Value);
    }

    [Fact]
    public void GenerateRefreshToken_ProducesNonEmptyBase64String()
    {
        var generator = new JwtTokenGenerator(new ApiConfiguration
        {
            Auth = new AuthConfiguration
            {
                JwtSecret = "Test_Secret_Key_For_Unit_Tests_That_Is_Long_Enough_To_Satisfy_HmacSha256_Requirement!!"
            }
        });
        var rt1 = generator.GenerateRefreshToken();
        var rt2 = generator.GenerateRefreshToken();

        Assert.NotEmpty(rt1);
        Assert.NotEmpty(rt2);
        Assert.NotEqual(rt1, rt2);
    }
}
