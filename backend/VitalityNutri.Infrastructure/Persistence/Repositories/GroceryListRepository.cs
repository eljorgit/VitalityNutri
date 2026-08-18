using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;
namespace VitalityNutri.Infrastructure.Persistence.Repositories;
internal sealed class GroceryListRepository(VitalityNutriDbContext db) : IGroceryListRepository
{
    public Task<GroceryListState?> GetAsync(CancellationToken cancellationToken) => db.GroceryListStates.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, cancellationToken);

    public async Task SaveAsync(GroceryListState state, CancellationToken cancellationToken)
    {
        var existing = await db.GroceryListStates.SingleOrDefaultAsync(x => x.Id == state.Id, cancellationToken);
        if (existing is null)
        {
            db.GroceryListStates.Add(state);
        }
        else
        {
            existing.Update(state.CheckedItemsJson, state.ListType, state.SelectedSingleDay,
                state.SelectedThreeDaysStart, state.ExcludedMealsJson, state.MultipliersJson);
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}