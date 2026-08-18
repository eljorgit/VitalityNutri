namespace VitalityNutri.Application.Abstractions.Processing;

public interface IPlanExtractionService
{
    Task<string> ExtractPlanJsonAsync(string filePath, string language, CancellationToken cancellationToken);
}