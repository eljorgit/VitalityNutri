using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using VitalityNutri.Application.Abstractions.Common;

namespace VitalityNutri.Api.Infrastructure;

/// <summary>
/// Resolves the authenticated user context from HTTP claims and cookies.
/// </summary>
public sealed class HttpCurrentUserProvider(IHttpContextAccessor httpContextAccessor) : ICurrentUserProvider
{
    /// <summary>
    /// Gets the unique ID of the currently authenticated user, or null if unauthenticated.
    /// </summary>
    public long? GetCurrentUserId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user is null || !user.Identity?.IsAuthenticated == true)
        {
            return null;
        }

        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;

        if (long.TryParse(idClaim, out var id))
        {
            return id;
        }

        return null;
    }

    /// <summary>
    /// Gets the email of the currently authenticated user.
    /// </summary>
    public string? GetCurrentUserEmail()
    {
        var user = httpContextAccessor.HttpContext?.User;
        return user?.FindFirst(ClaimTypes.Email)?.Value
            ?? user?.FindFirst("email")?.Value;
    }

    /// <summary>
    /// Gets the role of the currently authenticated user.
    /// </summary>
    public string? GetCurrentUserRole()
    {
        var user = httpContextAccessor.HttpContext?.User;
        return user?.FindFirst(ClaimTypes.Role)?.Value
            ?? user?.FindFirst("role")?.Value;
    }

    /// <summary>
    /// Determines whether the current request is authenticated.
    /// </summary>
    public bool IsAuthenticated()
    {
        var user = httpContextAccessor.HttpContext?.User;
        return user?.Identity?.IsAuthenticated == true;
    }

    /// <summary>
    /// Determines whether the current user is in demo mode.
    /// </summary>
    public bool IsDemo()
    {
        var role = GetCurrentUserRole();
        if (string.Equals(role, "Demo", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var user = httpContextAccessor.HttpContext?.User;
        var demoClaim = user?.FindFirst("is_demo")?.Value;
        if (string.Equals(demoClaim, "true", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Legacy fallback: tokens issued before the evaluator-to-demo rename.
        var legacyRole = role;
        if (string.Equals(legacyRole, "Evaluator", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var legacyClaim = user?.FindFirst("is_evaluator")?.Value;
        return string.Equals(legacyClaim, "true", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Raw refresh token presented with the current request (X-Refresh-Token header or cookie).
    /// </summary>
    public string? GetCurrentRefreshToken()
    {
        var context = httpContextAccessor.HttpContext;
        if (context is null)
        {
            return null;
        }

        if (context.Request.Headers.TryGetValue("X-Refresh-Token", out var header) &&
            !string.IsNullOrWhiteSpace(header))
        {
            return header.ToString();
        }

        return context.Request.Cookies.TryGetValue("refreshToken", out var cookie) && !string.IsNullOrWhiteSpace(cookie)
            ? cookie
            : null;
    }
}
