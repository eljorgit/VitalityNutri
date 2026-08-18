using System.Text.Json;
using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.BatchCooking.GenerateBatchCooking;

public sealed record GenerateBatchCookingCommand(
    BatchCookingParams Params,
    bool ForceRegenerate,
    string Language = "es") : IRequest<BatchCookingGenerateResult?>;

internal sealed class GenerateBatchCookingCommandValidator : AbstractValidator<GenerateBatchCookingCommand>
{
    public GenerateBatchCookingCommandValidator()
    {
        RuleFor(x => x.Params.BurnersCount).InclusiveBetween(1, 12);
        RuleFor(x => x.Params.CustomTools).MaximumLength(500);
    }
}

internal sealed class GenerateBatchCookingCommandHandler(
    IPlanRepository plans,
    IBatchCookingRepository batch,
    IBatchCookingAiService batchCookingAi)
    : IRequestHandler<GenerateBatchCookingCommand, BatchCookingGenerateResult?>
{
    public async Task<BatchCookingGenerateResult?> Handle(GenerateBatchCookingCommand request, CancellationToken cancellationToken)
    {
        var active = await plans.GetActiveAsync(cancellationToken);
        if (active is null)
        {
            return null;
        }

        var cached = await batch.GetByPlanIdAsync(active.Id, cancellationToken);
        if (!request.ForceRegenerate && cached is not null)
        {
            var cachedParams = JsonSerializer.Deserialize<BatchCookingParams>(cached.ParamsJson);
            if (cachedParams is not null && BatchCookingParamsComparer.Matches(cachedParams, request.Params))
            {
                return new BatchCookingGenerateResult(true, BatchCookingJson.Parse(cached.GuideJson), BatchCookingJson.Parse(cached.ParamsJson));
            }
        }

        var guide = await batchCookingAi.GenerateGuideAsync(active.PlanJson, request.Params, request.Language, cancellationToken);
        var state = new BatchCookingState(active.Id, BatchCookingJson.Serialize(guide), JsonSerializer.Serialize(request.Params));
        await batch.SaveAsync(state, cancellationToken);

        return new BatchCookingGenerateResult(true, guide, JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(request.Params)));
    }
}