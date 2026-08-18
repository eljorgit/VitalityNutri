using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class PromptTemplateTests
{
    private static readonly string PromptsDirectory = Path.Combine(AppContext.BaseDirectory, "prompts");

    [Theory]
    [InlineData("plan-analysis", "prompt.md")]
    [InlineData("recipe-ai", "prompt.md")]
    [InlineData("batch-cooking", "prompt.md")]
    public void CanonicalPrompt_ExistsAndIsNonEmpty(string folder, string fileName)
    {
        var filePath = Path.Combine(PromptsDirectory, folder, fileName);

        Assert.True(File.Exists(filePath), $"Prompt file must exist at path: {filePath}");

        var content = File.ReadAllText(filePath);
        Assert.False(string.IsNullOrWhiteSpace(content), $"Prompt file must not be empty: {filePath}");
        Assert.True(content.Length > 100, $"Prompt file must contain substantial instructions: {filePath}");
    }

    [Theory]
    [InlineData("plan-analysis", "prompt-en.md")]
    [InlineData("plan-analysis", "prompt-es.md")]
    [InlineData("recipe-ai", "prompt-en.md")]
    [InlineData("recipe-ai", "prompt-es.md")]
    [InlineData("batch-cooking", "prompt-en.md")]
    [InlineData("batch-cooking", "prompt-es.md")]
    public void LegacyLocalizedPrompts_DoNotExist(string folder, string fileName)
    {
        var filePath = Path.Combine(PromptsDirectory, folder, fileName);
        Assert.False(File.Exists(filePath), $"Legacy localized prompt file should no longer exist: {filePath}");
    }

    [Fact]
    public void PlanAnalysisPrompt_ContainsStrictSchemaAndRules()
    {
        var filePath = Path.Combine(PromptsDirectory, "plan-analysis", "prompt.md");
        var content = File.ReadAllText(filePath);

        Assert.Contains("MealPlan", content);
        Assert.Contains("CategorizedIngredients", content);
        Assert.Contains("CategorizedSteps", content);
        Assert.Contains("Ingredient", content);
        Assert.Contains("RecipeNutrition", content);
        Assert.Contains("ExtraNutrient", content);
        Assert.Contains("INFORMACIÓN NUTRICIONAL", content);
        Assert.Contains("vegetables", content);
        Assert.Contains("meats, eggs and tofu", content);
        Assert.Contains("DELIVERY RESTRICTIONS", content);
    }

    [Fact]
    public void RecipeAiPrompt_ContainsRequiredPlaceholdersAndSchema()
    {
        var filePath = Path.Combine(PromptsDirectory, "recipe-ai", "prompt.md");
        var content = File.ReadAllText(filePath);

        Assert.Contains("{{kOptions}}", content);
        Assert.Contains("{{extraPrompt}}", content);
        Assert.Contains("\"options\"", content);
        Assert.Contains("\"recipeName\"", content);
        Assert.Contains("\"nutrition\"", content);
        Assert.Contains("CRITICAL RULE FOR STEPS", content);
    }

    [Fact]
    public void BatchCookingPrompt_ContainsRequiredSchema()
    {
        var filePath = Path.Combine(PromptsDirectory, "batch-cooking", "prompt.md");
        var content = File.ReadAllText(filePath);

        Assert.Contains("BatchCookingGuide", content);
        Assert.Contains("BatchCookingStep", content);
        Assert.Contains("StorageTip", content);
        Assert.Contains("recipesAffected", content);
        Assert.Contains("storageTips", content);
    }
}
