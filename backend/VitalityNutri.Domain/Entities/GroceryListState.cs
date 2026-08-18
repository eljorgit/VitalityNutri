namespace VitalityNutri.Domain.Entities;

public sealed class GroceryListState
{
    public int Id { get; private set; } = 1;
    public string CheckedItemsJson { get; private set; } = "{}";
    public string ListType { get; private set; } = "semanal";
    public string SelectedSingleDay { get; private set; } = string.Empty;
    public string SelectedThreeDaysStart { get; private set; } = string.Empty;
    public string ExcludedMealsJson { get; private set; } = "[]";
    public string MultipliersJson { get; private set; } = "{}";
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private GroceryListState() { }

    public GroceryListState(string checkedItemsJson, string listType, string selectedSingleDay,
        string selectedThreeDaysStart, string excludedMealsJson, string multipliersJson)
    {
        CheckedItemsJson = checkedItemsJson;
        ListType = listType;
        SelectedSingleDay = selectedSingleDay;
        SelectedThreeDaysStart = selectedThreeDaysStart;
        ExcludedMealsJson = excludedMealsJson;
        MultipliersJson = multipliersJson;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Update(string checkedItemsJson, string listType, string selectedSingleDay,
        string selectedThreeDaysStart, string excludedMealsJson, string multipliersJson)
    {
        CheckedItemsJson = checkedItemsJson;
        ListType = listType;
        SelectedSingleDay = selectedSingleDay;
        SelectedThreeDaysStart = selectedThreeDaysStart;
        ExcludedMealsJson = excludedMealsJson;
        MultipliersJson = multipliersJson;
        UpdatedAtUtc = DateTimeOffset.UtcNow;
    }
}