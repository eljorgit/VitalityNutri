using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

internal sealed class UploadedPlanRepository(VitalityNutriDbContext dbContext) : IUploadedPlanRepository
{
    public async Task<DuplicatePlanRecord?> FindByHashAsync(string hash, CancellationToken cancellationToken)
    {
        var entity = await dbContext.MealPlans.AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(x => x.FileHash == hash, cancellationToken);

        return entity is null ? null : new DuplicatePlanRecord(entity.Id, entity.FileName ?? string.Empty, entity.IsActive);
    }

    public async Task<ActiveStoredPlan?> GetActiveAsync(CancellationToken cancellationToken)
    {
        var active = await dbContext.MealPlans.AsNoTracking()
            .OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(x => x.IsActive, cancellationToken);

        if (active is null || string.IsNullOrWhiteSpace(active.SavedFileName))
        {
            return null;
        }

        return new ActiveStoredPlan(active.Id, active.FileName ?? string.Empty, active.SavedFileName!, active.FileHash);
    }

    public async Task<SavedPlanEnvelope> SaveUploadedPlanAsync(
        string originalFileName,
        string savedFileName,
        string fileHash,
        string planJson,
        DateTimeOffset processedAtUtc,
        CancellationToken cancellationToken)
    {
        var entities = await dbContext.MealPlans.ToArrayAsync(cancellationToken);
        foreach (var plan in entities)
        {
            plan.Deactivate();
        }

        var metadata = new Dictionary<string, object?>
        {
            ["fileName"] = originalFileName,
            ["savedFileName"] = savedFileName,
            ["processedAt"] = processedAtUtc
        };

        var entity = new MealPlan(planJson, JsonSerializer.Serialize(metadata), originalFileName, savedFileName);
        var entry = dbContext.Entry(entity);
        entry.Property(x => x.FileHash).CurrentValue = fileHash;
        dbContext.MealPlans.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        metadata["id"] = entity.Id;
        var metadataJson = JsonSerializer.Serialize(metadata);
        entry.Property(x => x.MetadataJson).CurrentValue = metadataJson;
        await dbContext.SaveChangesAsync(cancellationToken);

        return new SavedPlanEnvelope(entity.PlanJson, metadataJson);
    }

    public async Task<SavedPlanEnvelope> ReprocessActivePlanAsync(string planJson, string fileHash, DateTimeOffset processedAtUtc, CancellationToken cancellationToken)
    {
        var active = await dbContext.MealPlans.OrderByDescending(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(x => x.IsActive, cancellationToken)
            ?? throw new InvalidOperationException("No active plan.");

        var metadata = JsonSerializer.Deserialize<Dictionary<string, object?>>(active.MetadataJson) ?? new Dictionary<string, object?>();
        metadata["id"] = active.Id;
        metadata["fileName"] = active.FileName;
        metadata["savedFileName"] = active.SavedFileName;
        metadata["processedAt"] = processedAtUtc;
        var metadataJson = JsonSerializer.Serialize(metadata);

        var entry = dbContext.Entry(active);
        entry.Property(x => x.PlanJson).CurrentValue = planJson;
        entry.Property(x => x.MetadataJson).CurrentValue = metadataJson;
        entry.Property(x => x.FileHash).CurrentValue = fileHash;
        entry.Property(x => x.UpdatedAtUtc).CurrentValue = processedAtUtc;

        await dbContext.SaveChangesAsync(cancellationToken);

        return new SavedPlanEnvelope(planJson, metadataJson);
    }
}