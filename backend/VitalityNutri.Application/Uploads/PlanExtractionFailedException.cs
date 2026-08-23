using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.Uploads;

/// <summary>
/// Thrown when AI extraction or enrichment of a nutrition plan fails.
/// Maps to HTTP 422 Unprocessable Entity.
/// </summary>
public sealed class PlanExtractionFailedException(string message) : UnprocessableEntityException(message);
