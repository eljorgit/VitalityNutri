using System.Text.Json;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing.Ai;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class DeterministicRecipeAiProcessingService(
    ApiConfiguration apiConfiguration,
    IUnifiedAiGateway aiGateway,
    IAiPayloadCompressionService payloadCompression,
    ILogger<DeterministicRecipeAiProcessingService> logger)
    : IRecipeAiProcessingService
{
    public async Task<IReadOnlyList<RecipeAiOption>> ProcessAsync(RecipeAiInput input, CancellationToken cancellationToken)
    {
        var count = Math.Clamp(input.OptionsCount, 1, 5);

        // Try AI generation across configured fallback chain
        try
        {
            var prompt = LoadRecipePromptTemplate(input.Language, count, input.ExtraPrompt);
            string? aiJson = null;

            if (!string.IsNullOrWhiteSpace(input.FileData))
            {
                var mime = input.SourceType.Equals("pdf", StringComparison.OrdinalIgnoreCase) ? "application/pdf" : "image/jpeg";
                var raw = input.FileData.Contains(',') ? input.FileData[(input.FileData.IndexOf(',') + 1)..] : input.FileData;
                var bytes = Convert.FromBase64String(raw);
                bytes = mime == "application/pdf"
                    ? payloadCompression.CompressPdfForAi(bytes)
                    : payloadCompression.CompressImageForAi(bytes);

                aiJson = await aiGateway.GenerateMultimodalAsync(
                    chainConfig: apiConfiguration.Ai.FallbackChains.RecipeVision,
                    prompt: prompt,
                    fileBytes: bytes,
                    mimeType: mime,
                    temperature: 0.4f,
                    cancellationToken: cancellationToken);
            }
            else
            {
                var fullPrompt = !string.IsNullOrWhiteSpace(input.TextData)
                    ? $"{prompt}\n\nRecipe Source Content:\n{input.TextData}"
                    : prompt;

                aiJson = await aiGateway.GenerateTextAsync(
                    chainConfig: apiConfiguration.Ai.FallbackChains.RecipeAi,
                    prompt: fullPrompt,
                    systemPrompt: null,
                    jsonMode: true,
                    temperature: 0.4f,
                    cancellationToken: cancellationToken);
            }

            if (!string.IsNullOrWhiteSpace(aiJson))
            {
                var parsedOptions = ParseAiResponse(aiJson);
                if (parsedOptions.Count > 0)
                {
                    logger.LogInformation("[RecipeAI] Successfully generated {Count} recipe options via AI.", parsedOptions.Count);
                    return parsedOptions;
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[RecipeAI] Live AI recipe generation failed. Falling back to deterministic generator.");
        }

        return GenerateDeterministicFallback(input, count);
    }

    private static IReadOnlyList<RecipeAiOption> ParseAiResponse(string json)
    {
        var cleanJson = UnifiedAiGateway.CleanMarkdownCodeBlock(json);

        using var doc = JsonDocument.Parse(cleanJson);
        if (!doc.RootElement.TryGetProperty("options", out var optionsArray) || optionsArray.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var results = new List<RecipeAiOption>();
        foreach (var opt in optionsArray.EnumerateArray())
        {
            var name = opt.TryGetProperty("recipeName", out var n) ? n.GetString() ?? "Receta" : "Receta";
            var calories = opt.TryGetProperty("calories", out var c) && c.TryGetInt32(out var cal) ? cal : 400;
            var time = opt.TryGetProperty("time", out var t) ? t.GetString() ?? "25 min" : "25 min";
            var tag = opt.TryGetProperty("tag", out var tg) ? tg.GetString() ?? "meal" : "meal";
            var image = opt.TryGetProperty("image", out var im) ? im.GetString() ?? string.Empty : string.Empty;
            var tips = opt.TryGetProperty("tips", out var tp) ? tp.GetString() ?? string.Empty : string.Empty;
            var nutritionistTips = opt.TryGetProperty("nutritionistTips", out var nt) ? nt.GetString() : null;
            var servings = opt.TryGetProperty("servings", out var s) && s.TryGetInt32(out var srv) ? srv : 1;

            var ingredients = opt.TryGetProperty("ingredients", out var ing) ? ing.Clone() : JsonSerializer.Deserialize<JsonElement>("[]");
            var steps = opt.TryGetProperty("steps", out var stp) ? stp.Clone() : JsonSerializer.Deserialize<JsonElement>("[]");
            var nutrition = opt.TryGetProperty("nutrition", out var nut) && nut.ValueKind == JsonValueKind.Object ? (JsonElement?)nut.Clone() : null;

            results.Add(new RecipeAiOption(name, calories, time, tag, image, ingredients, steps, tips, nutritionistTips, nutrition, servings));
        }

        return results;
    }

    private static string LoadRecipePromptTemplate(string language, int count, string? extraPrompt)
    {
        var promptPath = Path.Combine(AppContext.BaseDirectory, "prompts", "recipe-ai", "prompt.md");

        var template = System.IO.File.Exists(promptPath)
            ? System.IO.File.ReadAllText(promptPath)
            : "You are an AI expert in nutrition. Generate {{kOptions}} variants of the recipe. {{extraPrompt}}";

        var interpolated = template
            .Replace("{{kOptions}}", count.ToString())
            .Replace("{{extraPrompt}}", extraPrompt ?? string.Empty);

        return interpolated + FormatLanguageDirective(language);
    }

    private static string FormatLanguageDirective(string language)
    {
        var (name, code) = string.Equals(language, "es", StringComparison.OrdinalIgnoreCase)
            ? ("Spanish (Español)", "es")
            : ("English", "en");

        return $"\n\n# LANGUAGE REQUIREMENT\nCRITICAL: You MUST output all recipe titles, ingredient names, steps, tags, and nutritionist tips strictly in {name} (ISO code: {code}).";
    }

    private static IReadOnlyList<RecipeAiOption> GenerateDeterministicFallback(RecipeAiInput input, int count)
    {
        var options = new List<RecipeAiOption>(count);
        var title = BuildBaseTitle(input.TextData);

        for (var index = 0; index < count; index++)
        {
            var suffix = count == 1 ? string.Empty : $" - Opcion {index + 1}";
            options.Add(new RecipeAiOption(
                $"{title}{suffix}".Trim(),
                420,
                "25 min",
                "meal",
                string.Empty,
                JsonSerializer.SerializeToElement(new[]
                {
                    new { name = "Ingrediente base", originalAmount = 1, unit = "unidad", category = "Otros" },
                    new { name = "Ingrediente secundario", originalAmount = 200, unit = "g", category = "Otros" }
                }),
                JsonSerializer.SerializeToElement(new[]
                {
                    "Paso 1: Preparar los ingredientes principales.",
                    "Paso 2: Cocinar hasta obtener la textura deseada.",
                    "Paso 3: Ajustar condimentos y servir."
                }),
                "Ajusta la sal y especias al gusto.",
                "Version estructurada para edicion manual.",
                null,
                1));
        }

        return options;
    }

    private static string BuildBaseTitle(string? textData)
    {
        if (string.IsNullOrWhiteSpace(textData)) return "Receta AI";
        var line = textData.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
        return string.IsNullOrWhiteSpace(line) ? "Receta AI" : line.Length > 64 ? line[..64].Trim() : line.Trim();
    }
}