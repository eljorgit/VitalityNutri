using VitalityNutri.Application.Recipes;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IRecipeRepository
{
    Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken cancellationToken);
    Task<Recipe?> GetByIdAsync(long id, CancellationToken cancellationToken);
    Task<long> AddAsync(Recipe recipe, CancellationToken cancellationToken);
    Task UpdateAsync(long id, RecipeWriteModel recipe, CancellationToken cancellationToken);
    Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken);
    Task<bool?> ToggleFavoriteAsync(long id, CancellationToken cancellationToken);
    Task DeleteAsync(long id, CancellationToken cancellationToken);
}