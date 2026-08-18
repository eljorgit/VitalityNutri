using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;
namespace VitalityNutri.Infrastructure.Persistence.Repositories;
internal sealed class IngredientRepository(VitalityNutriDbContext db) : IIngredientRepository
{
    public async Task<IReadOnlyList<Ingredient>> GetAllAsync(CancellationToken cancellationToken) => await db.Ingredients.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(cancellationToken);

    public async Task SaveAsync(string name, string category, CancellationToken cancellationToken)
    {
        await SaveManyAsync([(name, category)], cancellationToken);
    }

    public async Task SaveManyAsync(IReadOnlyCollection<(string Name, string Category)> ingredients, CancellationToken cancellationToken)
    {
        if (ingredients.Count == 0) return;
        var existingIngredients = await db.Ingredients.ToArrayAsync(cancellationToken);
        foreach (var (name, category) in ingredients)
        {
            if (string.IsNullOrWhiteSpace(name)) continue;
            var normalizedName = name.Trim().ToLowerInvariant();
            var normalizedCategory = string.IsNullOrWhiteSpace(category) ? "Otros" : category.Trim();
            var existing = existingIngredients.SingleOrDefault(x =>
                string.Equals(x.Name, normalizedName, StringComparison.OrdinalIgnoreCase));
            if (existing is null)
            {
                existing = new Ingredient(normalizedName, normalizedCategory);
                db.Ingredients.Add(existing);
                existingIngredients = [.. existingIngredients, existing];
            }
            else
            {
                db.Entry(existing).Property(x => x.Category).CurrentValue = normalizedCategory;
                db.Entry(existing).Property(x => x.UpdatedAtUtc).CurrentValue = DateTimeOffset.UtcNow;
            }
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}