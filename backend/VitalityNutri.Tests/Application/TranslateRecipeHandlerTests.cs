using System.Text.Json;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Common;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Application.Recipes.Translate;
using VitalityNutri.Domain.Entities;
using Xunit;

namespace VitalityNutri.Tests.Application;

public sealed class TranslateRecipeHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsNull_WhenRecipeNotFound()
    {
        var repo = new RecipeRepositoryStub(null);
        var cache = new RecipeTranslationRepositoryStub();
        var translationService = new TranslationServiceStub();
        var handler = new TranslateRecipeCommandHandler(repo, cache, translationService);

        var result = await handler.Handle(new TranslateRecipeCommand(404, "en"), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Handle_TranslatesRecipe_WhenFound()
    {
        var recipe = new Recipe(
            "Ensalada Mixta",
            150,
            "10 min",
            "lunch",
            null,
            """[{"name":"Lechuga","amount":100,"unit":"g"}]""",
            "Servir fresca.",
            """["Lavar lechuga","Mezclar"]""",
            "Rica en fibra y minerales.",
            null,
            1,
            "manual",
            null,
            false,
            false,
            "Todas",
            "es");

        var repo = new RecipeRepositoryStub(recipe);
        var cache = new RecipeTranslationRepositoryStub();
        var translationService = new TranslationServiceStub();
        var handler = new TranslateRecipeCommandHandler(repo, cache, translationService);

        var result = await handler.Handle(new TranslateRecipeCommand(recipe.Id, "en"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Mixed Salad", result.RecipeName);
        Assert.Equal("Serve fresh.", result.Tips);
        Assert.Equal("Rich in fiber and minerals.", result.NutritionistTips);
        Assert.Equal("es", result.SourceLanguage);
        Assert.Equal("en", result.TargetLanguage);
        Assert.True(result.IsAiTranslated);

        // Verify it was cached
        var cached = await cache.GetAsync(recipe.Id, "en", CancellationToken.None);
        Assert.NotNull(cached);
        Assert.Equal("Mixed Salad", cached.RecipeName);
    }

    [Fact]
    public async Task Handle_ReturnsCachedTranslation_WhenAvailable()
    {
        var recipe = new Recipe(
            "Ensalada Mixta",
            150,
            "10 min",
            "lunch",
            null,
            """[{"name":"Lechuga","amount":100,"unit":"g"}]""",
            "Servir fresca.",
            """["Lavar lechuga","Mezclar"]""",
            null,
            null,
            1,
            "manual",
            null,
            false,
            false,
            "Todas",
            "es");

        var repo = new RecipeRepositoryStub(recipe);
        var cache = new RecipeTranslationRepositoryStub();
        await cache.SaveAsync(new RecipeTranslation(
            recipe.Id,
            "en",
            "Cached Salad",
            "Cached tips.",
            "Cached nutri tip.",
            """[{"name":"Lettuce","amount":100,"unit":"g"}]""",
            """["Wash lettuce"]""",
            true), CancellationToken.None);

        var translationService = new TranslationServiceStub();
        var handler = new TranslateRecipeCommandHandler(repo, cache, translationService);

        var result = await handler.Handle(new TranslateRecipeCommand(recipe.Id, "en"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Cached Salad", result.RecipeName);
        Assert.Equal("Cached tips.", result.Tips);
        Assert.Equal("Cached nutri tip.", result.NutritionistTips);
        Assert.Equal(0, translationService.CallCount); // Verified cache hit bypassed AI call
    }

    [Fact]
    public async Task Handle_ReturnsOriginal_WhenLanguagesMatch()
    {
        var recipe = new Recipe(
            "Ensalada Mixta",
            150,
            "10 min",
            "lunch",
            null,
            """[{"name":"Lechuga","amount":100,"unit":"g"}]""",
            "Servir fresca.",
            """["Lavar lechuga","Mezclar"]""",
            null,
            null,
            1,
            "manual",
            null,
            false,
            false,
            "Todas",
            "es");

        var repo = new RecipeRepositoryStub(recipe);
        var cache = new RecipeTranslationRepositoryStub();
        var translationService = new TranslationServiceStub();
        var handler = new TranslateRecipeCommandHandler(repo, cache, translationService);

        var result = await handler.Handle(new TranslateRecipeCommand(recipe.Id, "es"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Ensalada Mixta", result.RecipeName);
        Assert.False(result.IsAiTranslated);
        Assert.Equal(0, translationService.CallCount);
    }

    private sealed class RecipeRepositoryStub(Recipe? recipe) : IRecipeRepository
    {
        public Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Recipe>>(recipe is null ? [] : [recipe]);

        public Task<Recipe?> GetByIdAsync(long id, CancellationToken cancellationToken) =>
            Task.FromResult(recipe);

        public Task<long> AddAsync(Recipe recipe, CancellationToken cancellationToken) => Task.FromResult(1L);
        public Task UpdateAsync(long id, RecipeWriteModel model, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<bool?> ToggleFavoriteAsync(long id, CancellationToken cancellationToken) => Task.FromResult<bool?>(true);
        public Task DeleteAsync(long id, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class RecipeTranslationRepositoryStub : IRecipeTranslationRepository
    {
        private readonly Dictionary<(long, string), RecipeTranslation> _store = new();

        public Task<RecipeTranslation?> GetAsync(long recipeId, string targetLanguage, CancellationToken cancellationToken)
        {
            _store.TryGetValue((recipeId, targetLanguage.ToLowerInvariant()), out var translation);
            return Task.FromResult(translation);
        }

        public Task SaveAsync(RecipeTranslation translation, CancellationToken cancellationToken)
        {
            _store[(translation.RecipeId, translation.TargetLanguage.ToLowerInvariant())] = translation;
            return Task.CompletedTask;
        }

        public Task InvalidateAsync(long recipeId, CancellationToken cancellationToken)
        {
            var keysToRemove = _store.Keys.Where(k => k.Item1 == recipeId).ToList();
            foreach (var key in keysToRemove)
            {
                _store.Remove(key);
            }
            return Task.CompletedTask;
        }
    }

    private sealed class TranslationServiceStub : ITextTranslationService
    {
        public int CallCount { get; private set; }

        public Task<RecipeTranslationResult> TranslateRecipeAsync(RecipeTranslationInput input, CancellationToken cancellationToken)
        {
            CallCount++;
            return Task.FromResult(new RecipeTranslationResult(
                "Mixed Salad",
                "Serve fresh.",
                input.NutritionistTips is not null ? "Rich in fiber and minerals." : null,
                input.Ingredients,
                input.Steps,
                input.TargetLanguage,
                true));
        }

        public Task<string> TranslateTextAsync(string text, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken)
        {
            return Task.FromResult("Translated text");
        }

        public Task<string> TranslatePlanJsonAsync(string planJson, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken)
        {
            return Task.FromResult(planJson);
        }
    }
}
