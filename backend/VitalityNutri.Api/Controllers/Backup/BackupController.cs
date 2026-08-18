using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using VitalityNutri.Application.Backups;

namespace VitalityNutri.Api.Controllers.Backup;

/// <summary>Handles database backup export and restore operations.</summary>
/// <param name="sender">Application request dispatcher.</param>
[ApiController, Route("api/backup")]
public sealed class BackupController(ISender sender) : ControllerBase
{
    /// <summary>Exports current backup data as one JSON payload.</summary>
    [HttpGet("export")]
    public async Task<ActionResult<BackupExportResult>> Export(CancellationToken token) =>
        Ok(await sender.Send(new ExportBackupQuery(), token));

    /// <summary>Imports a previously exported backup payload.</summary>
    [HttpPost("import"), RequestSizeLimit(50 * 1024 * 1024)]
    public async Task<ActionResult<BackupWriteResponse>> Import([FromBody] JsonElement payload, CancellationToken token)
    {
        if (payload.ValueKind != JsonValueKind.Object ||
            !payload.TryGetProperty("plans", out var plans) ||
            plans.ValueKind != JsonValueKind.Array)
        {
            return BadRequest(new BackupErrorResponse("El formato de la copia de seguridad no es válido."));
        }

        await sender.Send(new ImportBackupCommand(payload), token);
        return Ok(new BackupWriteResponse(true));
    }
}

/// <summary>Successful backup write response.</summary>
public sealed record BackupWriteResponse(bool Success);
/// <summary>Backup API error response.</summary>
public sealed record BackupErrorResponse(string Error);