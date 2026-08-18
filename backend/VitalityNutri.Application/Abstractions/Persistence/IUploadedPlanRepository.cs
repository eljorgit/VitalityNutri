namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IUploadedPlanRepository
{
    Task<DuplicatePlanRecord?> FindByHashAsync(string hash, CancellationToken cancellationToken);
    Task<ActiveStoredPlan?> GetActiveAsync(CancellationToken cancellationToken);
    Task<SavedPlanEnvelope> SaveUploadedPlanAsync(string originalFileName, string savedFileName, string fileHash, string planJson, DateTimeOffset processedAtUtc, CancellationToken cancellationToken);
    Task<SavedPlanEnvelope> ReprocessActivePlanAsync(string planJson, string fileHash, DateTimeOffset processedAtUtc, CancellationToken cancellationToken);
}

public sealed record DuplicatePlanRecord(long Id, string FileName, bool IsActive);
public sealed record ActiveStoredPlan(long Id, string FileName, string SavedFileName, string? FileHash);
public sealed record SavedPlanEnvelope(string PlanJson, string MetadataJson);