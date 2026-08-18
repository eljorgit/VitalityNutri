using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Application.Recipes.GetFavoriteStatus;
using VitalityNutri.Application.Recipes.GetRecipeTags;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Tests.Application;

public sealed class RecipeHandlerTests
{
    [Fact]
    public async Task Tags_AreDistinctAndIgnoreMissingValues()
    {
        var repository = new Recipes([Create("Soup", "Lunch"), Create("Salad", "Lunch"), Create("Toast", null)]);

        var result = await new GetRecipeTagsQueryHandler(repository).Handle(new(), default);

        Assert.Equal(["Lunch"], result);
    }

    [Fact]
    public async Task MissingFavoriteStatus_ReturnsFalseWithoutId()
    {
        var result = await new GetFavoriteStatusQueryHandler(new Recipes([])).Handle(new(99), default);

        Assert.False(result.IsFavorite);
        Assert.Null(result.Id);
    }

    private static Recipe Create(string name, string? tag) =>
        new(name, 100, "20 min", tag, null, "[]", "", "[]", null, null, 1, "manual", null, false, false, "Todas");

    private sealed class Recipes(IReadOnlyList<Recipe> values) : IRecipeRepository
    {
        public Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken token) => Task.FromResult(values);
        public Task<Recipe?> GetByIdAsync(long id, CancellationToken token) => Task.FromResult<Recipe?>(null);
        public Task<long> AddAsync(Recipe recipe, CancellationToken token) => Task.FromResult(1L);
        public Task UpdateAsync(long id, RecipeWriteModel recipe, CancellationToken token) => Task.CompletedTask;
        public Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<bool?> ToggleFavoriteAsync(long id, CancellationToken token) => Task.FromResult<bool?>(null);
        public Task DeleteAsync(long id, CancellationToken token) => Task.CompletedTask;
    }
}