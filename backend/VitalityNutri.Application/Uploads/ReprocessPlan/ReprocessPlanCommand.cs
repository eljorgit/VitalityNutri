using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Application.Uploads.ReprocessPlan;

public sealed record ReprocessPlanCommand(string Language) : IRequest<UploadPlanResult?>;

internal sealed class ReprocessPlanCommandHandler(
    IUploadedPlanRepository plans,
    IUploadFileStorage fileStorage,
    IPlanExtractionService extraction,
    IRecipeRepository recipes)
    : IRequestHandler<ReprocessPlanCommand, UploadPlanResult?>
{
    public async Task<UploadPlanResult?> Handle(ReprocessPlanCommand request, CancellationToken cancellationToken)
    {
        var active = await plans.GetActiveAsync(cancellationToken);
        if (active is null)
        {
            return null;
        }

        var file = await fileStorage.GetActiveFileAsync(active.SavedFileName, cancellationToken);
        if (file is null)
        {
            throw new FileNotFoundException($"No se encontró el archivo original {active.FileName} en el servidor.");
        }

        var hash = await fileStorage.ComputeFileHashAsync(file.FilePath, cancellationToken);
        var planJson = await extraction.ExtractPlanJsonAsync(file.FilePath, request.Language, cancellationToken);
        var saved = await plans.ReprocessActivePlanAsync(planJson, hash, DateTimeOffset.UtcNow, cancellationToken);
        await PlanRecipeSync.SyncAsync(saved.PlanJson, saved.MetadataJson, recipes, cancellationToken);

        return new UploadPlanResult(
            true,
            JsonSerializer.Deserialize<JsonElement>(saved.PlanJson),
            JsonSerializer.Deserialize<JsonElement>(saved.MetadataJson));
    }
}