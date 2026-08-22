using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging;
using UglyToad.PdfPig;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing.Ai;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class DeterministicPlanExtractionService(
    ApiConfiguration apiConfiguration,
    IUnifiedAiGateway aiGateway,
    IRecipeImageLookupService imageLookupService,
    ILogger<DeterministicPlanExtractionService> logger)
    : IPlanExtractionService
{
    private static readonly string[] Days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    private static readonly string[] Meals = ["breakfast", "lunch", "snack", "dinner"];

    private readonly int selectableThreshold = Math.Max(100, apiConfiguration.Ai.Pdf.SelectableTextThreshold);

    public async Task<string> ExtractPlanJsonAsync(string filePath, string language, CancellationToken cancellationToken)
    {
        var text = await ExtractPdfTextAsync(filePath, cancellationToken);
        var normalizedText = CollapseWhitespace(text);
        var isSelectable = normalizedText.Length >= selectableThreshold;

        logger.LogInformation("[PlanExtraction] Selectable PDF detection: Length={Length}, Threshold={Threshold}, IsSelectable={IsSelectable}",
            normalizedText.Length,
            selectableThreshold,
            isSelectable);

        var aiPlanJson = isSelectable
            ? await TryTextThenVisionAsync(normalizedText, filePath, language, cancellationToken)
            : await TryVisionThenTextAsync(filePath, normalizedText, language, cancellationToken);

        if (!string.IsNullOrWhiteSpace(aiPlanJson))
        {
            var normalized = NormalizePlanJson(aiPlanJson);
            return await EnrichPlanImagesAsync(normalized, cancellationToken);
        }

        logger.LogWarning("[PlanExtraction] All AI fallbacks failed. Returning deterministic empty-week plan.");
        return CreateEmptyWeekPlanJson();
    }

    private async Task<string?> TryTextThenVisionAsync(string text, string filePath, string language, CancellationToken cancellationToken)
    {
        var promptTemplate = LoadPlanPromptTemplate(language);
        var textChain = apiConfiguration.Ai.FallbackChains.PlanText;

        var textResult = await aiGateway.GenerateTextAsync(
            chainConfig: textChain,
            prompt: text,
            systemPrompt: promptTemplate,
            jsonMode: true,
            temperature: 0.2f,
            cancellationToken: cancellationToken);

        if (!string.IsNullOrWhiteSpace(textResult))
        {
            return textResult;
        }

        if (apiConfiguration.Ai.UseOmniRoute)
        {
            return null;
        }

        var visionChain = apiConfiguration.Ai.FallbackChains.PlanVision;
        var bytes = await System.IO.File.ReadAllBytesAsync(filePath, cancellationToken);

        return await aiGateway.GenerateMultimodalAsync(
            chainConfig: visionChain,
            prompt: promptTemplate,
            fileBytes: bytes,
            mimeType: "application/pdf",
            temperature: 0.2f,
            cancellationToken: cancellationToken);
    }

    private async Task<string?> TryVisionThenTextAsync(string filePath, string text, string language, CancellationToken cancellationToken)
    {
        var promptTemplate = LoadPlanPromptTemplate(language);

        if (apiConfiguration.Ai.UseOmniRoute)
        {
            if (text.Length == 0)
            {
                return null;
            }

            var textChain = apiConfiguration.Ai.FallbackChains.PlanText;
            return await aiGateway.GenerateTextAsync(
                chainConfig: textChain,
                prompt: text,
                systemPrompt: promptTemplate,
                jsonMode: true,
                temperature: 0.2f,
                cancellationToken: cancellationToken);
        }

        var visionChain = apiConfiguration.Ai.FallbackChains.PlanVision;
        var bytes = await System.IO.File.ReadAllBytesAsync(filePath, cancellationToken);

        var visionResult = await aiGateway.GenerateMultimodalAsync(
            chainConfig: visionChain,
            prompt: promptTemplate,
            fileBytes: bytes,
            mimeType: "application/pdf",
            temperature: 0.2f,
            cancellationToken: cancellationToken);

        if (!string.IsNullOrWhiteSpace(visionResult))
        {
            return visionResult;
        }

        if (text.Length == 0)
        {
            return null;
        }

        return await aiGateway.GenerateTextAsync(
            chainConfig: apiConfiguration.Ai.FallbackChains.PlanText,
            prompt: text,
            systemPrompt: promptTemplate,
            jsonMode: true,
            temperature: 0.2f,
            cancellationToken: cancellationToken);
    }

    private static async Task<string> ExtractPdfTextAsync(string filePath, CancellationToken cancellationToken)
    {
        return await Task.Run(() =>
        {
            var builder = new StringBuilder();
            using var document = PdfDocument.Open(filePath);
            foreach (var page in document.GetPages())
            {
                builder.AppendLine(page.Text);
            }

            return builder.ToString();
        }, cancellationToken);
    }

    private string LoadPlanPromptTemplate(string language)
    {
        var promptPath = Path.Combine(AppContext.BaseDirectory, "prompts", "plan-analysis", "prompt.md");
        if (!System.IO.File.Exists(promptPath))
        {
            throw new FileNotFoundException($"Plan analysis prompt file was not found: {promptPath}", promptPath);
        }

        try
        {
            var basePrompt = System.IO.File.ReadAllText(promptPath);
            return basePrompt + FormatLanguageDirective(language);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[PlanExtraction] Failed reading prompt file: {PromptFile}", promptPath);
            throw;
        }
    }

    private static string FormatLanguageDirective(string language)
    {
        var (name, code) = string.Equals(language, "es", StringComparison.OrdinalIgnoreCase)
            ? ("Spanish (Español)", "es")
            : ("English", "en");

        return $"\n\n# LANGUAGE REQUIREMENT\nCRITICAL: You MUST generate all text content (including recipe names, ingredients, preparation steps, tags, and tips) strictly in {name} (ISO code: {code}).";
    }

    private static string CollapseWhitespace(string text) =>
        string.Concat(text.Where(ch => !char.IsControl(ch))).Trim();

    private static string NormalizePlanJson(string rawJson)
    {
        var root = JsonNode.Parse(rawJson) as JsonObject ?? new JsonObject();
        var days = root["days"] as JsonObject ?? new JsonObject();

        foreach (var day in Days)
        {
            var dayObject = days[day] as JsonObject ?? new JsonObject();
            foreach (var meal in Meals)
            {
                if (dayObject[meal] is null)
                {
                    dayObject[meal] = null;
                }
            }

            days[day] = dayObject;
        }

        root["days"] = days;
        return root.ToJsonString();
    }

    private static string CreateEmptyWeekPlanJson()
    {
        var plan = new
        {
            days = new Dictionary<string, object>
            {
                ["monday"] = EmptyDay(),
                ["tuesday"] = EmptyDay(),
                ["wednesday"] = EmptyDay(),
                ["thursday"] = EmptyDay(),
                ["friday"] = EmptyDay(),
                ["saturday"] = EmptyDay(),
                ["sunday"] = EmptyDay(),
            }
        };

        return JsonSerializer.Serialize(plan);
    }

    private static object EmptyDay() => new
    {
        breakfast = (object?)null,
        lunch = (object?)null,
        snack = (object?)null,
        dinner = (object?)null,
    };

    private async Task<string> EnrichPlanImagesAsync(string planJson, CancellationToken cancellationToken)
    {
        try
        {
            var root = JsonNode.Parse(planJson) as JsonObject;
            if (root is null || root["days"] is not JsonObject days)
            {
                return planJson;
            }

            foreach (var day in Days)
            {
                if (days[day] is not JsonObject dayObject)
                {
                    continue;
                }

                foreach (var meal in Meals)
                {
                    if (dayObject[meal] is not JsonObject recipeObject)
                    {
                        continue;
                    }

                    var currentImage = recipeObject["image"]?.ToString();
                    if (string.IsNullOrWhiteSpace(currentImage))
                    {
                        var recipeName = recipeObject["recipeName"]?.ToString() ?? string.Empty;
                        var resolvedImage = await imageLookupService.ResolveContextualImageAsync(recipeName, meal, cancellationToken);
                        recipeObject["image"] = resolvedImage;
                    }
                }
            }

            return root.ToJsonString();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[PlanExtraction] Error enriching recipe images in plan JSON. Returning original JSON.");
            return planJson;
        }
    }
}