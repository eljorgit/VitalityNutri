namespace VitalityNutri.Application.Abstractions.Common;

public sealed record GoogleUserProfile(string Email, string FullName, string SubjectId);

public interface IGoogleAuthValidator
{
    Task<GoogleUserProfile?> ValidateIdTokenAsync(string idToken, CancellationToken cancellationToken = default);
}
