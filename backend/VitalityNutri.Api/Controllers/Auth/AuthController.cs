using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VitalityNutri.Application.Auth;
using VitalityNutri.Application.Auth.AppleLogin;
using VitalityNutri.Application.Auth.DemoLogin;
using VitalityNutri.Application.Auth.GetCurrentUser;
using VitalityNutri.Application.Auth.GoogleLogin;
using VitalityNutri.Application.Auth.LoginUser;
using VitalityNutri.Application.Auth.LogoutUser;
using VitalityNutri.Application.Auth.ManageSessions;
using VitalityNutri.Application.Auth.RegisterUser;
using VitalityNutri.Application.Profile.VerifyEmailChange;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Api.Controllers.Auth;

/// <summary>
/// Authentication and session management controller supporting cookies and JWT tokens.
/// </summary>
[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public sealed class AuthController(
    ISender sender,
    ApiConfiguration apiConfiguration) : ControllerBase
{
    private const string AuthCookieName = "vitality_auth_token";

    /// <summary>
    /// Registers a new user account with email and password.
    /// </summary>
    /// <param name="command">Registration payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("register")]
    [EnableRateLimiting("general-write")]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register([FromBody] RegisterUserCommand command, CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        SetAuthCookie(result.Token);
        return Ok(result);
    }

    /// <summary>
    /// Authenticates a user with email and password credentials.
    /// </summary>
    /// <param name="command">Login credentials.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("login")]
    [EnableRateLimiting("general-write")]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Login([FromBody] LoginUserCommand command, CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        SetAuthCookie(result.Token);
        return Ok(result);
    }

    /// <summary>
    /// 1-Click demo login for instant product demonstration.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("demo-login")]
    [EnableRateLimiting("general-write")]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> DemoLogin(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new DemoLoginCommand(), cancellationToken);
        SetAuthCookie(result.Token);
        return Ok(result);
    }

    /// <summary>
    /// Authenticates or signs up using a Google OAuth ID token.
    /// </summary>
    /// <param name="command">Google OAuth ID token payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("google")]
    [EnableRateLimiting("general-write")]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginCommand command, CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        SetAuthCookie(result.Token);
        return Ok(result);
    }

    /// <summary>
    /// Authenticates or signs up using an Apple Sign-In OAuth ID token.
    /// </summary>
    /// <param name="command">Apple OAuth ID token and optional user full name.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("apple")]
    [EnableRateLimiting("general-write")]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AppleLogin([FromBody] AppleLoginCommand command, CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        SetAuthCookie(result.Token);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves current authenticated user profile and roles.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetCurrentUserQuery(), cancellationToken);
        if (result is null)
        {
            return Unauthorized(new ProblemDetails
            {
                Title = "Unauthorized",
                Detail = "User is not authenticated.",
                Status = StatusCodes.Status401Unauthorized,
                Type = "https://httpstatuses.com/401"
            });
        }
        return Ok(result);
    }

    /// <summary>
    /// Logs out the user, clearing the authentication cookie and revoking tokens.
    /// </summary>
    /// <param name="request">Optional refresh token to revoke.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest? request, CancellationToken cancellationToken)
    {
        await sender.Send(new LogoutUserCommand(request?.RefreshToken), cancellationToken);
        ClearAuthCookie();
        return Ok(new { message = "Logged out successfully" });
    }

    /// <summary>
    /// Exchanges a valid refresh token for a fresh JWT + rotated refresh token.
    /// Rotation is in place: the session row identity is preserved.
    /// </summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("general-write")]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest? request, CancellationToken cancellationToken)
    {
        var rawToken = request?.RefreshToken
            ?? Request.Headers["X-Refresh-Token"].ToString()
            ?? (Request.Cookies.TryGetValue("refreshToken", out var cookie) ? cookie : null);

        if (string.IsNullOrWhiteSpace(rawToken))
        {
            return Unauthorized(new ProblemDetails
            {
                Title = "Unauthorized",
                Detail = "A refresh token is required.",
                Status = StatusCodes.Status401Unauthorized,
                Type = "https://httpstatuses.com/401"
            });
        }

        var result = await sender.Send(new RefreshTokensCommand(rawToken), cancellationToken);
        SetAuthCookie(result.Token);
        return Ok(result);
    }

    /// <summary>
    /// Confirms an email change using the token from the emailed verification link. Anonymous: link-based.
    /// </summary>
    [HttpPost("verify-email-change")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResultDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> VerifyEmailChange([FromBody] VerifyEmailChangeCommand command, CancellationToken cancellationToken)
    {
        var result = await sender.Send(command, cancellationToken);
        SetAuthCookie(result.Token);
        return Ok(result);
    }

    private void SetAuthCookie(string token)
    {
        var authConfig = apiConfiguration.Auth;
        var expirationMinutes = authConfig.ExpirationMinutes > 0 ? authConfig.ExpirationMinutes : 1440;

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddMinutes(expirationMinutes),
            Path = "/"
        };

        Response.Cookies.Append(AuthCookieName, token, cookieOptions);
    }

    private void ClearAuthCookie()
    {
        Response.Cookies.Delete(AuthCookieName, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        });
    }
}

/// <summary>
/// Request payload for user logout.
/// </summary>
/// <param name="RefreshToken">Optional refresh token to revoke.</param>
public sealed record LogoutRequest(string? RefreshToken);

/// <summary>Request payload for token refresh.</summary>
public sealed record RefreshRequest(string? RefreshToken);
