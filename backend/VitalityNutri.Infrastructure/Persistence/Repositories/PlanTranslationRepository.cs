using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

internal sealed class PlanTranslationRepository(VitalityNutriDbContext dbContext) : IPlanTranslationRepository
{
    public async Task<MealPlanTranslation?> GetAsync(long planId, string targetLanguage, CancellationToken cancellationToken)
    {
        var normalizedLang = targetLanguage.Trim().ToLowerInvariant();
        return await dbContext.MealPlanTranslations
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlanId == planId && x.TargetLanguage == normalizedLang, cancellationToken);
    }

    public async Task SaveAsync(MealPlanTranslation translation, CancellationToken cancellationToken)
    {
        var existing = await dbContext.MealPlanTranslations
            .FirstOrDefaultAsync(x => x.PlanId == translation.PlanId && x.TargetLanguage == translation.TargetLanguage, cancellationToken);

        if (existing is not null)
        {
            existing.Update(translation.PlanJson, translation.IsAiTranslated);
        }
        else
        {
            await dbContext.MealPlanTranslations.AddAsync(translation, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task InvalidateAsync(long planId, CancellationToken cancellationToken)
    {
        var translations = await dbContext.MealPlanTranslations
            .Where(x => x.PlanId == planId)
            .ToListAsync(cancellationToken);

        if (translations.Count > 0)
        {
            dbContext.MealPlanTranslations.RemoveRange(translations);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
