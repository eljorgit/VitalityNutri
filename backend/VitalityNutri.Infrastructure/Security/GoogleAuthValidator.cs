using Google.Apis.Auth;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Security;

public sealed class GoogleAuthValidator(ApiConfiguration apiConfiguration) : IGoogleAuthValidator
{
    public async Task<GoogleUserProfile?> ValidateIdTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            return null;
        }

        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings();
            var googleConfig = apiConfiguration.Auth.Google;
            if (googleConfig.Enabled && !string.IsNullOrWhiteSpace(googleConfig.ClientId))
            {
                settings.Audience = [googleConfig.ClientId];
            }

            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            if (payload is null || string.IsNullOrWhiteSpace(payload.Email))
            {
                return null;
            }

            var name = !string.IsNullOrWhiteSpace(payload.Name)
                ? payload.Name
                : payload.Email.Split('@')[0];

            return new GoogleUserProfile(
                Email: payload.Email,
                FullName: name,
                SubjectId: payload.Subject);
        }
        catch
        {
            return null;
        }
    }
}
