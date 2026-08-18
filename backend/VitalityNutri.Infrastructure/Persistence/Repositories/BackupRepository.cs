using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Backups;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

internal sealed class BackupRepository(VitalityNutriDbContext dbContext) : IBackupRepository
{
    public async Task<BackupExportResult> ExportAsync(CancellationToken cancellationToken)
    {
        var plans = (await dbContext.MealPlans.AsNoTracking().ToArrayAsync(cancellationToken))
            .GroupJoin(
                await dbContext.BatchCookingStates.AsNoTracking().ToArrayAsync(cancellationToken),
                plan => plan.Id,
                batchState => batchState.PlanId,
                (plan, batchStateGroup) => new { Plan = plan, Batch = batchStateGroup.FirstOrDefault() })
            .Select(plan => new PlanBackupRow(
                plan.Plan.Id,
                plan.Plan.FileName,
                plan.Plan.SavedFileName,
                plan.Plan.PlanJson,
                plan.Plan.MetadataJson,
                plan.Plan.IsActive,
                plan.Plan.CreatedAtUtc,
                plan.Plan.UpdatedAtUtc,
                plan.Plan.FileHash,
                plan.Batch?.GuideJson,
                plan.Batch?.ParamsJson))
            .ToArray();

        var grocery = (await dbContext.GroceryListStates.AsNoTracking().ToArrayAsync(cancellationToken))
            .Select(state => new GroceryListBackupRow(
                state.Id,
                state.CheckedItemsJson,
                state.ListType,
                state.SelectedSingleDay,
                state.SelectedThreeDaysStart,
                state.ExcludedMealsJson,
                state.MultipliersJson,
                state.UpdatedAtUtc))
            .ToArray();

        var completed = (await dbContext.CompletedRecipesStates.AsNoTracking().ToArrayAsync(cancellationToken))
            .Select(state => new CompletedRecipesBackupRow(state.PlanId, state.CompletedJson, state.UpdatedAtUtc))
            .ToArray();

        var history = (await dbContext.SearchHistoryItems.AsNoTracking().ToArrayAsync(cancellationToken))
            .Select(item => new SearchHistoryBackupRow(
                item.Id,
                item.PlanId,
                item.PlanName,
                item.Day,
                item.Meal,
                item.RecipeName,
                item.Image,
                item.IsActive,
                item.ClickedAtUtc))
            .ToArray();

        return new BackupExportResult(1, DateTimeOffset.UtcNow, plans, grocery, completed, history);
    }

    public async Task ImportAsync(JsonElement payload, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        dbContext.SearchHistoryItems.RemoveRange(await dbContext.SearchHistoryItems.ToArrayAsync(cancellationToken));
        dbContext.BatchCookingStates.RemoveRange(await dbContext.BatchCookingStates.ToArrayAsync(cancellationToken));
        dbContext.CompletedRecipesStates.RemoveRange(await dbContext.CompletedRecipesStates.ToArrayAsync(cancellationToken));
        dbContext.GroceryListStates.RemoveRange(await dbContext.GroceryListStates.ToArrayAsync(cancellationToken));
        dbContext.MealPlans.RemoveRange(await dbContext.MealPlans.ToArrayAsync(cancellationToken));
        await dbContext.SaveChangesAsync(cancellationToken);

        if (payload.TryGetProperty("plans", out var plans) && plans.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in plans.EnumerateArray())
            {
                var plan = new MealPlan(
                    ReadString(row, "plan_json", "{}"),
                    ReadString(row, "metadata_json", "{}"),
                    ReadNullableString(row, "file_name"),
                    ReadNullableString(row, "saved_file_name"));

                var entry = dbContext.Entry(plan);
                entry.Property(x => x.Id).CurrentValue = ReadLong(row, "id", 0);
                entry.Property(x => x.IsActive).CurrentValue = ReadBoolean(row, "is_active");
                entry.Property(x => x.FileHash).CurrentValue = ReadNullableString(row, "file_hash");
                var createdAt = ReadDateTimeOffset(row, "created_at", DateTimeOffset.UtcNow);
                entry.Property(x => x.CreatedAtUtc).CurrentValue = createdAt;
                entry.Property(x => x.UpdatedAtUtc).CurrentValue = ReadDateTimeOffset(row, "updated_at", createdAt);

                dbContext.MealPlans.Add(plan);

                var batchGuide = ReadNullableString(row, "batch_cooking_json");
                var batchParams = ReadNullableString(row, "batch_cooking_params");
                if (!string.IsNullOrWhiteSpace(batchGuide) && !string.IsNullOrWhiteSpace(batchParams))
                {
                    dbContext.BatchCookingStates.Add(new BatchCookingState(
                        ReadLong(row, "id", 0),
                        batchGuide,
                        batchParams));
                }
            }
        }

