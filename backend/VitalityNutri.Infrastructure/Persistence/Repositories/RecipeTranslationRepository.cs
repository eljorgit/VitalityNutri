using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

internal sealed class RecipeTranslationRepository(VitalityNutriDbContext dbContext) : IRecipeTranslationRepository
{
    public async Task<RecipeTranslation?> GetAsync(long recipeId, string targetLanguage, CancellationToken cancellationToken)
    {
        var normalizedLang = targetLanguage.Trim().ToLowerInvariant();
        return await dbContext.RecipeTranslations
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.RecipeId == recipeId && x.TargetLanguage == normalizedLang, cancellationToken);
    }

    public async Task SaveAsync(RecipeTranslation translation, CancellationToken cancellationToken)
    {
        var existing = await dbContext.RecipeTranslations
            .FirstOrDefaultAsync(x => x.RecipeId == translation.RecipeId && x.TargetLanguage == translation.TargetLanguage, cancellationToken);

        if (existing is not null)
        {
            existing.Update(
                translation.RecipeName,
                translation.Tips,
                translation.NutritionistTips,
                translation.IngredientsJson,
                translation.StepsJson,
                translation.IsAiTranslated);
        }
        else
        {
            await dbContext.RecipeTranslations.AddAsync(translation, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task InvalidateAsync(long recipeId, CancellationToken cancellationToken)
    {
        var translations = await dbContext.RecipeTranslations
            .Where(x => x.RecipeId == recipeId)
            .ToListAsync(cancellationToken);

        if (translations.Count > 0)
        {
            dbContext.RecipeTranslations.RemoveRange(translations);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
