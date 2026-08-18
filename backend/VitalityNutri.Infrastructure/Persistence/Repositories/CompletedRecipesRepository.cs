using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;
namespace VitalityNutri.Infrastructure.Persistence.Repositories;
internal sealed class CompletedRecipesRepository(VitalityNutriDbContext db) : ICompletedRecipesRepository
{
    public Task<CompletedRecipesState?> GetByPlanIdAsync(long planId, CancellationToken cancellationToken) => db.CompletedRecipesStates.AsNoTracking().FirstOrDefaultAsync(x => x.PlanId == planId, cancellationToken);

    public async Task SaveAsync(CompletedRecipesState state, CancellationToken cancellationToken)
    {
        var existing = await db.CompletedRecipesStates.SingleOrDefaultAsync(x => x.PlanId == state.PlanId, cancellationToken);
        if (existing is null)
        {
            db.CompletedRecipesStates.Add(state);
        }
        else
        {
            existing.Update(state.CompletedJson);
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}