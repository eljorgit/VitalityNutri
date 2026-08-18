using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Application.Search.GetAllRecipes;
using VitalityNutri.Application.Search.GetSearchHistory;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Tests.Application;

public sealed class SearchHandlerTests
{
    [Fact]
    public async Task AllRecipes_CombinesPlanAndRecetarioSources()
    {
        const string planJson = """
            {
              "days": {
                "monday": {
                  "lunch": {
                    "recipeName": "Plan Soup",
                    "calories": 210,
                    "time": "25 min",
                    "tag": "Lunch",
                    "image": "",
                    "ingredients": [
                      { "name": "Carrot" },
                      { "name": "Onion" }
                    ]
                  }
                }
              }
            }
            """;

        var plan = new MealPlan(planJson, "{}", "weekly.pdf");
        var recetario = new Recipe("Book Salad", 150, "15 min", "Dinner", null,
            "[{\"name\":\"Lettuce\"}]", "", "[]", null, null,
            1, "manual", null, false, false, "Todas");

        var result = await new GetAllRecipesQueryHandler(
            new PlanRepositoryStub([plan]),
            new RecipeRepositoryStub([recetario]))
            .Handle(new GetAllRecipesQuery(), default);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, item => item.RecipeName == "Plan Soup" && item.Day == "monday" && item.Meal == "lunch");
        Assert.Contains(result, item => item.RecipeName == "Book Salad" && item.IsRecetario == true && item.PlanId == -1);
    }

    [Fact]
    public async Task SearchHistory_ReturnsRecentItems()
    {
        var items = new[] { new SearchHistoryItem(1, "Plan", "monday", "lunch", "Soup", "", true) };
        var result = await new GetSearchHistoryQueryHandler(new SearchHistoryRepositoryStub(items)).Handle(new(), default);
        Assert.Single(result);
        Assert.Equal("Soup", result[0].RecipeName);
    }

    private sealed class PlanRepositoryStub(IReadOnlyList<MealPlan> values) : IPlanRepository
    {
        public Task<MealPlan?> GetActiveAsync(CancellationToken cancellationToken) => Task.FromResult<MealPlan?>(values.FirstOrDefault(x => x.IsActive));
        public Task<MealPlan?> GetByIdAsync(long id, CancellationToken cancellationToken) => Task.FromResult(values.FirstOrDefault(x => x.Id == id));
        public Task<IReadOnlyList<MealPlan>> GetHistoryAsync(CancellationToken cancellationToken) => Task.FromResult(values);
        public Task ResetActiveAsync(CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<MealPlan?> RestoreAsync(long id, CancellationToken cancellationToken) => Task.FromResult<MealPlan?>(null);
        public Task<bool> DeleteAsync(long id, CancellationToken cancellationToken) => Task.FromResult(false);
        public Task SaveAsync(MealPlan plan, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class RecipeRepositoryStub(IReadOnlyList<Recipe> values) : IRecipeRepository
    {
        public Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken cancellationToken) => Task.FromResult(values);
        public Task<Recipe?> GetByIdAsync(long id, CancellationToken cancellationToken) => Task.FromResult<Recipe?>(null);
        public Task<long> AddAsync(Recipe recipe, CancellationToken cancellationToken) => Task.FromResult(1L);
        public Task UpdateAsync(long id, RecipeWriteModel recipe, CancellationToken cancellationToken) => Task.CompletedTask;
      public Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<bool?> ToggleFavoriteAsync(long id, CancellationToken cancellationToken) => Task.FromResult<bool?>(null);
        public Task DeleteAsync(long id, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class SearchHistoryRepositoryStub(IReadOnlyList<SearchHistoryItem> values) : ISearchHistoryRepository
    {
        public Task<IReadOnlyList<SearchHistoryItem>> GetRecentAsync(int limit, CancellationToken cancellationToken) => Task.FromResult(values.Take(limit).ToArray() as IReadOnlyList<SearchHistoryItem>);
        public Task AddAsync(SearchHistoryItem item, int limit, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task DeleteAsync(long id, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task ClearAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}