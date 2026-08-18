using System.Text.Json;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Application.Recipes.ReportBrokenImage;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Tests.Application;

public sealed class ReportBrokenRecipeImageTests
{
    [Fact]
    public async Task ReportBrokenRecipeImage_PropagatesToAllPlanSlotsWithSameRecipe()
    {
        var planJson = """
        {
          "days": {
            "monday": {
              "lunch": { "id": 55, "recipeName": "Ensalada César", "image": "https://broken.example.com/old.jpg" }
            },
            "thursday": {
              "dinner": { "id": 55, "recipeName": "Ensalada César", "image": "https://broken.example.com/old.jpg" }
            },
            "friday": {
              "lunch": { "id": 99, "recipeName": "Pollo al curry", "image": "https://valid.example.com/curry.jpg" }
            }
          }
        }
        """;

        var fakePlan = new MealPlan(planJson, "{\"id\":1}", "plan.pdf", "plan.pdf");
        var fakePlanRepo = new FakePlanRepository(fakePlan);
        var fakeRecipeRepo = new FakeRecipeRepository();
        var fakeImageService = new FakeImageService("https://images.unsplash.com/photo-new-cesar.jpg");

        var handler = new ReportBrokenRecipeImageCommandHandler(fakeRecipeRepo, fakePlanRepo, fakeImageService);
        var result = await handler.Handle(
            new ReportBrokenRecipeImageCommand(55, "Ensalada César", 1, "monday", "lunch", "https://broken.example.com/old.jpg"),
            CancellationToken.None);

        Assert.Equal("https://images.unsplash.com/photo-new-cesar.jpg", result);

        // Verify that BOTH monday lunch and thursday dinner were updated in the plan
        using var doc = JsonDocument.Parse(fakePlan.PlanJson);
        var mondayImage = doc.RootElement.GetProperty("days").GetProperty("monday").GetProperty("lunch").GetProperty("image").GetString();
        var thursdayImage = doc.RootElement.GetProperty("days").GetProperty("thursday").GetProperty("dinner").GetProperty("image").GetString();
        var fridayImage = doc.RootElement.GetProperty("days").GetProperty("friday").GetProperty("lunch").GetProperty("image").GetString();

        Assert.Equal("https://images.unsplash.com/photo-new-cesar.jpg", mondayImage);
        Assert.Equal("https://images.unsplash.com/photo-new-cesar.jpg", thursdayImage);
        Assert.Equal("https://valid.example.com/curry.jpg", fridayImage);
    }

    private sealed class FakePlanRepository(MealPlan plan) : IPlanRepository
    {
        public Task<MealPlan?> GetActiveAsync(CancellationToken cancellationToken) => Task.FromResult<MealPlan?>(plan);
        public Task<MealPlan?> GetByIdAsync(long id, CancellationToken cancellationToken) => Task.FromResult<MealPlan?>(plan);
        public Task<IReadOnlyList<MealPlan>> GetHistoryAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<MealPlan>>([plan]);
        public Task SaveAsync(MealPlan p, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<bool> DeleteAsync(long id, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task ResetActiveAsync(CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<MealPlan?> RestoreAsync(long id, CancellationToken cancellationToken) => Task.FromResult<MealPlan?>(plan);
    }

    private sealed class FakeRecipeRepository : IRecipeRepository
    {
        public Task<long> AddAsync(Recipe recipe, CancellationToken cancellationToken) => Task.FromResult(1L);
        public Task DeleteAsync(long id, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<Recipe>>([]);
        public Task<Recipe?> GetByIdAsync(long id, CancellationToken cancellationToken) =>
            Task.FromResult<Recipe?>(new Recipe("Ensalada César", 200, "15 min", "lunch", null, "[]", "", "[]", null, null, 1, "plan", null, false, false, "Todas"));
        public Task<bool?> ToggleFavoriteAsync(long id, CancellationToken cancellationToken) => Task.FromResult<bool?>(null);
        public Task UpdateAsync(long id, RecipeWriteModel recipe, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class FakeImageService(string replacementUrl) : IRecipeImageLookupService
    {
        public Task<string> ResolveContextualImageAsync(string recipeName, string mealType, CancellationToken cancellationToken) =>
            Task.FromResult(replacementUrl);
        public Task<string> ResolveReplacementImageAsync(string recipeName, string mealType, IReadOnlyCollection<string> excludedUrls, CancellationToken cancellationToken) =>
            Task.FromResult(replacementUrl);
        public Task<IReadOnlyList<string>> SearchImagesAsync(string query, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<string>>([replacementUrl]);
    }
}
