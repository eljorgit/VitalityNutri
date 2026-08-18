using MediatR; using Microsoft.AspNetCore.Mvc; using VitalityNutri.Application.Plans.GetPlanHistory;
using VitalityNutri.Application.Plans.DeletePlan;
using VitalityNutri.Application.Plans.RestorePlan;
namespace VitalityNutri.Api.Controllers.History;
/// <summary>Handles meal-plan history queries.</summary>
/// <param name="sender">Application request dispatcher.</param>
[ApiController, Route("api/history")]
public sealed class HistoryController(ISender sender) : ControllerBase
{
    /// <summary>Returns all analyzed plans, newest first.</summary>
    [HttpGet] public async Task<ActionResult<IReadOnlyList<PlanHistoryItem>>> Get(CancellationToken token) => Ok(await sender.Send(new GetPlanHistoryQuery(), token));

    /// <summary>Restores a historical plan as active.</summary>
    [HttpPost("restore/{id:long}")]
    public async Task<ActionResult<HistoryRestoreResponse>> Restore(long id, CancellationToken token)
    {
        var result = await sender.Send(new RestorePlanCommand(id), token);
        return result is null ? NotFound() : Ok(new HistoryRestoreResponse(true, result.Plan, result.Metadata));
    }

    /// <summary>Deletes a historical plan.</summary>
    [HttpDelete("{id:long}")]
    public async Task<ActionResult<HistoryDeleteResponse>> Delete(long id, CancellationToken token)
    {
        return await sender.Send(new DeletePlanCommand(id), token)
            ? Ok(new HistoryDeleteResponse(true))
            : NotFound();
    }
}
/// <summary>Successful history restore response.</summary>
/// <param name="Success">Whether the restore completed.</param>
/// <param name="Plan">Restored plan.</param>
/// <param name="Metadata">Restored metadata.</param>
public sealed record HistoryRestoreResponse(bool Success, object Plan, object Metadata);
/// <summary>Successful history deletion response.</summary>
/// <param name="Success">Whether deletion completed.</param>
public sealed record HistoryDeleteResponse(bool Success);