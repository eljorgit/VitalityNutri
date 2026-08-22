using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
using VitalityNutri.Application.Recipes.Translate;

namespace VitalityNutri.Application.Recipes.GetRecipeTranslation;

public sealed record GetRecipeTranslationQuery(long RecipeId, string TargetLanguage) : IRequest<TranslateRecipeResult?>;

internal sealed class GetRecipeTranslationQueryHandler(
    IRecipeRepository recipes,
    IRecipeTranslationRepository translationRepository)
    : IRequestHandler<GetRecipeTranslationQuery, TranslateRecipeResult?>
{
    public async Task<TranslateRecipeResult?> Handle(GetRecipeTranslationQuery request, CancellationToken cancellationToken)
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

        return null;
    }
}
