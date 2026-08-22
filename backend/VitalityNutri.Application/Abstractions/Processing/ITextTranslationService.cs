using System.Text.Json;

namespace VitalityNutri.Application.Abstractions.Processing;

public sealed record RecipeTranslationInput(
    string RecipeName,
    string Tips,
    string? NutritionistTips,
    JsonElement Ingredients,
    JsonElement Steps,
    string SourceLanguage,
    string TargetLanguage);

public sealed record RecipeTranslationResult(
    string RecipeName,
    string Tips,
    string? NutritionistTips,
    JsonElement Ingredients,
    JsonElement Steps,
    string TargetLanguage,
    bool IsAiTranslated);

public interface ITextTranslationService
{
    Task<RecipeTranslationResult> TranslateRecipeAsync(RecipeTranslationInput input, CancellationToken cancellationToken);
    Task<string> TranslateTextAsync(string text, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken);
    Task<string> TranslatePlanJsonAsync(string planJson, string sourceLanguage, string targetLanguage, CancellationToken cancellationToken);
}
