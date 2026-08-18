using VitalityNutri.Domain.Entities;
namespace VitalityNutri.Application.Abstractions.Persistence;
public interface IGroceryListRepository
{
	Task<GroceryListState?> GetAsync(CancellationToken cancellationToken);
	Task SaveAsync(GroceryListState state, CancellationToken cancellationToken);
}