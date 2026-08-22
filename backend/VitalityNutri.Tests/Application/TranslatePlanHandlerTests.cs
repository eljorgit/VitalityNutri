using System.Text.Json;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Plans.TranslatePlan;
using VitalityNutri.Domain.Entities;
using Xunit;

namespace VitalityNutri.Tests.Application;

public sealed class TranslatePlanHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsNull_WhenPlanNotFound()
    {
        var planRepo = new PlanRepositoryStub(null);
        var cache = new PlanTranslationRepositoryStub();
        var translationService = new TranslationServiceStub();
        var handler = new TranslatePlanCommandHandler(planRepo, cache, translationService);

        var result = await handler.Handle(new TranslatePlanCommand(null, "en"), CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task Handle_TranslatesPlan_AndPersistsToCache()
    {
        var plan = new MealPlan(
            """{"days":{"monday":{"lunch":{"recipeName":"Ensalada"}}}}""",
            """{"name":"Semana 1"}""",
            "plan.pdf",
            null,
            "es");

        var planRepo = new PlanRepositoryStub(plan);
        var cache = new PlanTranslationRepositoryStub();
        var translationService = new TranslationServiceStub();
        var handler = new TranslatePlanCommandHandler(planRepo, cache, translationService);

        var result = await handler.Handle(new TranslatePlanCommand(plan.Id, "en"), CancellationToken.None);

        Assert.NotNull(result);
        var root = result.Plan;
        Assert.True(root.TryGetProperty("days", out var days));
        Assert.Equal("Salad", days.GetProperty("monday").GetProperty("lunch").GetProperty("recipeName").GetString());

        var cached = await cache.GetAsync(plan.Id, "en", CancellationToken.None);
        Assert.NotNull(cached);
        Assert.True(cached.IsAiTranslated);
    }

    [Fact]
    public async Task Handle_ReturnsCachedPlan_WhenAvailable()
    {
        var plan = new MealPlan(
            """{"days":{"monday":{"lunch":{"recipeName":"Ensalada"}}}}""",
            """{"name":"Semana 1"}""",
            "plan.pdf",
            null,
            "es");

        var planRepo = new PlanRepositoryStub(plan);
        var cache = new PlanTranslationRepositoryStub();
        await cache.SaveAsync(new MealPlanTranslation(
            plan.Id,
            "en",
            """{"days":{"monday":{"lunch":{"recipeName":"Cached Salad"}}}}""",
            true), CancellationToken.None);

        var translationService = new TranslationServiceStub();
        var handler = new TranslatePlanCommandHandler(planRepo, cache, translationService);

        var result = await handler.Handle(new TranslatePlanCommand(plan.Id, "en"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Cached Salad", result.Plan.GetProperty("days").GetProperty("monday").GetProperty("lunch").GetProperty("recipeName").GetString());
        Assert.Equal(0, translationService.CallCount); // Verified cache hit bypassed AI call
    }

    private sealed class PlanRepositoryStub(MealPlan? plan) : IPlanRepository
    {
        public Task<MealPlan?> GetActiveAsync(CancellationToken cancellationToken) => Task.FromResult(plan);
        public Task<MealPlan?> GetByIdAsync(long id, CancellationToken cancellationToken) => Task.FromResult(plan);
        public Task<IReadOnlyList<MealPlan>> GetHistoryAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<MealPlan>>(plan is null ? [] : [plan]);
        public Task ResetActiveAsync(CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<MealPlan?> RestoreAsync(long id, CancellationToken cancellationToken) => Task.FromResult(plan);
        public Task<bool> DeleteAsync(long id, CancellationToken cancellationToken) => Task.FromResult(true);
        public Task SaveAsync(MealPlan p, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class PlanTranslationRepositoryStub : IPlanTranslationRepository
    {
        private readonly Dictionary<(long, string), MealPlanTranslation> _store = new();

        public Task<MealPlanTranslation?> GetAsync(long planId, string targetLanguage, CancellationToken cancellationToken)
        {
            _store.TryGetValue((planId, targetLanguage.ToLowerInvariant()), out var translation);
            return Task.FromResult(translation);
        }

        public Task SaveAsync(MealPlanTranslation translation, CancellationToken cancellationToken)
        {
            _store[(translation.PlanId, translation.TargetLanguage.ToLowerInvariant())] = translation;
            return Task.CompletedTask;
        }

        public Task InvalidateAsync(long planId, CancellationToken cancellationToken)
        {
            var keysToRemove = _store.Keys.Where(k => k.Item1 == planId).ToList();
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
            return Task.FromResult(new RecipeTranslationResult(input.RecipeName, input.Tips, input.NutritionistTips, input.Ingredients, input.Steps, input.TargetLanguage, false));
        }

        public Task<string> TranslateTextAsync(string text, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken)
        {
            return Task.FromResult(text);
        }

        public Task<string> TranslatePlanJsonAsync(string planJson, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken)
        {
            CallCount++;
            return Task.FromResult("""{"days":{"monday":{"lunch":{"recipeName":"Salad"}}}}""");
        }
    }
}
