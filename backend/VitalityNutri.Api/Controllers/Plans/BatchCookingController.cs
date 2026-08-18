using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VitalityNutri.Application.BatchCooking;
using VitalityNutri.Application.BatchCooking.GenerateBatchCooking;
using VitalityNutri.Application.BatchCooking.GetBatchCooking;
using VitalityNutri.Application.BatchCooking.ResetBatchCooking;

namespace VitalityNutri.Api.Controllers.Plans;

/// <summary>Handles batch-cooking read, generation, and reset operations.</summary>
/// <param name="sender">Application request dispatcher.</param>
[ApiController, Route("api/plan/batch-cooking"), EnableRateLimiting("batch-cooking")]
public sealed class BatchCookingController(ISender sender) : ControllerBase
{
    /// <summary>Returns the cached batch-cooking guide for the active plan.</summary>
    [HttpGet]
    public async Task<ActionResult<BatchCookingResponse>> Get(CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetBatchCookingQuery(), cancellationToken);
        return result is null
            ? BadRequest(new BatchCookingErrorResponse("No hay ningún plan activo cargado."))
            : Ok(result);
    }

    /// <summary>Generates and stores a batch-cooking guide for the active plan.</summary>
    [HttpPost]
    public async Task<ActionResult<BatchCookingGenerateResult>> Generate(BatchCookingGenerateRequest request, CancellationToken cancellationToken)
    {
        if (request.Params is null)
        {
            return BadRequest(new BatchCookingErrorResponse("Faltan los parámetros de la cocina."));
        }

        var result = await sender.Send(new GenerateBatchCookingCommand(request.Params, request.ForceRegenerate), cancellationToken);
        return result is null
            ? BadRequest(new BatchCookingErrorResponse("No hay ningún plan activo cargado."))
            : Ok(result);
    }

    /// <summary>Removes the active plan batch-cooking guide.</summary>
    [HttpPost("reset")]
    public async Task<ActionResult<BatchCookingWriteResponse>> Reset(CancellationToken cancellationToken)
    {
        var success = await sender.Send(new ResetBatchCookingCommand(), cancellationToken);
        return success
            ? Ok(new BatchCookingWriteResponse(true))
            : BadRequest(new BatchCookingErrorResponse("No hay ningún plan activo cargado."));
    }
}

/// <summary>Request body for batch-cooking generation.</summary>
public sealed record BatchCookingGenerateRequest(BatchCookingParams? Params, bool ForceRegenerate = false, string? Lang = null);

/// <summary>Successful batch-cooking write response.</summary>
public sealed record BatchCookingWriteResponse(bool Success);

/// <summary>Batch-cooking API error response.</summary>
public sealed record BatchCookingErrorResponse(string Error);