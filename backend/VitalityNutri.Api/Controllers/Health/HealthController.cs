using Microsoft.AspNetCore.Mvc;

namespace VitalityNutri.Api.Controllers.Health;

/// <summary>
/// Exposes service health information.
/// </summary>
[ApiController]
[Microsoft.AspNetCore.Authorization.AllowAnonymous]
public sealed class HealthController : ControllerBase
{
    /// <summary>
    /// Returns the current API health status.
    /// </summary>
    /// <returns>The API status and current UTC timestamp.</returns>
    [HttpGet("/health", Name = "Health")]
    [ProducesResponseType<HealthResponse>(StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get()
    {
        return Ok(new HealthResponse(
            "ok",
            DateTimeOffset.UtcNow));
    }
}

/// <summary>
/// Describes the current API health status.
/// </summary>
/// <param name="Status">The service health state.</param>
/// <param name="Utc">The current UTC timestamp.</param>
public sealed record HealthResponse(
    string Status,
    DateTimeOffset Utc);