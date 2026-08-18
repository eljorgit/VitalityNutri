using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

internal sealed class PlanRepository(VitalityNutriDbContext dbContext) : IPlanRepository
{
    public Task<MealPlan?> GetActiveAsync(CancellationToken cancellationToken)
    {
        var query = dbContext.MealPlans
            .AsNoTracking()
            .Where(plan => plan.IsActive);
        return dbContext.Database.IsSqlite()
            ? GetLatestInMemoryAsync(query, cancellationToken)
            : query.OrderByDescending(plan => plan.UpdatedAtUtc).FirstOrDefaultAsync(cancellationToken);
    }

    public Task<MealPlan?> GetByIdAsync(long id, CancellationToken cancellationToken) =>
        dbContext.MealPlans.AsNoTracking().FirstOrDefaultAsync(plan => plan.Id == id, cancellationToken);

    public async Task<IReadOnlyList<MealPlan>> GetHistoryAsync(CancellationToken cancellationToken)
    {
        var query = dbContext.MealPlans.AsNoTracking();
        if (dbContext.Database.IsSqlite())
        {
            return (await query.ToArrayAsync(cancellationToken)).OrderByDescending(x => x.CreatedAtUtc).ToArray();
        }
        return await query.OrderByDescending(x => x.CreatedAtUtc).ToArrayAsync(cancellationToken);
    }

    private static async Task<MealPlan?> GetLatestInMemoryAsync(IQueryable<MealPlan> query, CancellationToken cancellationToken)
    {
        return (await query.ToArrayAsync(cancellationToken)).OrderByDescending(x => x.UpdatedAtUtc).FirstOrDefault();
    }

    public async Task ResetActiveAsync(CancellationToken cancellationToken)
    {
        var activePlans = await dbContext.MealPlans.Where(x => x.IsActive).ToArrayAsync(cancellationToken);
        foreach (var plan in activePlans) plan.Deactivate();
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<MealPlan?> RestoreAsync(long id, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
        var plans = await dbContext.MealPlans.ToArrayAsync(cancellationToken);
        var target = plans.FirstOrDefault(x => x.Id == id);
        if (target is null) return null;
        foreach (var plan in plans) plan.Deactivate();
        target.Activate();
        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return target;
    }

    public async Task<bool> DeleteAsync(long id, CancellationToken cancellationToken)
    {
        var plan = await dbContext.MealPlans.FindAsync([id], cancellationToken);
        if (plan is null) return false;
        var completion = await dbContext.CompletedRecipesStates.FindAsync([id], cancellationToken);
        if (completion is not null) dbContext.CompletedRecipesStates.Remove(completion);
        dbContext.MealPlans.Remove(plan);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task SaveAsync(MealPlan plan, CancellationToken cancellationToken)
    {
        dbContext.MealPlans.Update(plan);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