        if (payload.TryGetProperty("groceryListState", out var groceryState) && groceryState.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in groceryState.EnumerateArray())
            {
                var state = new GroceryListState(
                    ReadString(row, "checked_items_json", "{}"),
                    ReadString(row, "list_type", "semanal"),
                    ReadString(row, "selected_single_day", string.Empty),
                    ReadString(row, "selected_3days_start", string.Empty),
                    ReadString(row, "excluded_meals_json", "[]"),
                    ReadString(row, "multipliers_json", "{}"));

                var entry = dbContext.Entry(state);
                entry.Property(x => x.Id).CurrentValue = ReadInt(row, "id", 1);
                entry.Property(x => x.UpdatedAtUtc).CurrentValue = ReadDateTimeOffset(row, "updated_at", DateTimeOffset.UtcNow);

                dbContext.GroceryListStates.Add(state);
            }
        }

        if (payload.TryGetProperty("completedRecipesState", out var completedState) && completedState.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in completedState.EnumerateArray())
            {
                var state = new CompletedRecipesState(
                    ReadLong(row, "plan_id", 0),
                    ReadString(row, "completed_json", "{}"));

                var entry = dbContext.Entry(state);
                entry.Property(x => x.UpdatedAtUtc).CurrentValue = ReadDateTimeOffset(row, "updated_at", DateTimeOffset.UtcNow);

                dbContext.CompletedRecipesStates.Add(state);
            }
        }

        if (payload.TryGetProperty("searchHistory", out var searchHistory) && searchHistory.ValueKind == JsonValueKind.Array)
        {
            foreach (var row in searchHistory.EnumerateArray())
            {
                var state = new SearchHistoryItem(
                    ReadLong(row, "plan_id", 0),
                    ReadString(row, "plan_name", string.Empty),
                    ReadString(row, "day", string.Empty),
                    ReadString(row, "meal", string.Empty),
                    ReadString(row, "recipe_name", string.Empty),
                    ReadString(row, "image", string.Empty),
                    ReadBoolean(row, "is_active"));

                var entry = dbContext.Entry(state);
                entry.Property(x => x.Id).CurrentValue = ReadLong(row, "id", 0);
                entry.Property(x => x.ClickedAtUtc).CurrentValue = ReadDateTimeOffset(row, "clicked_at", DateTimeOffset.UtcNow);

                dbContext.SearchHistoryItems.Add(state);
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static string ReadString(JsonElement row, string name, string fallback)
    {
        if (!row.TryGetProperty(name, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return fallback;
        }

        return value.ValueKind == JsonValueKind.String ? value.GetString() ?? fallback : value.GetRawText();
    }

    private static string? ReadNullableString(JsonElement row, string name)
    {
        if (!row.TryGetProperty(name, out var value) || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            return null;
        }

        return value.ValueKind == JsonValueKind.String ? value.GetString() : value.GetRawText();
    }

    private static long ReadLong(JsonElement row, string name, long fallback)
    {
        if (!row.TryGetProperty(name, out var value))
        {
            return fallback;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var numericValue))
        {
            return numericValue;
        }

        if (value.ValueKind == JsonValueKind.String && long.TryParse(value.GetString(), out var stringValue))
        {
            return stringValue;
        }

        return fallback;
    }

    private static int ReadInt(JsonElement row, string name, int fallback)
    {
        if (!row.TryGetProperty(name, out var value))
        {
            return fallback;
        }

        if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var numericValue))
        {
            return numericValue;
        }

        if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var stringValue))
        {
            return stringValue;
        }

        return fallback;
    }

    private static bool ReadBoolean(JsonElement row, string name)
    {
        if (!row.TryGetProperty(name, out var value))
        {
            return false;
        }

        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => value.TryGetInt32(out var numeric) && numeric != 0,
            JsonValueKind.String => bool.TryParse(value.GetString(), out var parsed)
                ? parsed
                : int.TryParse(value.GetString(), out var numericString) && numericString != 0,
            _ => false,
        };
    }

    private static DateTimeOffset ReadDateTimeOffset(JsonElement row, string name, DateTimeOffset fallback)
    {
        if (!row.TryGetProperty(name, out var value))
        {
            return fallback;
        }

        if (value.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(value.GetString(), out var parsed))
        {
            return parsed;
        }

        return fallback;
    }
}