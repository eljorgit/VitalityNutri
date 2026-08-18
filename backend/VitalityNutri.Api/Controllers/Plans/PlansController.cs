using MediatR;
using Microsoft.AspNetCore.Mvc;
using VitalityNutri.Application.Plans.GetActivePlan;
using VitalityNutri.Application.Plans.GetPlanById;
using VitalityNutri.Application.Plans.ResetPlan;
using VitalityNutri.Application.Plans.UpdatePlanRecipe;

namespace VitalityNutri.Api.Controllers.Plans;

/// <summary>
/// Handles meal-plan operations.
/// </summary>
/// <param name="sender">The application request dispatcher.</param>
[ApiController]
[Route("api/plan")]
public sealed class PlansController(ISender sender) : ControllerBase
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

    /// <summary>Clears the active plan.</summary>
    [HttpPost("reset")]
    public async Task<ActionResult<PlanWriteResponse>> Reset(CancellationToken cancellationToken)
    {
        await sender.Send(new ResetPlanCommand(), cancellationToken);
        return Ok(new PlanWriteResponse(true, null, null));
    }

    /// <summary>Updates one recipe cell in the active plan.</summary>
    [HttpPost("update-recipe")]
    public async Task<ActionResult<PlanWriteResponse>> UpdateRecipe(UpdatePlanRecipeRequest request, CancellationToken cancellationToken)
    {
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
public sealed record PlanByIdResponse(object Plan, object Metadata, bool IsActive);
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