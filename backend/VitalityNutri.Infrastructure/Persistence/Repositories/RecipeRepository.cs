using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

internal sealed class RecipeRepository(VitalityNutriDbContext dbContext) : IRecipeRepository
{
    public async Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken cancellationToken)
    {
        var query = dbContext.Recipes.AsNoTracking();
        if (dbContext.Database.IsSqlite())
        {
            return (await query.ToArrayAsync(cancellationToken))
                .OrderByDescending(recipe => recipe.CreatedAtUtc)
                .ToArray();
        }

        return await query.OrderByDescending(recipe => recipe.CreatedAtUtc).ToArrayAsync(cancellationToken);
    }

    public Task<Recipe?> GetByIdAsync(long id, CancellationToken cancellationToken) =>
        dbContext.Recipes.AsNoTracking().FirstOrDefaultAsync(recipe => recipe.Id == id, cancellationToken);

    public async Task<long> AddAsync(Recipe recipe, CancellationToken cancellationToken)
    {
        dbContext.Recipes.Add(recipe);
        await dbContext.SaveChangesAsync(cancellationToken);
        return recipe.Id;
    }

    public async Task UpdateAsync(long id, RecipeWriteModel model, CancellationToken cancellationToken)
    {
        var recipe = await dbContext.Recipes.FindAsync([id], cancellationToken);
        if (recipe is null) return;
        recipe.Update(model.RecipeName, model.Calories, model.Time, model.Tag, model.Image,
            model.Ingredients.GetRawText(), model.Tips, model.Steps.GetRawText(),
            model.NutritionistTips, model.Nutrition?.GetRawText(), model.Servings,
            model.Source, model.SourcePlanId, model.IsAiGenerated, model.IsFavorite, model.Season);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken)
    {
        var recipe = await dbContext.Recipes.FindAsync([id], cancellationToken);
        if (recipe is null)
        {
            return;
        }

        recipe.Update(recipe.RecipeName, recipe.Calories, recipe.Time, recipe.Tag, image,
            recipe.IngredientsJson, recipe.Tips, recipe.StepsJson,
            recipe.NutritionistTips, recipe.NutritionJson, recipe.Servings,
            recipe.Source, recipe.SourcePlanId, recipe.IsAiGenerated, recipe.IsFavorite, recipe.Season);

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool?> ToggleFavoriteAsync(long id, CancellationToken cancellationToken)
    {
        var recipe = await dbContext.Recipes.FindAsync([id], cancellationToken);
        if (recipe is null) return null;
        var result = recipe.ToggleFavorite();
        await dbContext.SaveChangesAsync(cancellationToken);
        return result;
    }

    public async Task DeleteAsync(long id, CancellationToken cancellationToken)
    {
        var recipe = await dbContext.Recipes.FindAsync([id], cancellationToken);
        if (recipe is null) return;
        dbContext.Recipes.Remove(recipe);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}