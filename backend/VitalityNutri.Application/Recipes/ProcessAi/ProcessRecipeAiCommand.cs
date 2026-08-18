using System.Text.Json;
using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Application.Recipes.ProcessAi;

public sealed record ProcessRecipeAiCommand(
    string SourceType,
    string? FileData,
    string? TextData,
    int OptionsCount,
    string? ExtraPrompt,
    string Language) : IRequest<ProcessRecipeAiResult>;

public sealed record ProcessRecipeAiResult(bool Success, IReadOnlyList<RecipeAiOption> Options);

internal sealed class ProcessRecipeAiCommandValidator : AbstractValidator<ProcessRecipeAiCommand>
{
    private static readonly string[] SourceTypes = ["image", "pdf", "text", "mejora"];

    public ProcessRecipeAiCommandValidator()
    {
        RuleFor(x => x.SourceType)
            .NotEmpty()
            .Must(x => SourceTypes.Contains(x, StringComparer.OrdinalIgnoreCase));

        RuleFor(x => x.OptionsCount)
            .InclusiveBetween(1, 5);
    }
}

internal sealed partial class ProcessRecipeAiCommandHandler(
    IRecipeAiProcessingService recipeAi,
    IIngredientRepository ingredients)
    : IRequestHandler<ProcessRecipeAiCommand, ProcessRecipeAiResult>
{
    public async Task<ProcessRecipeAiResult> Handle(ProcessRecipeAiCommand request, CancellationToken cancellationToken)
    {
        var options = await recipeAi.ProcessAsync(new RecipeAiInput(
            request.SourceType,
            request.FileData,
            request.TextData,
            request.OptionsCount,
            request.ExtraPrompt,
            request.Language), cancellationToken);

        var normalized = options.Select(NormalizeSteps).ToArray();
        var deduplicated = RecipeAiOptionDeduplicator.Deduplicate(normalized);

        var discoveredIngredients = deduplicated
            .SelectMany(option => RecipeIngredients.Extract(option.Ingredients))
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .DistinctBy(x => $"{x.Name.Trim().ToLowerInvariant()}|{x.Category.Trim().ToLowerInvariant()}")
            .ToArray();

        if (discoveredIngredients.Length > 0)
        {
            await ingredients.SaveManyAsync(discoveredIngredients, cancellationToken);
        }

        return new ProcessRecipeAiResult(true, deduplicated);
    }

    private static RecipeAiOption NormalizeSteps(RecipeAiOption option)
    {
        if (option.Steps.ValueKind != JsonValueKind.Array)
        {
            return option;
        }

        var cleaned = option.Steps
            .EnumerateArray()
            .Select(step =>
            {
                var text = step.ValueKind == JsonValueKind.String ? step.GetString() ?? string.Empty : step.ToString();
                return text.Length == 0
                    ? text
                    : StepPrefixRegex().Replace(text, string.Empty).Trim();
            })
            .ToArray();

        return option with { Steps = JsonSerializer.SerializeToElement(cleaned) };
    }

    [System.Text.RegularExpressions.GeneratedRegex("^(?:Paso\\s+\\d+\\s*[:.-]*\\s*)", System.Text.RegularExpressions.RegexOptions.IgnoreCase)]
    private static partial System.Text.RegularExpressions.Regex StepPrefixRegex();
}