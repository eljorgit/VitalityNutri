using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Api.Controllers.AppInfo;

/// <summary>
/// Platform metadata and runtime capabilities endpoint for client auto-discovery.
/// </summary>
[ApiController]
[Route("api/app-info")]
[AllowAnonymous]
public sealed class AppInfoController(ApiConfiguration apiConfiguration) : ControllerBase
{
    /// <summary>
    /// Retrieves application mode and enabled authentication providers.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AppInfoDto), StatusCodes.Status200OK)]
    public IActionResult GetAppInfo()
    {
        var isSaaS = string.Equals(apiConfiguration.App.Mode, "SaaS", StringComparison.OrdinalIgnoreCase);

        var dto = new AppInfoDto(
            Mode: isSaaS ? "SaaS" : "Oss",
            Version: "0.2.0",
            Auth: new AuthCapabilitiesDto(
                GoogleEnabled: isSaaS && apiConfiguration.Auth.Google.Enabled,
                AppleEnabled: isSaaS && apiConfiguration.Auth.Apple.Enabled,
                DemoEnabled: isSaaS));

        return Ok(dto);
    }
}

/// <summary>
/// Public application metadata and capability flags.
/// </summary>
/// <param name="Mode">Active platform mode ("Oss" or "SaaS").</param>
/// <param name="Version">Current backend build version.</param>
/// <param name="Auth">Authentication provider availability.</param>
public sealed record AppInfoDto(
    string Mode,
    string Version,
    AuthCapabilitiesDto Auth);

/// <summary>
/// Authentication provider availability flags.
/// </summary>
/// <param name="GoogleEnabled">Whether Google OAuth Sign-In is enabled.</param>
/// <param name="AppleEnabled">Whether Apple Sign-In is enabled.</param>
/// <param name="DemoEnabled">Whether 1-Click demo mode is active.</param>
public sealed record AuthCapabilitiesDto(
    bool GoogleEnabled,
    bool AppleEnabled,
    bool DemoEnabled);
