using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IPlanTranslationRepository
{
    Task<MealPlanTranslation?> GetAsync(long planId, string targetLanguage, CancellationToken cancellationToken);
    Task SaveAsync(MealPlanTranslation translation, CancellationToken cancellationToken);
    Task InvalidateAsync(long planId, CancellationToken cancellationToken);
}
