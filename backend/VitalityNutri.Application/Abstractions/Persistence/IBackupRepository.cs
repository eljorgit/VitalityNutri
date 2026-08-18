using System.Text.Json;
using VitalityNutri.Application.Backups;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IBackupRepository
{
    Task<BackupExportResult> ExportAsync(CancellationToken cancellationToken);
    Task ImportAsync(JsonElement payload, CancellationToken cancellationToken);
}