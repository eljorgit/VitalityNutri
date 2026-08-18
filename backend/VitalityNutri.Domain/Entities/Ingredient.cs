namespace VitalityNutri.Domain.Entities;

public sealed class Ingredient
{
    public long Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Category { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }

    private Ingredient() { }

    public Ingredient(string name, string category)
    {
        Name = name;
        Category = category;
        CreatedAtUtc = DateTimeOffset.UtcNow;
        UpdatedAtUtc = CreatedAtUtc;
    }
}