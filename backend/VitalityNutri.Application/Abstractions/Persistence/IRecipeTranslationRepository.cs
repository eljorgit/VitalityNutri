using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IRecipeTranslationRepository
{
    Task<RecipeTranslation?> GetAsync(long recipeId, string targetLanguage, CancellationToken cancellationToken);
    Task SaveAsync(RecipeTranslation translation, CancellationToken cancellationToken);
    Task InvalidateAsync(long recipeId, CancellationToken cancellationToken);
}
