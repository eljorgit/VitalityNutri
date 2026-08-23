using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Localization;
using VitalityNutri.Application.BatchCooking;
using VitalityNutri.Application.BatchCooking.GenerateBatchCooking;
using VitalityNutri.Application.BatchCooking.GetBatchCooking;
using VitalityNutri.Application.BatchCooking.ResetBatchCooking;
using VitalityNutri.Application.Resources;

using VitalityNutri.Application.Abstractions.Common;

namespace VitalityNutri.Api.Controllers.Plans;

/// <summary>Handles batch-cooking read, generation, and reset operations.</summary>
/// <param name="sender">Application request dispatcher.</param>
/// <param name="localizer">Localized messages accessor.</param>
/// <param name="currentUserProvider">Current user context provider.</param>
[ApiController, Route("api/plan/batch-cooking"), EnableRateLimiting("batch-cooking")]
public sealed class BatchCookingController(
    ISender sender,
    IStringLocalizer<Messages> localizer,
    ICurrentUserProvider currentUserProvider) : ControllerBase
{
    /// <summary>Returns the cached batch-cooking guide for the active plan.</summary>
    [HttpGet]
    public async Task<ActionResult<BatchCookingResponse>> Get(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetBatchCookingQuery(), cancellationToken);
        return result is null
            ? BadRequest(new BatchCookingErrorResponse(localizer[Messages.BatchCookingNoActivePlan]))
            : Ok(result);
    }

    /// <summary>Generates and stores a batch-cooking guide for the active plan.</summary>
    [HttpPost]
    public async Task<ActionResult<BatchCookingGenerateResult>> Generate(BatchCookingGenerateRequest request, CancellationToken cancellationToken)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new BatchCookingErrorResponse("Batch cooking generation is disabled in demo mode."));
        }

        if (request.Params is null)
        {
            return BadRequest(new BatchCookingErrorResponse(localizer[Messages.BatchCookingMissingParams]));
        }

        var result = await sender.Send(new GenerateBatchCookingCommand(request.Params, request.ForceRegenerate, request.Lang ?? "es"), cancellationToken);
        return result is null
            ? BadRequest(new BatchCookingErrorResponse(localizer[Messages.BatchCookingNoActivePlan]))
            : Ok(result);
    }

    /// <summary>Removes the active plan batch-cooking guide.</summary>
    [HttpPost("reset")]
    public async Task<ActionResult<BatchCookingWriteResponse>> Reset(CancellationToken cancellationToken)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new BatchCookingErrorResponse("Batch cooking reset is disabled in demo mode."));
        }

        var success = await sender.Send(new ResetBatchCookingCommand(), cancellationToken);
        return success
            ? Ok(new BatchCookingWriteResponse(true))
            : BadRequest(new BatchCookingErrorResponse(localizer[Messages.BatchCookingNoActivePlan]));
    }
}

/// <summary>Request body for batch-cooking generation.</summary>
public sealed record BatchCookingGenerateRequest(BatchCookingParams? Params, bool ForceRegenerate = false, string? Lang = null);

/// <summary>Successful batch-cooking write response.</summary>
public sealed record BatchCookingWriteResponse(bool Success);

/// <summary>Batch-cooking API error response.</summary>
public sealed record BatchCookingErrorResponse(string Error);