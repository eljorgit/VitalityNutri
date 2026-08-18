using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IPlanRepository
{
    Task<MealPlan?> GetActiveAsync(CancellationToken cancellationToken);
    Task<MealPlan?> GetByIdAsync(long id, CancellationToken cancellationToken);
    Task<IReadOnlyList<MealPlan>> GetHistoryAsync(CancellationToken cancellationToken);
    Task ResetActiveAsync(CancellationToken cancellationToken);
    Task<MealPlan?> RestoreAsync(long id, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(long id, CancellationToken cancellationToken);
    Task SaveAsync(MealPlan plan, CancellationToken cancellationToken);
}
