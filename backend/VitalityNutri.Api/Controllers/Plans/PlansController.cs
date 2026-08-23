using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VitalityNutri.Application.Plans.GetActivePlan;
using VitalityNutri.Application.Plans.GetPlanById;
using VitalityNutri.Application.Plans.ResetPlan;
using VitalityNutri.Application.Plans.TranslatePlan;
using VitalityNutri.Application.Plans.UpdatePlanRecipe;

using VitalityNutri.Application.Abstractions.Common;

namespace VitalityNutri.Api.Controllers.Plans;

/// <summary>
/// Handles meal-plan operations.
/// </summary>
/// <param name="sender">The application request dispatcher.</param>
/// <param name="currentUserProvider">Current user context provider.</param>
[ApiController]
[Route("api/plan")]
public sealed class PlansController(
    ISender sender,
    ICurrentUserProvider currentUserProvider) : ControllerBase
{
    /// <summary>
    /// Returns the currently active meal plan.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The active plan and metadata, or null values when no plan is active.</returns>
    [HttpGet(Name = "GetPlan")]
    [ProducesResponseType<PlanResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PlanResponse>> GetActive(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetActivePlanQuery(), cancellationToken);
        return Ok(result is null
            ? new PlanResponse(null, null)
            : new PlanResponse(result.Plan, result.Metadata));
    }

    /// <summary>Returns a plan by identifier without changing the active plan.</summary>
    [HttpGet("{id:long}", Name = "GetPlanById")]
    public async Task<ActionResult<PlanByIdResponse>> GetById(long id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetPlanByIdQuery(id), cancellationToken);
        return result is null ? NotFound() : Ok(new PlanByIdResponse(result.Envelope.Plan, result.Envelope.Metadata, result.IsActive));
    }

    /// <summary>Gets the cached translation for the active meal plan without generating via AI.</summary>
    [HttpGet("translate")]
    [ProducesResponseType<PlanResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PlanResponse>> GetActiveTranslation([FromQuery] string? targetLang, CancellationToken cancellationToken)
    {
        var lang = string.IsNullOrWhiteSpace(targetLang) ? "en" : targetLang.Trim().ToLowerInvariant();
        var result = await sender.Send(new VitalityNutri.Application.Plans.GetPlanTranslation.GetPlanTranslationQuery(null, lang), cancellationToken);
        return Ok(new PlanResponse(result?.Plan, result?.Metadata));
    }

    /// <summary>Gets the cached translation for a specific meal plan without generating via AI.</summary>
    [HttpGet("{id:long}/translate")]
    [ProducesResponseType<PlanByIdResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PlanByIdResponse>> GetTranslationById(long id, [FromQuery] string? targetLang, CancellationToken cancellationToken)
    {
        var lang = string.IsNullOrWhiteSpace(targetLang) ? "en" : targetLang.Trim().ToLowerInvariant();
        var result = await sender.Send(new VitalityNutri.Application.Plans.GetPlanTranslation.GetPlanTranslationQuery(id, lang), cancellationToken);
        return Ok(result is null ? new PlanByIdResponse(null, null, false) : new PlanByIdResponse(result.Plan, result.Metadata, false));
    }

    /// <summary>Translates the currently active meal plan to the target language.</summary>
    [HttpPost("translate"), EnableRateLimiting("general-write")]
    [ProducesResponseType<PlanResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PlanResponse>> TranslateActive([FromQuery] string? targetLang, CancellationToken cancellationToken)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new PlanWriteResponse(false, null, "Plan translation is disabled in demo mode."));
        }

        var lang = string.IsNullOrWhiteSpace(targetLang) ? "en" : targetLang.Trim().ToLowerInvariant();
        var result = await sender.Send(new TranslatePlanCommand(null, lang), cancellationToken);
        return Ok(result is null
            ? new PlanResponse(null, null)
            : new PlanResponse(result.Plan, result.Metadata));
    }

    /// <summary>Translates a specific meal plan by identifier to the target language.</summary>
    [HttpPost("{id:long}/translate"), EnableRateLimiting("general-write")]
    [ProducesResponseType<PlanByIdResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PlanByIdResponse>> TranslateById(long id, [FromQuery] string? targetLang, CancellationToken cancellationToken)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new PlanByIdResponse(null, null, false));
        }

        var lang = string.IsNullOrWhiteSpace(targetLang) ? "en" : targetLang.Trim().ToLowerInvariant();
        var result = await sender.Send(new TranslatePlanCommand(id, lang), cancellationToken);
        return result is null ? NotFound() : Ok(new PlanByIdResponse(result.Plan, result.Metadata, false));
    }

    /// <summary>Clears the active plan.</summary>
    [HttpPost("reset")]
    public async Task<ActionResult<PlanWriteResponse>> Reset(CancellationToken cancellationToken)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new PlanWriteResponse(false, null, "Plan reset is disabled in demo mode."));
        }

        await sender.Send(new ResetPlanCommand(), cancellationToken);
        return Ok(new PlanWriteResponse(true, null, null));
    }

    /// <summary>Updates one recipe cell in the active plan.</summary>
    [HttpPost("update-recipe")]
    public async Task<ActionResult<PlanWriteResponse>> UpdateRecipe(UpdatePlanRecipeRequest request, CancellationToken cancellationToken)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new PlanWriteResponse(false, null, "Recipe updates are disabled in demo mode."));
        }

        var plan = await sender.Send(new UpdatePlanRecipeCommand(request.Day, request.Meal, request.Recipe), cancellationToken);
        return plan.HasValue ? Ok(new PlanWriteResponse(true, plan, null)) : BadRequest();
    }
}

/// <summary>
/// Wraps the active meal plan and its metadata.
/// </summary>
/// <param name="Plan">The structured meal-plan document.</param>
/// <param name="Metadata">The meal-plan metadata document.</param>
public sealed record PlanResponse(object? Plan, object? Metadata);
/// <summary>Wraps a historical plan and active state.</summary>
/// <param name="Plan">Structured plan.</param>
/// <param name="Metadata">Plan metadata.</param>
/// <param name="IsActive">Whether this is the active plan.</param>
public sealed record PlanByIdResponse(object? Plan, object? Metadata, bool IsActive);
/// <summary>Plan cell update request.</summary>
/// <param name="Day">Plan day.</param>
/// <param name="Meal">Meal slot.</param>
/// <param name="Recipe">Replacement recipe or null.</param>
public sealed record UpdatePlanRecipeRequest(string Day, string Meal, System.Text.Json.JsonElement? Recipe);
/// <summary>Plan write response.</summary>
/// <param name="Success">Whether the write completed.</param>
/// <param name="Plan">Updated plan when applicable.</param>
/// <param name="Metadata">Updated metadata when applicable.</param>
public sealed record PlanWriteResponse(bool Success, object? Plan, object? Metadata);