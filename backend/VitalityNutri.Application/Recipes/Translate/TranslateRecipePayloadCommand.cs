using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Application.Recipes.Translate;

public sealed record TranslateRecipePayloadCommand(
    string RecipeName,
    string Tips,
    string? NutritionistTips,
    JsonElement Ingredients,
    JsonElement Steps,
    string? SourceLanguage,
    string? TargetLanguage) : IRequest<TranslateRecipeResult>;

internal sealed class TranslateRecipePayloadCommandHandler(
    ITextTranslationService translationService)
    : IRequestHandler<TranslateRecipePayloadCommand, TranslateRecipeResult>
{
    public async Task<TranslateRecipeResult> Handle(TranslateRecipePayloadCommand request, CancellationToken cancellationToken)
    {
        var sourceLanguage = string.IsNullOrWhiteSpace(request.SourceLanguage) ? "es" : request.SourceLanguage.Trim().ToLowerInvariant();
        var targetLanguage = string.IsNullOrWhiteSpace(request.TargetLanguage) ? "en" : request.TargetLanguage.Trim().ToLowerInvariant();

        var translation = await translationService.TranslateRecipeAsync(
            new RecipeTranslationInput(
                request.RecipeName,
                request.Tips,
                request.NutritionistTips,
                request.Ingredients,
                request.Steps,
                sourceLanguage,
                targetLanguage),
            cancellationToken);

        return new TranslateRecipeResult(
            0,
            translation.RecipeName,
            translation.Tips,
            translation.NutritionistTips,
            translation.Ingredients,
            translation.Steps,
            sourceLanguage,
            targetLanguage,
            translation.IsAiTranslated);
    }
}
