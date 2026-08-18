using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Tests.Domain;

public sealed class RecipeTests
{
    [Fact]
    public void Constructor_NormalizesLegacyDefaults()
    {
        var recipe = Create(time: "", servings: 0, source: "", season: "");

        Assert.Equal("20 min", recipe.Time);
        Assert.Equal(1, recipe.Servings);
        Assert.Equal("manual", recipe.Source);
        Assert.Equal("Todas", recipe.Season);
    }

    [Fact]
    public void ToggleFavorite_UpdatesState()
    {
        var recipe = Create();

        Assert.True(recipe.ToggleFavorite());
        Assert.True(recipe.IsFavorite);
        Assert.False(recipe.ToggleFavorite());
    }

    private static Recipe Create(string time = "20 min", int servings = 1, string source = "manual", string season = "Todas") =>
        new("Soup", 250, time, null, null, "[]", "", "[]", null, null,
            servings, source, null, false, false, season);
}