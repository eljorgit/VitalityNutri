using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IBatchCookingRepository
{
    Task<BatchCookingState?> GetByPlanIdAsync(long planId, CancellationToken cancellationToken);
    Task SaveAsync(BatchCookingState state, CancellationToken cancellationToken);
    Task ResetAsync(long planId, CancellationToken cancellationToken);
}