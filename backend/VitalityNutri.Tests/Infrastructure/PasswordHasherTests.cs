using VitalityNutri.Infrastructure.Security;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class PasswordHasherTests
{
    private readonly Pbkdf2PasswordHasher _hasher = new();

    [Fact]
    public void HashPassword_GeneratesUniqueSaltsAndHashes()
    {
        var password = "SecurePassword123!";
        var (hash1, salt1) = _hasher.HashPassword(password);
        var (hash2, salt2) = _hasher.HashPassword(password);

        Assert.NotEmpty(hash1);
        Assert.NotEmpty(salt1);
        Assert.NotEmpty(hash2);
        Assert.NotEmpty(salt2);

        // Different salts should produce different hashes for the same password
        Assert.NotEqual(salt1, salt2);
        Assert.NotEqual(hash1, hash2);
    }

    [Fact]
    public void VerifyPassword_ReturnsTrue_ForCorrectPassword()
    {
        var password = "CorrectMasterPassword2026!";
        var (hash, salt) = _hasher.HashPassword(password);

        var isValid = _hasher.VerifyPassword(password, hash, salt);

        Assert.True(isValid);
    }

    [Fact]
    public void VerifyPassword_ReturnsFalse_ForIncorrectPassword()
    {
        var (hash, salt) = _hasher.HashPassword("ActualPassword");

        var isValid = _hasher.VerifyPassword("WrongPassword", hash, salt);

        Assert.False(isValid);
    }

    [Theory]
    [InlineData("", "hash", "salt")]
    [InlineData("password", "", "salt")]
    [InlineData("password", "hash", "")]
    public void VerifyPassword_ReturnsFalse_ForInvalidInputs(string password, string hash, string salt)
    {
        var isValid = _hasher.VerifyPassword(password, hash, salt);
        Assert.False(isValid);
    }
}
