using VitalityNutri.Domain.Entities;
namespace VitalityNutri.Application.Abstractions.Persistence;
public interface IIngredientRepository
{
	Task<IReadOnlyList<Ingredient>> GetAllAsync(CancellationToken cancellationToken);
	Task SaveAsync(string name, string category, CancellationToken cancellationToken);
	Task SaveManyAsync(IReadOnlyCollection<(string Name, string Category)> ingredients, CancellationToken cancellationToken);
}