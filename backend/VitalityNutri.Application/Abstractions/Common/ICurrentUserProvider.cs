namespace VitalityNutri.Application.Abstractions.Common;

public interface ICurrentUserProvider
{
    long? GetCurrentUserId();
    string? GetCurrentUserEmail();
    string? GetCurrentUserRole();
    bool IsAuthenticated();
    bool IsDemo();

    /// <summary>Raw refresh token presented with the current request (header/cookie), when available.</summary>
    string? GetCurrentRefreshToken();
}
