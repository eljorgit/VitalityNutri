using System.Globalization;
using System.Text;
using System.Text.Json;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Application.Recipes.ProcessAi;

internal static class RecipeAiOptionDeduplicator
{
    public static IReadOnlyList<RecipeAiOption> Deduplicate(IReadOnlyList<RecipeAiOption> options)
    {
        if (options.Count < 2)
        {
            return options;
        }

        var unique = new List<RecipeAiOption>(options.Count);
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var option in options)
        {
            var key = BuildKey(option);
            if (seen.Add(key))
            {
                unique.Add(option);
            }
        }

        return unique;
    }

    private static string BuildKey(RecipeAiOption option)
    {
        var builder = new StringBuilder();
        builder.Append(NormalizeText(option.RecipeName));
        builder.Append('|');

        foreach (var ingredient in ExtractIngredientNames(option.Ingredients))
        {
            builder.Append(ingredient);
            builder.Append(';');
        }

        builder.Append('|');
        foreach (var step in ExtractSteps(option.Steps))
        {
            builder.Append(step);
            builder.Append(';');
        }

        return builder.ToString();
    }

    private static IEnumerable<string> ExtractIngredientNames(JsonElement ingredients) =>
        RecipeIngredients.Extract(ingredients)
            .Select(x => NormalizeText(x.Name))
            .OrderBy(x => x, StringComparer.Ordinal);

    private static IEnumerable<string> ExtractSteps(JsonElement steps)
    {
        if (steps.ValueKind != JsonValueKind.Array)
        {
            yield break;
        }

        foreach (var step in steps.EnumerateArray())
        {
            var text = step.ValueKind == JsonValueKind.String ? step.GetString() ?? string.Empty : step.ToString();
            yield return NormalizeText(text);
        }
    }

    private static string NormalizeText(string value)
    {
        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(ch);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}