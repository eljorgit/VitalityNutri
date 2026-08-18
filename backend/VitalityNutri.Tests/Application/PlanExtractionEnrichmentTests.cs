using System.Text.Json;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Application.Uploads;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Tests.Application;

public sealed class PlanExtractionEnrichmentTests
{
    [Fact]
    public async Task PlanRecipeSync_PreservesAssignedImageAndNutrition()
    {
        var planJson = """
        {
          "days": {
            "monday": {
              "lunch": {
                "recipeName": "Salmón con verduras",
                "calories": 309,
                "time": "25 min",
                "tag": "lunch",
                "image": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop",
                "ingredients": [
                  { "name": "Salmón", "originalAmount": 200, "unit": "g", "category": "fish and seafood" }
                ],
                "steps": ["Cocinar el salmón a la plancha."],
                "tips": "Usar aceite de oliva virgen extra.",
                "nutrition": {
                  "calories": 309,
                  "protein": 15,
                  "carbs": 30,
                  "sugars": 2,
                  "fat": 14,
                  "saturatedFat": 3,
                  "fiber": 7,
                  "sodium": 345,
                  "servingWeight": "266 g",
                  "extra": [
                    { "name": "Colesterol", "amount": 45, "unit": "mg" }
                  ]
                },
                "servings": 1
              }
            }
          }
        }
        """;

        var metadataJson = """{"id": 42}""";
        var fakeRepo = new FakeRecipeRepository();

        var enrichedPlanJson = await PlanRecipeSync.SyncAsync(planJson, metadataJson, fakeRepo, CancellationToken.None);

        Assert.Single(fakeRepo.Added);
        var addedRecipe = fakeRepo.Added[0];
        Assert.Equal("Salmón con verduras", addedRecipe.RecipeName);
        Assert.Equal(309, addedRecipe.Calories);
        Assert.Contains("photo-1467003909585-2f8a72700288", addedRecipe.Image);
        Assert.NotNull(addedRecipe.NutritionJson);

        // Verify ID was injected into returned planJson
        using var planDoc = JsonDocument.Parse(enrichedPlanJson);
        var lunchRecipe = planDoc.RootElement.GetProperty("days").GetProperty("monday").GetProperty("lunch");
        Assert.True(lunchRecipe.TryGetProperty("id", out var idElement));
        Assert.Equal(1L, idElement.GetInt64());

        using var doc = JsonDocument.Parse(addedRecipe.NutritionJson!);
        var root = doc.RootElement;
        Assert.Equal(309, root.GetProperty("calories").GetInt32());
        Assert.Equal(15, root.GetProperty("protein").GetInt32());
        Assert.Equal(30, root.GetProperty("carbs").GetInt32());
        Assert.Equal(14, root.GetProperty("fat").GetInt32());
        Assert.Equal(345, root.GetProperty("sodium").GetInt32());
        Assert.Equal("266 g", root.GetProperty("servingWeight").GetString());
        Assert.Equal(1, root.GetProperty("extra").GetArrayLength());
    }

    private sealed class FakeRecipeRepository : IRecipeRepository
    {
        public List<Recipe> Added { get; } = [];

        public Task<long> AddAsync(Recipe recipe, CancellationToken cancellationToken)
        {
            Added.Add(recipe);
            return Task.FromResult(1L);
        }

        public Task DeleteAsync(long id, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Recipe>>([]);

        public Task<Recipe?> GetByIdAsync(long id, CancellationToken cancellationToken) =>
            Task.FromResult<Recipe?>(null);

        public Task<bool?> ToggleFavoriteAsync(long id, CancellationToken cancellationToken) =>
            Task.FromResult<bool?>(null);

        public Task UpdateAsync(long id, RecipeWriteModel recipe, CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }
}
