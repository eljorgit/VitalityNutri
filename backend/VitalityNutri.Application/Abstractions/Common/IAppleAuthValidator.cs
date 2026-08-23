namespace VitalityNutri.Application.Abstractions.Common;

public sealed record AppleUserProfile(string Email, string? FullName, string SubjectId);

public interface IAppleAuthValidator
{
    Task<AppleUserProfile?> ValidateIdTokenAsync(string idToken, CancellationToken cancellationToken = default);
}
