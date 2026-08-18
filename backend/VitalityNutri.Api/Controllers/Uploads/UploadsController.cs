using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VitalityNutri.Application.Uploads;
using VitalityNutri.Application.Uploads.UploadPlan;
using VitalityNutri.Application.Uploads.ReprocessPlan;

namespace VitalityNutri.Api.Controllers.Uploads;

/// <summary>Handles plan upload and reprocessing endpoints.</summary>
[ApiController, Route("api"), EnableRateLimiting("upload")]
public sealed class UploadsController(ISender sender) : ControllerBase
{
    /// <summary>Uploads and processes a PDF plan payload.</summary>
    [HttpPost("upload")]
    public async Task<ActionResult<object>> Upload(UploadRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FileName) || string.IsNullOrWhiteSpace(request.FileData))
        {
            return BadRequest(new UploadErrorResponse("No se recibió el nombre del archivo o los datos base64."));
        }

        if (!string.Equals(Path.GetExtension(request.FileName), ".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new UploadErrorResponse("Por el momento, solo se soportan planes de alimentación en formato PDF."));
        }

        UploadPlanResult result;
        try
        {
            result = await sender.Send(new UploadPlanCommand(
                request.FileName,
                request.FileData,
                request.Lang ?? "es",
                request.Force || request.ForceReprocess), cancellationToken);
        }
        catch (PlanExtractionFailedException ex)
        {
            return StatusCode(StatusCodes.Status502BadGateway, new UploadErrorResponse(ex.Message));
        }

        if (result.DuplicateDetected && result.ExistingPlan is not null)
        {
            return Ok(new
            {
                duplicateDetected = true,
                existingPlan = new
                {
                    id = result.ExistingPlan.Id,
                    fileName = result.ExistingPlan.FileName,
                    isActive = result.ExistingPlan.IsActive
                }
            });
        }

        return Ok(new { success = true, plan = result.Plan, metadata = result.Metadata });
    }

    /// <summary>Reprocesses the active plan using its stored source file.</summary>
    [HttpPost("reprocess")]
    public async Task<ActionResult<object>> Reprocess(ReprocessRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await sender.Send(new ReprocessPlanCommand(request.Lang ?? "es"), cancellationToken);
            if (result is null)
            {
                return BadRequest(new UploadErrorResponse("No hay ningún archivo guardado para reprocesar en el plan activo."));
            }

            return Ok(new { success = true, plan = result.Plan, metadata = result.Metadata });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new UploadErrorResponse(ex.Message));
        }
    }
}

/// <summary>Upload payload model.</summary>
/// <param name="FileName">Original file name.</param>
/// <param name="FileData">Base64-encoded PDF file data.</param>
/// <param name="Force">Whether to bypass duplicate hash checks.</param>
/// <param name="ForceReprocess">Legacy alias for force upload behavior.</param>
/// <param name="Lang">Preferred language code.</param>
public sealed record UploadRequest(string? FileName, string? FileData, bool Force = false, bool ForceReprocess = false, string? Lang = null);

/// <summary>Reprocess payload model.</summary>
/// <param name="Lang">Preferred language code.</param>
public sealed record ReprocessRequest(string? Lang = null);

/// <summary>Error payload for upload and reprocess operations.</summary>
/// <param name="Error">Error message.</param>
public sealed record UploadErrorResponse(string Error);