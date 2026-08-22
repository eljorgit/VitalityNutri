using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;

using Microsoft.Extensions.Localization;
using VitalityNutri.Application.Resources;

namespace VitalityNutri.Application.Uploads.ReprocessPlan;

public sealed record ReprocessPlanCommand(string Language) : IRequest<UploadPlanResult?>;

internal sealed class ReprocessPlanCommandHandler(
    IUploadedPlanRepository plans,
    IUploadFileStorage fileStorage,
    IPlanExtractionService extraction,
    IRecipeRepository recipes,
    IStringLocalizer<Messages> localizer)
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
            throw new FileNotFoundException(localizer[Messages.UploadsOriginalFileNotFound, active.FileName]);
        }

        var hash = await fileStorage.ComputeFileHashAsync(file.FilePath, cancellationToken);
        var planJson = await extraction.ExtractPlanJsonAsync(file.FilePath, request.Language, cancellationToken);
        var saved = await plans.ReprocessActivePlanAsync(planJson, hash, DateTimeOffset.UtcNow, request.Language, cancellationToken);
        var enrichedPlanJson = await PlanRecipeSync.SyncAsync(saved.PlanJson, saved.MetadataJson, recipes, cancellationToken);
        if (enrichedPlanJson != saved.PlanJson)
        {
            await plans.UpdatePlanJsonAsync(active.Id, enrichedPlanJson, cancellationToken);
        }

        return new UploadPlanResult(
            true,
            JsonSerializer.Deserialize<JsonElement>(enrichedPlanJson),
            JsonSerializer.Deserialize<JsonElement>(saved.MetadataJson));
    }
}