using System.Text.Json;
using VitalityNutri.Application.BatchCooking;

namespace VitalityNutri.Application.Abstractions.Processing;

public interface IBatchCookingAiService
{
    Task<JsonElement> GenerateGuideAsync(
        string planJson,
        BatchCookingParams parameters,
        string language,
        CancellationToken cancellationToken);
}
