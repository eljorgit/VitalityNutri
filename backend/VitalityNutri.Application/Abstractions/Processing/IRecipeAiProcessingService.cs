using System.Text.Json;

namespace VitalityNutri.Application.Abstractions.Processing;

public interface IRecipeAiProcessingService
{
    Task<IReadOnlyList<RecipeAiOption>> ProcessAsync(RecipeAiInput input, CancellationToken cancellationToken);
}

public sealed record RecipeAiInput(
    string SourceType,
    string? FileData,
    string? TextData,
    int OptionsCount,
    string? ExtraPrompt,
    string Language);

public sealed record RecipeAiOption(
    string RecipeName,
    int Calories,
    string Time,
    string? Tag,
    string? Image,
    JsonElement Ingredients,
    JsonElement Steps,
    string Tips,
    string? NutritionistTips,
    JsonElement? Nutrition,
    int Servings);