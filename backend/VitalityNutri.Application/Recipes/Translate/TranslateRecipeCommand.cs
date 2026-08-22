using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Common;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Recipes.Translate;

public sealed record TranslateRecipeCommand(long RecipeId, string TargetLanguage) : IRequest<TranslateRecipeResult?>;

public sealed record TranslateRecipeResult(
    long RecipeId,
    string RecipeName,
    string Tips,
    string? NutritionistTips,
    JsonElement Ingredients,
    JsonElement Steps,
    string SourceLanguage,
    string TargetLanguage,
    bool IsAiTranslated);

internal sealed class TranslateRecipeCommandHandler(
    IRecipeRepository recipes,
    IRecipeTranslationRepository translationRepository,
    ITextTranslationService translationService)
    : IRequestHandler<TranslateRecipeCommand, TranslateRecipeResult?>
{
    public async Task<TranslateRecipeResult?> Handle(TranslateRecipeCommand request, CancellationToken cancellationToken)
    {
        var recipe = await recipes.GetByIdAsync(request.RecipeId, cancellationToken);
        if (recipe is null)
        {
            return null;
        }

        var sourceLanguage = string.IsNullOrWhiteSpace(recipe.OriginalLanguage) ? "es" : recipe.OriginalLanguage.Trim().ToLowerInvariant();
        var targetLanguage = string.IsNullOrWhiteSpace(request.TargetLanguage) ? "en" : request.TargetLanguage.Trim().ToLowerInvariant();

        if (string.Equals(sourceLanguage, targetLanguage, StringComparison.OrdinalIgnoreCase))
        {
            return new TranslateRecipeResult(
                recipe.Id,
                recipe.RecipeName,
                recipe.Tips,
                recipe.NutritionistTips,
                JsonElementParser.Parse(recipe.IngredientsJson),
                JsonElementParser.Parse(recipe.StepsJson),
                sourceLanguage,
                targetLanguage,
                false);
        }

        var cached = await translationRepository.GetAsync(recipe.Id, targetLanguage, cancellationToken);
        if (cached is not null)
        {
            return new TranslateRecipeResult(
                recipe.Id,
                cached.RecipeName,
                cached.Tips,
                cached.NutritionistTips,
                JsonElementParser.Parse(cached.IngredientsJson),
                JsonElementParser.Parse(cached.StepsJson),
                sourceLanguage,
                targetLanguage,
                cached.IsAiTranslated);
        }

        var translation = await translationService.TranslateRecipeAsync(
            new RecipeTranslationInput(
                recipe.RecipeName,
                recipe.Tips,
                recipe.NutritionistTips,
                JsonElementParser.Parse(recipe.IngredientsJson),
                JsonElementParser.Parse(recipe.StepsJson),
                sourceLanguage,
                targetLanguage),
            cancellationToken);

        if (translation.IsAiTranslated)
        {
            var entity = new RecipeTranslation(
                recipe.Id,
                targetLanguage,
                translation.RecipeName,
                translation.Tips,
                translation.NutritionistTips,
                translation.Ingredients.GetRawText(),
                translation.Steps.GetRawText(),
                true);

            await translationRepository.SaveAsync(entity, cancellationToken);
        }

        return new TranslateRecipeResult(
            recipe.Id,
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
