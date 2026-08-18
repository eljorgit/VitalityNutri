using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Google.GenAI;
using Google.GenAI.Types;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class DeterministicRecipeAiProcessingService(
    ApiConfiguration apiConfiguration,
    IHttpClientFactory httpClientFactory,
    ILogger<DeterministicRecipeAiProcessingService> logger)
    : IRecipeAiProcessingService
{
    public async Task<IReadOnlyList<RecipeAiOption>> ProcessAsync(RecipeAiInput input, CancellationToken cancellationToken)
    {
        var count = Math.Clamp(input.OptionsCount, 1, 5);

        // Try AI live generation if configured
        try
        {
            var prompt = LoadRecipePromptTemplate(input.Language, count, input.ExtraPrompt);
            var aiJson = await TryExtractFromAiAsync(input, prompt, cancellationToken);
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

    private async Task<string?> TryExtractFromAiAsync(RecipeAiInput input, string prompt, CancellationToken cancellationToken)
    {
        var isSaaS = apiConfiguration.App.Mode.Equals("SaaS", StringComparison.OrdinalIgnoreCase);

        if (isSaaS || apiConfiguration.Ai.UseOmniRoute)
        {
            if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.OmniRoute.Url))
            {
                return await CallOmniRouteAsync(prompt, input, cancellationToken);
            }
        }

        if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.Providers.Groq.ApiKey))
        {
            var groqResult = await CallGroqAsync(prompt, input, cancellationToken);
            if (!string.IsNullOrWhiteSpace(groqResult)) return groqResult;
        }

        if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.Providers.Gemini.ApiKey))
        {
            return await CallGeminiAsync(prompt, input, cancellationToken);
        }

        return null;
    }

    private async Task<string?> CallOmniRouteAsync(string prompt, RecipeAiInput input, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(Math.Clamp(apiConfiguration.Ai.Providers.Gemini.TimeoutSeconds, 30, 300));

        var requestBody = new
        {
            model = apiConfiguration.Ai.Models.RecipeAi,
            messages = new object[]
            {
                new { role = "system", content = prompt },
                new { role = "user", content = BuildUserContent(input) }
            },
            temperature = 0.4
        };

        var request = new HttpRequestMessage(HttpMethod.Post, apiConfiguration.Ai.OmniRoute.Url)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.OmniRoute.ApiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiConfiguration.Ai.OmniRoute.ApiKey);
        }

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        return ExtractContentFromChatCompletion(json);
    }

    private async Task<string?> CallGroqAsync(string prompt, RecipeAiInput input, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(60);

        var requestBody = new
        {
            model = "llama-3.3-70b-versatile",
            messages = new object[]
            {
                new { role = "system", content = prompt },
                new { role = "user", content = BuildUserContent(input) }
            },
            response_format = new { type = "json_object" },
            temperature = 0.3
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiConfiguration.Ai.Providers.Groq.ApiKey);

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) return null;

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        return ExtractContentFromChatCompletion(json);
    }

    private async Task<string?> CallGeminiAsync(string prompt, RecipeAiInput input, CancellationToken cancellationToken)
    {
        var gemini = new Client(
            apiKey: apiConfiguration.Ai.Providers.Gemini.ApiKey,
            httpOptions: new HttpOptions
            {
                Timeout = (int)TimeSpan.FromSeconds(Math.Clamp(apiConfiguration.Ai.Providers.Gemini.TimeoutSeconds, 30, 300)).TotalMilliseconds
            });

        var parts = new List<Part> { Part.FromText(prompt) };

        if (!string.IsNullOrWhiteSpace(input.TextData))
        {
            parts.Add(Part.FromText(input.TextData));
        }

        if (!string.IsNullOrWhiteSpace(input.FileData))
        {
            var mime = input.SourceType.Equals("pdf", StringComparison.OrdinalIgnoreCase) ? "application/pdf" : "image/jpeg";
            var raw = input.FileData.Contains(',') ? input.FileData[(input.FileData.IndexOf(',') + 1)..] : input.FileData;
            parts.Add(Part.FromBytes(Convert.FromBase64String(raw), mime));
        }

        var response = await gemini.Models.GenerateContentAsync(
            model: "gemini-2.5-flash",
            contents: new Content { Parts = parts },
            config: new GenerateContentConfig
            {
                ResponseMimeType = "application/json",
                Temperature = 0.4f
            },
            cancellationToken: cancellationToken);

        return ExtractGeminiText(response);
    }

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

    private static string BuildUserContent(RecipeAiInput input)
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(input.TextData))
        {
            sb.AppendLine(input.TextData);
        }
        if (!string.IsNullOrWhiteSpace(input.ExtraPrompt))
        {
            sb.AppendLine($"Extra instructions: {input.ExtraPrompt}");
        }
        return sb.Length > 0 ? sb.ToString() : "Genera variantes de la receta solicitada.";
    }

    private static string? ExtractContentFromChatCompletion(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var first = choices[0];
                if (first.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var content))
                {
                    return content.GetString();
                }
            }
        }
        catch
        {
            // ignore
        }
        return null;
    }

    private static IReadOnlyList<RecipeAiOption> ParseAiResponse(string json)
    {
        var cleanJson = json.Trim();
        if (cleanJson.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            cleanJson = cleanJson[7..];
        }
        if (cleanJson.StartsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            cleanJson = cleanJson[3..];
        }
        if (cleanJson.EndsWith("```", StringComparison.OrdinalIgnoreCase))
        {
            cleanJson = cleanJson[..^3];
        }
        cleanJson = cleanJson.Trim();

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