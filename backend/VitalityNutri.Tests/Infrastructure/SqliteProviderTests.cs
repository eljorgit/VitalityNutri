using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Domain.Entities;
using VitalityNutri.Infrastructure.Persistence;
using VitalityNutri.Infrastructure.Persistence.Repositories;
namespace VitalityNutri.Tests.Infrastructure;
public sealed class SqliteProviderTests
{
    [Fact]
    public async Task MigrationAndRepositories_Work()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<VitalityNutriDbContext>()
            .UseSqlite(connection, x => x.MigrationsAssembly("VitalityNutri.Migrations.Sqlite")).Options;
        await using var db = new VitalityNutriDbContext(options);
        await db.Database.MigrateAsync();
        db.MealPlans.Add(new MealPlan("{\"days\":{}}", "{}", "oss.pdf"));
        db.MealPlans.Add(new MealPlan("{\"days\":{}}", "{}", "other.pdf"));
        db.Ingredients.Add(new Ingredient("Apple", "Fruit"));
        await db.SaveChangesAsync();

        var groceryRepository = new GroceryListRepository(db);
        await groceryRepository.SaveAsync(new GroceryListState("{\"apples\":true}", "semanal", "", "", "[]", "{\"global\":1}"), default);
        var completedRepository = new CompletedRecipesRepository(db);
        await completedRepository.SaveAsync(new CompletedRecipesState(0, "{\"monday-breakfast\":true}"), default);

        var planRepository = new PlanRepository(db);
        var history = await planRepository.GetHistoryAsync(default);
        Assert.Equal(2, history.Count);
        await planRepository.ResetActiveAsync(default);
        Assert.Null(await planRepository.GetActiveAsync(default));
        var restored = await planRepository.RestoreAsync(history[0].Id, default);
        Assert.NotNull(restored);
        restored.ReplacePlanJson("{\"days\":{},\"updated\":true}");
        await planRepository.SaveAsync(restored, default);
        Assert.Contains("updated", (await planRepository.GetByIdAsync(restored.Id, default))?.PlanJson);
        Assert.True(await planRepository.DeleteAsync(history[1].Id, default));

        Assert.Single(await new IngredientRepository(db).GetAllAsync(default));
        var ingredientRepository = new IngredientRepository(db);
        await ingredientRepository.SaveAsync("APPLE", "Produce", default);
        Assert.Equal("Produce", (await ingredientRepository.GetAllAsync(default))[0].Category);
        Assert.Equal("semanal", (await groceryRepository.GetAsync(default))?.ListType);
        Assert.Contains("monday-breakfast", (await completedRepository.GetByPlanIdAsync(0, default))?.CompletedJson);

        var recipeRepository = new RecipeRepository(db);
        var recipe = new Recipe("Soup", 250, "30 min", "Lunch", null, "[]", "", "[]", null, null, 2, "manual", null, false, false, "Winter");
        var recipeId = await recipeRepository.AddAsync(recipe, default);
        Assert.NotEqual(0, recipeId);
        Assert.Single(await recipeRepository.GetAllAsync(default));
        var writeModel = new RecipeWriteModel("Soup", 300, "35 min", "Dinner", null,
            JsonSerializer.Deserialize<JsonElement>("[]"), "Updated", JsonSerializer.Deserialize<JsonElement>("[]"),
            null, null, 2, "manual", null, false, false, "Winter");
        await recipeRepository.UpdateAsync(recipeId, writeModel, default);
        Assert.Equal(300, (await recipeRepository.GetByIdAsync(recipeId, default))?.Calories);
        Assert.True(await recipeRepository.ToggleFavoriteAsync(recipeId, default));
        await recipeRepository.DeleteAsync(recipeId, default);
        Assert.Empty(await recipeRepository.GetAllAsync(default));

        var searchHistoryRepository = new SearchHistoryRepository(db);
        for (var i = 1; i <= 12; i++)
        {
            await searchHistoryRepository.AddAsync(new SearchHistoryItem(i, $"Plan {i}", "monday", "lunch", $"Recipe {i}", string.Empty, false), 10, default);
        }

        var recent = await searchHistoryRepository.GetRecentAsync(10, default);
        Assert.Equal(10, recent.Count);
        Assert.DoesNotContain(recent, item => item.PlanId == 1 || item.PlanId == 2);
        await searchHistoryRepository.DeleteAsync(recent[0].Id, default);
        Assert.Equal(9, (await searchHistoryRepository.GetRecentAsync(10, default)).Count);
        await searchHistoryRepository.ClearAsync(default);
        Assert.Empty(await searchHistoryRepository.GetRecentAsync(10, default));

        var backupRepository = new BackupRepository(db);
        var exported = await backupRepository.ExportAsync(default);
        Assert.Equal(1, exported.Version);
        Assert.Single(exported.Plans);

        var importPayload = JsonSerializer.SerializeToElement(new
        {
            version = 1,
            exportedAt = DateTimeOffset.UtcNow,
            plans = new[]
            {
                new
                {
                    id = 50,
                    file_name = "imported.pdf",
                    saved_file_name = "imported_saved.pdf",
                    plan_json = "{\"days\":{}}",
                    metadata_json = "{}",
                    is_active = 1,
                    created_at = DateTimeOffset.UtcNow,
                    file_hash = "abc"
                }
            },
            groceryListState = new[]
            {
                new
                {
                    id = 1,
                    checked_items_json = "{}",
                    list_type = "semanal",
                    selected_single_day = "",
                    selected_3days_start = "",
                    excluded_meals_json = "[]",
                    multipliers_json = "{}",
                    updated_at = DateTimeOffset.UtcNow
                }
            },
            completedRecipesState = new[]
            {
                new { plan_id = 50, completed_json = "{\"ok\":true}", updated_at = DateTimeOffset.UtcNow }
            },
            searchHistory = new[]
            {
                new
                {
                    id = 90,
                    plan_id = 50,
                    plan_name = "Imported",
                    day = "monday",
                    meal = "lunch",
                    recipe_name = "Soup",
                    image = "",
                    is_active = 1,
                    clicked_at = DateTimeOffset.UtcNow
                }
            }
        });

        await backupRepository.ImportAsync(importPayload, default);
        var importedPlan = await db.MealPlans.AsNoTracking().SingleAsync(default);
        Assert.Equal(50, importedPlan.Id);
        Assert.Equal("imported.pdf", importedPlan.FileName);
        Assert.Single(await db.GroceryListStates.AsNoTracking().ToArrayAsync(default));
        Assert.Single(await db.CompletedRecipesStates.AsNoTracking().ToArrayAsync(default));
        Assert.Single(await db.SearchHistoryItems.AsNoTracking().ToArrayAsync(default));

        var batchRepository = new BatchCookingRepository(db);
        await batchRepository.SaveAsync(new BatchCookingState(50, "{\"intro\":\"ok\"}", "{\"burnersCount\":4}"), default);
        Assert.NotNull(await batchRepository.GetByPlanIdAsync(50, default));
        await batchRepository.ResetAsync(50, default);
        Assert.Null(await batchRepository.GetByPlanIdAsync(50, default));
    }
}
