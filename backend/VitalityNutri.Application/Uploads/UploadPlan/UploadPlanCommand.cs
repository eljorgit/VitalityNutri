using System.Text.Json;
using FluentValidation;
using MediatR;
using VitalityNutri.Application.Uploads;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Application.Uploads.UploadPlan;

public sealed record UploadPlanCommand(string FileName, string FileData, string Language, bool ForceReprocess) : IRequest<UploadPlanResult>;

internal sealed class UploadPlanCommandValidator : AbstractValidator<UploadPlanCommand>
{
    public UploadPlanCommandValidator()
    {
        RuleFor(x => x.FileName).NotEmpty().MaximumLength(512);
        RuleFor(x => x.FileData).NotEmpty();
    }
}

internal sealed class UploadPlanCommandHandler(
    IUploadFileStorage fileStorage,
    IUploadedPlanRepository plans,
    IPlanExtractionService extraction,
    IRecipeRepository recipes)
    : IRequestHandler<UploadPlanCommand, UploadPlanResult>
{
    public async Task<UploadPlanResult> Handle(UploadPlanCommand request, CancellationToken cancellationToken)
    {
        var uploaded = await fileStorage.SaveBase64PdfAsync(request.FileName, request.FileData, cancellationToken);
        var fileSaved = true;

        try
        {
            if (!request.ForceReprocess)
            {
                var duplicate = await plans.FindByHashAsync(uploaded.FileHash, cancellationToken);
                if (duplicate is not null)
                {
                    await fileStorage.DeleteFileIfExistsAsync(uploaded.SavedFileName, cancellationToken);
                    fileSaved = false;
                    return new UploadPlanResult(
                        false,
                        null,
                        null,
                        true,
                        new UploadDuplicatePlan(duplicate.Id, duplicate.FileName, duplicate.IsActive));
                }
            }

            var planJson = await extraction.ExtractPlanJsonAsync(uploaded.FilePath, request.Language, cancellationToken);
            if (IsEmptyWeekPlan(planJson))
            {
                throw new PlanExtractionFailedException(
                    "No meals could be extracted from the uploaded PDF. Verify AI provider keys and model availability, then try again.");
            }

            var saved = await plans.SaveUploadedPlanAsync(
                request.FileName,
                uploaded.SavedFileName,
                uploaded.FileHash,
                planJson,
                DateTimeOffset.UtcNow,
                cancellationToken);

            await PlanRecipeSync.SyncAsync(saved.PlanJson, saved.MetadataJson, recipes, cancellationToken);

            return new UploadPlanResult(
                true,
                JsonSerializer.Deserialize<JsonElement>(saved.PlanJson),
                JsonSerializer.Deserialize<JsonElement>(saved.MetadataJson));
        }
        catch
        {
            if (fileSaved)
            {
                await fileStorage.DeleteFileIfExistsAsync(uploaded.SavedFileName, cancellationToken);
            }

            throw;
        }
    }

    private static bool IsEmptyWeekPlan(string planJson)
    {
        using var document = JsonDocument.Parse(planJson);
        if (!document.RootElement.TryGetProperty("days", out var days) || days.ValueKind != JsonValueKind.Object)
        {
            return true;
        }

        foreach (var day in days.EnumerateObject())
        {
            if (day.Value.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            foreach (var meal in day.Value.EnumerateObject())
            {
                if (meal.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array or JsonValueKind.String or JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False)
                {
                    return false;
                }
            }
        }

        return true;
    }
}