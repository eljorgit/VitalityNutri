using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Backups;

public sealed record BackupExportResult(
    int Version,
    DateTimeOffset ExportedAt,
    IReadOnlyList<PlanBackupRow> Plans,
    IReadOnlyList<GroceryListBackupRow> GroceryListState,
    IReadOnlyList<CompletedRecipesBackupRow> CompletedRecipesState,
    IReadOnlyList<SearchHistoryBackupRow> SearchHistory);

public sealed record PlanBackupRow(
    long Id,
    string? FileName,
    string? SavedFileName,
    string PlanJson,
    string MetadataJson,
    bool IsActive,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? FileHash,
    string? BatchCookingJson,
    string? BatchCookingParams);

public sealed record GroceryListBackupRow(
    int Id,
    string CheckedItemsJson,
    string ListType,
    string SelectedSingleDay,
    string Selected3DaysStart,
    string ExcludedMealsJson,
    string MultipliersJson,
    DateTimeOffset UpdatedAt);

public sealed record CompletedRecipesBackupRow(
    long PlanId,
    string CompletedJson,
    DateTimeOffset UpdatedAt);

public sealed record SearchHistoryBackupRow(
    long Id,
    long PlanId,
    string PlanName,
    string Day,
    string Meal,
    string RecipeName,
    string Image,
    bool IsActive,
    DateTimeOffset ClickedAt);

public sealed record ExportBackupQuery : IRequest<BackupExportResult>;

internal sealed class ExportBackupQueryHandler(IBackupRepository repository) : IRequestHandler<ExportBackupQuery, BackupExportResult>
{
    public Task<BackupExportResult> Handle(ExportBackupQuery request, CancellationToken cancellationToken) =>
        repository.ExportAsync(cancellationToken);
}