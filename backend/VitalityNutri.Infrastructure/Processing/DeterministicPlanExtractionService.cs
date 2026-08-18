using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Google.GenAI;
using Google.GenAI.Types;
using Microsoft.Extensions.Logging;
using UglyToad.PdfPig;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class DeterministicPlanExtractionService(
    ApiConfiguration apiConfiguration,
    IHttpClientFactory httpClientFactory,
    ILogger<DeterministicPlanExtractionService> logger)
    : IPlanExtractionService
{
    private static readonly string[] Days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    private static readonly string[] Meals = ["breakfast", "lunch", "snack", "dinner"];

    private readonly string[] textChain = ParseChain(
        apiConfiguration.Ai.FallbackChains.Text,
        ["groq-llama-3.3", "groq-qwen-3.6", "groq-llama-8b", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]);

    private readonly string[] visionChain = ParseChain(
        apiConfiguration.Ai.FallbackChains.Vision,
        ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"]);

    private readonly int selectableThreshold = Math.Max(100,
        apiConfiguration.Ai.Pdf.SelectableTextThreshold);

    private readonly bool useOmniRoute = apiConfiguration.Ai.UseOmniRoute;

    private readonly int geminiTimeoutSeconds = Math.Clamp(
        apiConfiguration.Ai.Providers.Gemini.TimeoutSeconds,
        100,
        3600);

    private readonly string omniRouteUrl =
        apiConfiguration.Ai.OmniRoute.Url;

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
            return NormalizePlanJson(aiPlanJson);
        }

        logger.LogWarning("[PlanExtraction] All AI fallbacks failed. Returning deterministic empty-week plan.");
        return CreateEmptyWeekPlanJson();
    }

    private async Task<string?> TryTextThenVisionAsync(string text, string filePath, string language, CancellationToken cancellationToken)
    {
        var textResult = await TryFallbackChainAsync(textChain, model => ExtractWithModelFromTextAsync(model, text, language, cancellationToken), cancellationToken);
        if (!string.IsNullOrWhiteSpace(textResult))
        {
            return textResult;
        }

        if (useOmniRoute)
        {
            // OmniRoute currently uses text prompts in this extractor path.
            return null;
        }

        return await TryFallbackChainAsync(visionChain, model => ExtractWithModelFromPdfAsync(model, filePath, language, cancellationToken), cancellationToken);
    }

    private async Task<string?> TryVisionThenTextAsync(string filePath, string text, string language, CancellationToken cancellationToken)
    {
        if (useOmniRoute)
        {
            if (text.Length == 0)
            {
                return null;
            }

            return await TryFallbackChainAsync(textChain, model => ExtractWithModelFromTextAsync(model, text, language, cancellationToken), cancellationToken);
        }

        var visionResult = await TryFallbackChainAsync(visionChain, model => ExtractWithModelFromPdfAsync(model, filePath, language, cancellationToken), cancellationToken);
        if (!string.IsNullOrWhiteSpace(visionResult))
        {
            return visionResult;
        }

        if (text.Length == 0)
        {
            return null;
        }

        return await TryFallbackChainAsync(textChain, model => ExtractWithModelFromTextAsync(model, text, language, cancellationToken), cancellationToken);
    }

    private async Task<string?> TryFallbackChainAsync(IEnumerable<string> chain, Func<string, Task<string?>> call, CancellationToken cancellationToken)
    {
        foreach (var model in chain.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var response = await call(model);
                if (string.IsNullOrWhiteSpace(response))
                {
                    continue;
                }

                _ = JsonNode.Parse(response);
                logger.LogInformation("[PlanExtraction] Model succeeded: {Model}", model);
                return response;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (TaskCanceledException ex) when (model.StartsWith("gemini", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning("[PlanExtraction] Gemini model timed out after {TimeoutSeconds} seconds: {Model}", geminiTimeoutSeconds, model);
                logger.LogDebug(ex, "[PlanExtraction] Gemini timeout details for model: {Model}", model);
            }
            catch (Exception ex)
            {
                if (ex is ClientError clientError
                    && clientError.Message.Contains("no longer available", StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogWarning("[PlanExtraction] Gemini model unavailable for current account: {Model}. Update ApiConfiguration:Ai:FallbackChains to active models.", model);
                }

                logger.LogWarning(ex, "[PlanExtraction] Model failed: {Model}", model);
            }
        }

        return null;
    }

    private async Task<string?> ExtractWithModelFromTextAsync(string model, string text, string language, CancellationToken cancellationToken)
    {
        var promptTemplate = LoadPlanPromptTemplate(language);

        if (useOmniRoute)
        {
            return await CallOmniRouteAsync(model, promptTemplate, text, cancellationToken);
        }

        if (model.StartsWith("groq", StringComparison.OrdinalIgnoreCase))
        {
            return await CallGroqAsync(model, promptTemplate, text, cancellationToken);
        }

        if (model.StartsWith("gemini", StringComparison.OrdinalIgnoreCase))
        {
            return await CallGeminiTextAsync(model, promptTemplate, text, cancellationToken);
        }

        throw new InvalidOperationException($"Unsupported text fallback model alias: {model}");
    }

    private async Task<string?> ExtractWithModelFromPdfAsync(string model, string filePath, string language, CancellationToken cancellationToken)
    {
        if (!model.StartsWith("gemini", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Unsupported vision fallback model alias: {model}");
        }

        return await CallGeminiPdfAsync(model, filePath, LoadPlanPromptTemplate(language), cancellationToken);
    }

    private async Task<string?> CallGroqAsync(string modelAlias, string promptTemplate, string sourceText, CancellationToken cancellationToken)
    {
        var apiKey = ReadApiKey("Groq");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Missing Groq API key for fallback chain.");
        }

        var model = ResolveGroqModel(modelAlias);
        var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var payload = new
        {
            model,
            temperature = 0.2,
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new { role = "system", content = promptTemplate },
                new { role = "user", content = sourceText }
            }
        };

        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return document.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
    }

    private async Task<string?> CallOmniRouteAsync(string modelAlias, string promptTemplate, string sourceText, CancellationToken cancellationToken)
    {
        var apiKey = ReadOmniRouteApiKey();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Missing OmniRoute API key while ApiConfiguration:Ai:UseOmniRoute is enabled.");
        }

        var model = ResolveModelForOmniRoute(modelAlias);
        var endpoint = omniRouteUrl.TrimEnd('/') + "/chat/completions";

        var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var payload = new
        {
            model,
            temperature = 0.2,
            response_format = new { type = "json_object" },
            messages = new object[]
            {
                new { role = "system", content = promptTemplate },
                new { role = "user", content = sourceText }
            }
        };

        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return document.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();
    }

    private async Task<string?> CallGeminiTextAsync(string modelAlias, string promptTemplate, string sourceText, CancellationToken cancellationToken)
    {
        var apiKey = ReadApiKey("Gemini");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Missing Gemini API key for fallback chain.");
        }

        var model = ResolveGeminiModel(modelAlias);
        var client = CreateGeminiClient(apiKey);
        var contents = new Content
        {
            Role = "user",
            Parts = new List<Part>
            {
                Part.FromText(promptTemplate),
                Part.FromText(sourceText)
            }
        };

        var response = await client.Models.GenerateContentAsync(
            model: model,
            contents: contents,
            config: new GenerateContentConfig
            {
                Temperature = 0.2f,
                ResponseMimeType = "application/json"
            },
            cancellationToken: cancellationToken);

        return ExtractGeminiText(response);
    }

    private async Task<string?> CallGeminiPdfAsync(string modelAlias, string filePath, string prompt, CancellationToken cancellationToken)
    {
        var apiKey = ReadApiKey("Gemini");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Missing Gemini API key for fallback chain.");
        }

        var model = ResolveGeminiModel(modelAlias);
        var client = CreateGeminiClient(apiKey);
        var bytes = await System.IO.File.ReadAllBytesAsync(filePath, cancellationToken);
        var contents = new Content
        {
            Role = "user",
            Parts = new List<Part>
            {
                Part.FromBytes(bytes, "application/pdf"),
                Part.FromText(prompt)
            }
        };

        var response = await client.Models.GenerateContentAsync(
            model: model,
            contents: contents,
            config: new GenerateContentConfig
            {
                Temperature = 0.2f,
                ResponseMimeType = "application/json"
            },
            cancellationToken: cancellationToken);

        return ExtractGeminiText(response);
    }

    private Client CreateGeminiClient(string apiKey) => new(
        apiKey: apiKey,
        httpOptions: new HttpOptions
        {
            Timeout = geminiTimeoutSeconds * 1000
        });

    private static string? ExtractGeminiText(GenerateContentResponse response)
    {
        if (response.Candidates is null || response.Candidates.Count == 0)
        {
            return null;
        }

        var parts = response.Candidates[0].Content?.Parts;
        if (parts is null || parts.Count == 0)
        {
            return null;
        }

        return string.Concat(parts.Select(part => part.Text ?? string.Empty));
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

    private string ReadApiKey(string provider)
    {
        return provider.Equals("Groq", StringComparison.OrdinalIgnoreCase)
            ? apiConfiguration.Ai.Providers.Groq.ApiKey ?? string.Empty
            : apiConfiguration.Ai.Providers.Gemini.ApiKey ?? string.Empty;
    }

    private string ReadOmniRouteApiKey()
    {
        return apiConfiguration.Ai.OmniRoute.ApiKey ?? string.Empty;
    }

    private static string ResolveGroqModel(string alias) => alias.ToLowerInvariant() switch
    {
        "groq-llama-3.3" => "llama-3.3-70b-versatile",
        "groq-qwen-3.6" => "qwen/qwen3-32b",
        "groq-llama-8b" => "llama-3.1-8b-instant",
        _ when alias.StartsWith("groq:", StringComparison.OrdinalIgnoreCase) => alias[(alias.IndexOf(':') + 1)..],
        _ => throw new InvalidOperationException($"Unknown Groq model alias: {alias}")
    };

    private static string ResolveGeminiModel(string alias) => alias.ToLowerInvariant() switch
    {
        "gemini-3.1-pro" => "gemini-3.1-pro",
        "gemini-3.1-flash" => "gemini-3.1-flash",
        "gemini-3.1-flash-lite" => "gemini-3.1-flash-lite",
        "gemini-2.5-pro" => "gemini-2.5-pro",
        "gemini-2.5-flash-lite" => "gemini-2.5-flash-lite",
        "gemini-2.5-flash" => "gemini-2.5-flash",
        "gemini-2.5-flash-image" => "gemini-2.5-flash-image",
        "gemini-2.0-flash" => "gemini-2.0-flash",
        "gemini-2.0-flash-lite" => "gemini-2.0-flash-lite",
        "gemini-2.0-flash-image" => "gemini-2.0-flash-image",
        _ when alias.StartsWith("gemini:", StringComparison.OrdinalIgnoreCase) => alias[(alias.IndexOf(':') + 1)..],
        _ => alias
    };

    private static string ResolveModelForOmniRoute(string alias)
    {
        if (alias.StartsWith("groq", StringComparison.OrdinalIgnoreCase))
        {
            return ResolveGroqModel(alias);
        }

        if (alias.StartsWith("gemini", StringComparison.OrdinalIgnoreCase))
        {
            return ResolveGeminiModel(alias);
        }

        return alias.Contains(':', StringComparison.Ordinal)
            ? alias[(alias.IndexOf(':') + 1)..]
            : alias;
    }

    private static string[] ParseChain(string? configuredValue, string[] defaults)
    {
        var raw = string.IsNullOrWhiteSpace(configuredValue) ? string.Join(',', defaults) : configuredValue;
        return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
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
}