using System.Text.Json;

namespace VitalityNutri.Application.Uploads;

public sealed record UploadDuplicatePlan(long Id, string FileName, bool IsActive);
public sealed record UploadPlanResult(
    bool Success,
    JsonElement? Plan,
    JsonElement? Metadata,
    bool DuplicateDetected = false,
    UploadDuplicatePlan? ExistingPlan = null);