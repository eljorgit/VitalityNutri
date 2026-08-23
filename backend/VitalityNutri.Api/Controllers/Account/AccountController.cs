using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Auth.ManageSessions;
using VitalityNutri.Application.Profile.ChangeEmail;
using VitalityNutri.Application.Profile.ChangePassword;
using VitalityNutri.Application.Profile.GetAiSettings;
using VitalityNutri.Application.Profile.ProviderKeys;
using VitalityNutri.Application.Profile.SaveChainOverrides;
using VitalityNutri.Application.Profile.SetAiMode;
using VitalityNutri.Application.Profile.UpdateProfile;

namespace VitalityNutri.Api.Controllers.Account;

/// <summary>
/// Self-service account management: profile data, email/password changes,
/// AI configuration (platform credits vs BYOK keys and chain overrides), and active sessions.
/// </summary>
[ApiController]
[Route("api/account")]
[Authorize]
public sealed class AccountController(ISender sender) : ControllerBase
{
    // ---------- Profile ----------

    /// <summary>Updates the current user's first name and surname.</summary>
    [HttpPut("profile")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileCommand command, CancellationToken cancellationToken)
        => Ok(await sender.Send(command, cancellationToken));

    /// <summary>Starts the email-change flow; a verification link is emailed to the NEW address.</summary>
    [HttpPost("change-email")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> ChangeEmail([FromBody] ChangeEmailCommand command, CancellationToken cancellationToken)
        => Ok(await sender.Send(command, cancellationToken));

    /// <summary>Confirms an email change using the token from the verification link.</summary>
    [HttpPost("change-password")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordCommand command, CancellationToken cancellationToken)
        => Ok(await sender.Send(command, cancellationToken));

    // ---------- AI settings ----------

    /// <summary>Returns AI mode, BYOK keys, per-chain overrides, and weekly credit usage.</summary>
    [HttpGet("ai-settings")]
    public async Task<IActionResult> GetAiSettings(CancellationToken cancellationToken)
        => Ok(await sender.Send(new GetAiSettingsQuery(), cancellationToken));

    /// <summary>Switches between platform AI ("Platform") and user keys ("Byok").</summary>
    [HttpPut("ai-mode")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> SetAiMode([FromBody] SetAiModeCommand command, CancellationToken cancellationToken)
        => Ok(await sender.Send(command, cancellationToken));

    /// <summary>Replaces all per-chain model overrides for the current user.</summary>
    [HttpPut("chain-overrides")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> SaveChainOverrides([FromBody] SaveChainOverridesCommand command, CancellationToken cancellationToken)
        => Ok(await sender.Send(command, cancellationToken));

    /// <summary>Registers a BYOK provider API key (optionally validating it against the provider first).</summary>
    [HttpPost("provider-keys")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> AddProviderKey([FromBody] AddProviderKeyCommand command, CancellationToken cancellationToken)
        => Ok(await sender.Send(command, cancellationToken));

    /// <summary>Updates a provider key's alias, key material, or base URL.</summary>
    [HttpPut("provider-keys/{keyId:long}")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> UpdateProviderKey(long keyId, [FromBody] UpdateProviderKeyRequest request, CancellationToken cancellationToken)
        => Ok(await sender.Send(new UpdateProviderKeyCommand(keyId, request.Alias, request.ApiKey, request.BaseUrl, request.ValidateImmediately), cancellationToken));

    /// <summary>Deletes a provider key and strips its references from chain overrides.</summary>
    [HttpDelete("provider-keys/{keyId:long}")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> DeleteProviderKey(long keyId, CancellationToken cancellationToken)
        => Ok(await sender.Send(new DeleteProviderKeyCommand(keyId), cancellationToken));

    /// <summary>Re-validates a stored provider key against its provider.</summary>
    [HttpPost("provider-keys/{keyId:long}/validate")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> ValidateProviderKey(long keyId, CancellationToken cancellationToken)
        => Ok(await sender.Send(new ValidateProviderKeyCommand(keyId), cancellationToken));

    /// <summary>Lists models available to a stored provider key.</summary>
    [HttpGet("provider-keys/{keyId:long}/models")]
    public async Task<IActionResult> ListProviderModels(long keyId, CancellationToken cancellationToken)
        => Ok(await sender.Send(new ListProviderModelsQuery(keyId), cancellationToken));

    // ---------- Sessions ----------

    /// <summary>Lists this account's active sessions (current one flagged).</summary>
    [HttpGet("sessions")]
    public async Task<IActionResult> ListSessions(CancellationToken cancellationToken)
        => Ok(await sender.Send(new ListSessionsQuery(), cancellationToken));

    /// <summary>Revokes one of the account's sessions by id.</summary>
    [HttpDelete("sessions/{sessionId:long}")]
    [EnableRateLimiting("general-write")]
    public async Task<IActionResult> RevokeSession(long sessionId, CancellationToken cancellationToken)
        => Ok(new { revoked = await sender.Send(new RevokeSessionCommand(sessionId), cancellationToken) });
}

/// <summary>Payload for updating a provider key without resending unchanged secrets.</summary>
public sealed record UpdateProviderKeyRequest(string? Alias, string? ApiKey, string? BaseUrl, bool ValidateImmediately = true);
