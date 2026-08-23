namespace VitalityNutri.Application.Auth;

public sealed record UserDto(
    long Id,
    string Email,
    string FirstName,
    string Surname,
    string FullName,
    string Role,
    string AuthProvider,
    bool IsDemo,
    DateTimeOffset CreatedAtUtc);

public sealed record AuthResultDto(
    string Token,
    string? RefreshToken,
    UserDto User,
    string Message = "Success");
