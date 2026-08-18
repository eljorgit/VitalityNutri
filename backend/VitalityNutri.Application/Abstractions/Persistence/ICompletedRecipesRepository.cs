using VitalityNutri.Domain.Entities;
namespace VitalityNutri.Application.Abstractions.Persistence;
public interface ICompletedRecipesRepository
{
	Task<CompletedRecipesState?> GetByPlanIdAsync(long planId, CancellationToken cancellationToken);
	Task SaveAsync(CompletedRecipesState state, CancellationToken cancellationToken);
}