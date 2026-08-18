using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

internal sealed class BatchCookingRepository(VitalityNutriDbContext dbContext) : IBatchCookingRepository
{
    public Task<BatchCookingState?> GetByPlanIdAsync(long planId, CancellationToken cancellationToken) =>
        dbContext.BatchCookingStates.AsNoTracking().FirstOrDefaultAsync(x => x.PlanId == planId, cancellationToken);

    public async Task SaveAsync(BatchCookingState state, CancellationToken cancellationToken)
    {
        var existing = await dbContext.BatchCookingStates.SingleOrDefaultAsync(x => x.PlanId == state.PlanId, cancellationToken);
        if (existing is null)
        {
            dbContext.BatchCookingStates.Add(state);
        }
        else
        {
            existing.Update(state.GuideJson, state.ParamsJson);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task ResetAsync(long planId, CancellationToken cancellationToken)
    {
        var existing = await dbContext.BatchCookingStates.SingleOrDefaultAsync(x => x.PlanId == planId, cancellationToken);
        if (existing is null)
        {
            return;
        }

        dbContext.BatchCookingStates.Remove(existing);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}