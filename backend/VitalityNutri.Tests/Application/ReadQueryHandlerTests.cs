using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.CompletedRecipes.GetCompletedRecipes;
using VitalityNutri.Application.GroceryLists.GetGroceryList;
using VitalityNutri.Application.Plans.GetPlanById;
using VitalityNutri.Domain.Entities;
namespace VitalityNutri.Tests.Application;
public sealed class ReadQueryHandlerTests
{
    [Fact] public async Task GroceryDefaults_AreLegacyCompatible()
    {
        var result = await new GetGroceryListQueryHandler(new GroceryRepo()).Handle(new(), default);
        Assert.Equal("semanal", result.ListType); Assert.Equal("{}", result.CheckedItems.GetRawText());
    }
    [Fact] public async Task CompletedRecipes_IsEmptyWithoutActivePlan()
    {
        var result = await new GetCompletedRecipesQueryHandler(new PlanRepo(), new CompletedRepo()).Handle(new(), default);
        Assert.Equal("{}", result.GetRawText());
    }
    [Fact] public async Task CompletedRecipes_ReadsPlanZeroWithoutActivePlan()
    {
        var result = await new GetCompletedRecipesQueryHandler(
            new PlanRepo(), new CompletedRepo(new CompletedRecipesState(0, "{\"saved\":true}"))).Handle(new(), default);
        Assert.True(result.GetProperty("saved").GetBoolean());
    }
    [Fact] public async Task PlanIdValidator_RejectsZero()
    {
        Assert.False((await new GetPlanByIdQueryValidator().ValidateAsync(new GetPlanByIdQuery(0))).IsValid);
    }
    private sealed class GroceryRepo : IGroceryListRepository
    {
        public Task<GroceryListState?> GetAsync(CancellationToken t) => Task.FromResult<GroceryListState?>(null);
        public Task SaveAsync(GroceryListState state, CancellationToken t) => Task.CompletedTask;
    }
    private sealed class CompletedRepo(CompletedRecipesState? state = null) : ICompletedRecipesRepository
    {
        public Task<CompletedRecipesState?> GetByPlanIdAsync(long id, CancellationToken t) => Task.FromResult(state);
        public Task SaveAsync(CompletedRecipesState state, CancellationToken t) => Task.CompletedTask;
    }
    private sealed class PlanRepo : IPlanRepository
    {
        public Task<MealPlan?> GetActiveAsync(CancellationToken t) => Task.FromResult<MealPlan?>(null);
        public Task<MealPlan?> GetByIdAsync(long id, CancellationToken t) => Task.FromResult<MealPlan?>(null);
        public Task<IReadOnlyList<MealPlan>> GetHistoryAsync(CancellationToken t) => Task.FromResult<IReadOnlyList<MealPlan>>([]);
        public Task ResetActiveAsync(CancellationToken t) => Task.CompletedTask;
        public Task<MealPlan?> RestoreAsync(long id, CancellationToken t) => Task.FromResult<MealPlan?>(null);
        public Task<bool> DeleteAsync(long id, CancellationToken t) => Task.FromResult(false);
        public Task SaveAsync(MealPlan plan, CancellationToken t) => Task.CompletedTask;
    }
}
