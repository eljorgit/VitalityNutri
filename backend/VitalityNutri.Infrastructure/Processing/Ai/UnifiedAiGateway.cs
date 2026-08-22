using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Google.GenAI;
using Google.GenAI.Types;
using Microsoft.Extensions.Logging;
using Sentry;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing.Ai;

public sealed class UnifiedAiGateway(
    ApiConfiguration apiConfiguration,
    IHttpClientFactory httpClientFactory,
    ILogger<UnifiedAiGateway> logger)
    : IUnifiedAiGateway
{
    private static readonly ConcurrentDictionary<string, DateTimeOffset> DecommissionedModels = new(StringComparer.OrdinalIgnoreCase);

    public async Task<string?> GenerateTextAsync(
        string chainConfig,
        string prompt,
        string? systemPrompt = null,
        bool jsonMode = true,
        float temperature = 0.2f,
        CancellationToken cancellationToken = default)
    {
        var chain = ParseChain(chainConfig);
        if (chain.Length == 0)
        {
            logger.LogWarning("[AiGateway] Fallback chain is empty. Skipping AI generation.");
            return null;
        }

        foreach (var descriptor in chain)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (IsModelTemporarilyBypassed(descriptor))
            {
                logger.LogDebug("[AiGateway] Skipping previously decommissioned model '{Descriptor}'.", descriptor.Raw);
                continue;
            }

            try
            {
                var response = await ExecuteSingleTextAsync(descriptor, prompt, systemPrompt, jsonMode, temperature, chainConfig, cancellationToken);
                if (!string.IsNullOrWhiteSpace(response))
                {
                    if (jsonMode)
                    {
                        var cleaned = CleanMarkdownCodeBlock(response);
                        if (IsValidJson(cleaned))
                        {
                            logger.LogInformation("[AiGateway] Model '{Descriptor}' succeeded for JSON text generation.", descriptor.Raw);
                            return cleaned;
                        }
                    }
                    else
                    {
                        logger.LogInformation("[AiGateway] Model '{Descriptor}' succeeded for text generation.", descriptor.Raw);
                        return response;
                    }
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                CheckAndRecordGeminiModelException(descriptor, ex, chainConfig);
                logger.LogWarning(ex, "[AiGateway] Model '{Descriptor}' failed: {Message}. Advancing to next candidate in chain.", descriptor.Raw, ex.Message);
            }
        }

        logger.LogWarning("[AiGateway] All models in chain [{Chain}] failed.", chainConfig);
        return null;
    }

    public async Task<string?> GenerateMultimodalAsync(
        string chainConfig,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature = 0.2f,
        CancellationToken cancellationToken = default)
    {
        var chain = ParseChain(chainConfig);
        if (chain.Length == 0)
        {
            logger.LogWarning("[AiGateway] Multimodal fallback chain is empty. Skipping AI generation.");
            return null;
        }

        foreach (var descriptor in chain)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (IsModelTemporarilyBypassed(descriptor))
            {
                logger.LogDebug("[AiGateway] Skipping previously decommissioned model '{Descriptor}'.", descriptor.Raw);
                continue;
            }

            try
            {
                var response = await ExecuteSingleMultimodalAsync(descriptor, prompt, fileBytes, mimeType, temperature, chainConfig, cancellationToken);
                if (!string.IsNullOrWhiteSpace(response))
                {
                    var cleaned = CleanMarkdownCodeBlock(response);
                    if (IsValidJson(cleaned))
                    {
                        logger.LogInformation("[AiGateway] Multimodal model '{Descriptor}' succeeded.", descriptor.Raw);
                        return cleaned;
                    }
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                CheckAndRecordGeminiModelException(descriptor, ex, chainConfig);
                logger.LogWarning(ex, "[AiGateway] Multimodal model '{Descriptor}' failed: {Message}. Advancing to next candidate in chain.", descriptor.Raw, ex.Message);
            }
        }

        logger.LogWarning("[AiGateway] All models in multimodal chain [{Chain}] failed.", chainConfig);
        return null;
    }

    public async IAsyncEnumerable<string> StreamTextAsync(
        string chainConfig,
        string prompt,
        string? systemPrompt = null,
        bool jsonMode = true,
        float temperature = 0.2f,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chain = ParseChain(chainConfig);
        if (chain.Length == 0)
        {
            yield break;
        }

        foreach (var descriptor in chain)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (IsModelTemporarilyBypassed(descriptor))
            {
                logger.LogDebug("[AiGateway] Skipping previously decommissioned model '{Descriptor}'.", descriptor.Raw);
                continue;
            }

            var chunksReceived = 0;
            IAsyncEnumerable<string>? stream = null;

            try
            {
                stream = StreamSingleTextAsync(descriptor, prompt, systemPrompt, jsonMode, temperature, chainConfig, cancellationToken);
            }
            catch (Exception ex)
            {
                CheckAndRecordGeminiModelException(descriptor, ex, chainConfig);
                logger.LogWarning(ex, "[AiGateway] Model '{Descriptor}' stream init failed: {Message}. Trying next candidate.", descriptor.Raw, ex.Message);
                continue;
            }

            var enumerator = stream.GetAsyncEnumerator(cancellationToken);
            try
            {
                while (true)
                {
                    string? chunk = null;
                    try
                    {
                        if (!await enumerator.MoveNextAsync())
                        {
                            break;
                        }
                        chunk = enumerator.Current;
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        CheckAndRecordGeminiModelException(descriptor, ex, chainConfig);
                        logger.LogWarning(ex, "[AiGateway] Model '{Descriptor}' stream interrupted after {Chunks} chunks: {Message}.", descriptor.Raw, chunksReceived, ex.Message);
                        break;
                    }

                    if (!string.IsNullOrEmpty(chunk))
                    {
                        chunksReceived++;
                        yield return chunk;
                    }
                }
            }
            finally
            {
                await enumerator.DisposeAsync();
            }

            if (chunksReceived > 0)
            {
                logger.LogInformation("[AiGateway] Stream completed successfully with model '{Descriptor}'. Total chunks: {Chunks}.", descriptor.Raw, chunksReceived);
                yield break;
            }
        }
    }

    public async IAsyncEnumerable<string> StreamMultimodalAsync(
        string chainConfig,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature = 0.2f,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chain = ParseChain(chainConfig);
        if (chain.Length == 0)
        {
            yield break;
        }

        foreach (var descriptor in chain)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (IsModelTemporarilyBypassed(descriptor))
            {
                logger.LogDebug("[AiGateway] Skipping previously decommissioned model '{Descriptor}'.", descriptor.Raw);
                continue;
            }

            var chunksReceived = 0;
            IAsyncEnumerable<string>? stream = null;

            try
            {
                stream = StreamSingleMultimodalAsync(descriptor, prompt, fileBytes, mimeType, temperature, chainConfig, cancellationToken);
            }
            catch (Exception ex)
            {
                CheckAndRecordGeminiModelException(descriptor, ex, chainConfig);
                logger.LogWarning(ex, "[AiGateway] Multimodal model '{Descriptor}' stream init failed: {Message}. Trying next candidate.", descriptor.Raw, ex.Message);
                continue;
            }

            var enumerator = stream.GetAsyncEnumerator(cancellationToken);
            try
            {
                while (true)
                {
                    string? chunk = null;
                    try
                    {
                        if (!await enumerator.MoveNextAsync())
                        {
                            break;
                        }
                        chunk = enumerator.Current;
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        CheckAndRecordGeminiModelException(descriptor, ex, chainConfig);
                        logger.LogWarning(ex, "[AiGateway] Multimodal stream model '{Descriptor}' interrupted after {Chunks} chunks: {Message}.", descriptor.Raw, chunksReceived, ex.Message);
                        break;
                    }

                    if (!string.IsNullOrEmpty(chunk))
                    {
                        chunksReceived++;
                        yield return chunk;
                    }
                }
            }
            finally
            {
                await enumerator.DisposeAsync();
            }

            if (chunksReceived > 0)
            {
                logger.LogInformation("[AiGateway] Multimodal stream completed with model '{Descriptor}'. Total chunks: {Chunks}.", descriptor.Raw, chunksReceived);
                yield break;
            }
        }
    }

    private async Task<string?> ExecuteSingleTextAsync(
        ModelDescriptor descriptor,
        string prompt,
        string? systemPrompt,
        bool jsonMode,
        float temperature,
        string chainConfig,
        CancellationToken cancellationToken)
    {
        if (descriptor.Provider.Equals("omniroute", StringComparison.OrdinalIgnoreCase) || apiConfiguration.Ai.UseOmniRoute)
        {
            return await CallOmniRouteAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, chainConfig, cancellationToken);
        }

        if (descriptor.Provider.Equals("groq", StringComparison.OrdinalIgnoreCase))
        {
            return await CallGroqAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, chainConfig, cancellationToken);
        }

        if (descriptor.Provider.Equals("gemini", StringComparison.OrdinalIgnoreCase))
        {
            return await CallGeminiTextAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, cancellationToken);
        }

        throw new NotSupportedException($"Unsupported AI provider '{descriptor.Provider}'.");
    }

    private async Task<string?> ExecuteSingleMultimodalAsync(
        ModelDescriptor descriptor,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature,
        string chainConfig,
        CancellationToken cancellationToken)
    {
        if (descriptor.Provider.Equals("gemini", StringComparison.OrdinalIgnoreCase))
        {
            return await CallGeminiMultimodalAsync(descriptor.ModelName, prompt, fileBytes, mimeType, temperature, cancellationToken);
        }

        logger.LogWarning("[AiGateway] Multimodal execution is currently only supported on Gemini. Skipping '{Descriptor}'.", descriptor.Raw);
        return null;
    }

    private async IAsyncEnumerable<string> StreamSingleTextAsync(
        ModelDescriptor descriptor,
        string prompt,
        string? systemPrompt,
        bool jsonMode,
        float temperature,
        string chainConfig,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        if (descriptor.Provider.Equals("gemini", StringComparison.OrdinalIgnoreCase))
        {
            await foreach (var chunk in StreamGeminiTextAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, cancellationToken))
            {
                yield return chunk;
            }
            yield break;
        }

        // For non-streaming providers (e.g. Groq standard endpoint), execute full and yield once
        var full = await ExecuteSingleTextAsync(descriptor, prompt, systemPrompt, jsonMode, temperature, chainConfig, cancellationToken);
        if (!string.IsNullOrEmpty(full))
        {
            yield return full;
        }
    }

    private async IAsyncEnumerable<string> StreamSingleMultimodalAsync(
        ModelDescriptor descriptor,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature,
        string chainConfig,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        if (descriptor.Provider.Equals("gemini", StringComparison.OrdinalIgnoreCase))
        {
            await foreach (var chunk in StreamGeminiMultimodalAsync(descriptor.ModelName, prompt, fileBytes, mimeType, temperature, cancellationToken))
            {
                yield return chunk;
            }
            yield break;
        }

        var full = await ExecuteSingleMultimodalAsync(descriptor, prompt, fileBytes, mimeType, temperature, chainConfig, cancellationToken);
        if (!string.IsNullOrEmpty(full))
        {
            yield return full;
        }
    }

    #region Groq Execution

    private async Task<string?> CallGroqAsync(
        string modelName,
        string prompt,
        string? systemPrompt,
        bool jsonMode,
        float temperature,
        string chainConfig,
        CancellationToken cancellationToken)
    {
        var apiKey = apiConfiguration.Ai.Providers.Groq.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogDebug("[AiGateway] Groq API key is not configured. Skipping Groq model '{Model}'.", modelName);
            return null;
        }

        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(60);

        var messages = new List<object>();
        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            messages.Add(new { role = "system", content = systemPrompt });
        }
        messages.Add(new { role = "user", content = prompt });

        object requestBody = jsonMode
            ? new
            {
                model = modelName,
                messages,
                temperature,
                response_format = new { type = "json_object" }
            }
            : new
            {
                model = modelName,
                messages,
                temperature
            };

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync(cancellationToken);

            if (IsGroqModelUnavailableError(response.StatusCode, errContent))
            {
                RecordModelUnavailable(new ModelDescriptor("groq", modelName, $"groq:{modelName}"), errContent, chainConfig);
            }
            else
            {
                logger.LogWarning("[AiGateway] Groq request failed with HTTP {StatusCode}: {Error}", response.StatusCode, errContent);
            }

            return null;
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        return ExtractContentFromChatCompletion(json);
    }

    private static bool IsGroqModelUnavailableError(HttpStatusCode statusCode, string errorBody)
    {
        if (statusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
        {
            return errorBody.Contains("model_not_found", StringComparison.OrdinalIgnoreCase)
                || errorBody.Contains("does not exist", StringComparison.OrdinalIgnoreCase)
                || errorBody.Contains("do not have access", StringComparison.OrdinalIgnoreCase)
                || errorBody.Contains("decommissioned", StringComparison.OrdinalIgnoreCase)
                || errorBody.Contains("deprecated", StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    #endregion

    #region Gemini Execution

    private async Task<string?> CallGeminiTextAsync(
        string modelName,
        string prompt,
        string? systemPrompt,
        bool jsonMode,
        float temperature,
        CancellationToken cancellationToken)
    {
        var apiKey = apiConfiguration.Ai.Providers.Gemini.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogDebug("[AiGateway] Gemini API key is not configured. Skipping Gemini model '{Model}'.", modelName);
            return null;
        }

        var client = CreateGeminiClient(apiKey);
        var parts = new List<Part>();
        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            parts.Add(Part.FromText(systemPrompt));
        }
        parts.Add(Part.FromText(prompt));

        var contents = new Content
        {
            Role = "user",
            Parts = parts
        };

        var config = new GenerateContentConfig
        {
            Temperature = temperature,
            ResponseMimeType = jsonMode ? "application/json" : null
        };

        var response = await client.Models.GenerateContentAsync(
            model: modelName,
            contents: contents,
            config: config,
            cancellationToken: cancellationToken);

        return ExtractGeminiText(response);
    }

    private async Task<string?> CallGeminiMultimodalAsync(
        string modelName,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature,
        CancellationToken cancellationToken)
    {
        var apiKey = apiConfiguration.Ai.Providers.Gemini.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogDebug("[AiGateway] Gemini API key is not configured. Skipping Gemini model '{Model}'.", modelName);
            return null;
        }

        var client = CreateGeminiClient(apiKey);
        var contents = new Content
        {
            Role = "user",
            Parts = new List<Part>
            {
                Part.FromBytes(fileBytes, mimeType),
                Part.FromText(prompt)
            }
        };

        var config = new GenerateContentConfig
        {
            Temperature = temperature,
            ResponseMimeType = "application/json"
        };

        var response = await client.Models.GenerateContentAsync(
            model: modelName,
            contents: contents,
            config: config,
            cancellationToken: cancellationToken);

        return ExtractGeminiText(response);
    }

    private async IAsyncEnumerable<string> StreamGeminiTextAsync(
        string modelName,
        string prompt,
        string? systemPrompt,
        bool jsonMode,
        float temperature,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var apiKey = apiConfiguration.Ai.Providers.Gemini.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            yield break;
        }

        var client = CreateGeminiClient(apiKey);
        var parts = new List<Part>();
        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            parts.Add(Part.FromText(systemPrompt));
        }
        parts.Add(Part.FromText(prompt));

        var contents = new Content
        {
            Role = "user",
            Parts = parts
        };

        var config = new GenerateContentConfig
        {
            Temperature = temperature,
            ResponseMimeType = jsonMode ? "application/json" : null
        };

        await foreach (var chunk in client.Models.GenerateContentStreamAsync(
            model: modelName,
            contents: contents,
            config: config,
            cancellationToken: cancellationToken))
        {
            var text = ExtractGeminiText(chunk);
            if (!string.IsNullOrEmpty(text))
            {
                yield return text;
            }
        }
    }

    private async IAsyncEnumerable<string> StreamGeminiMultimodalAsync(
        string modelName,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature,
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var apiKey = apiConfiguration.Ai.Providers.Gemini.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            yield break;
        }

        var client = CreateGeminiClient(apiKey);
        var contents = new Content
        {
            Role = "user",
            Parts = new List<Part>
            {
                Part.FromBytes(fileBytes, mimeType),
                Part.FromText(prompt)
            }
        };

        var config = new GenerateContentConfig
        {
            Temperature = temperature,
            ResponseMimeType = "application/json"
        };

        await foreach (var chunk in client.Models.GenerateContentStreamAsync(
            model: modelName,
            contents: contents,
            config: config,
            cancellationToken: cancellationToken))
        {
            var text = ExtractGeminiText(chunk);
            if (!string.IsNullOrEmpty(text))
            {
                yield return text;
            }
        }
    }

    private Client CreateGeminiClient(string apiKey)
    {
        var timeoutSeconds = Math.Clamp(apiConfiguration.Ai.Providers.Gemini.TimeoutSeconds, 30, 3600);
        return new Client(
            apiKey: apiKey,
            httpOptions: new HttpOptions
            {
                Timeout = timeoutSeconds * 1000
            });
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

        return string.Concat(parts.Select(p => p.Text ?? string.Empty));
    }

    private void CheckAndRecordGeminiModelException(ModelDescriptor descriptor, Exception ex, string? chainConfig)
    {
        if (!descriptor.Provider.Equals("gemini", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var msg = ex.Message;
        if (msg.Contains("no longer available", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("not found", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("is not supported", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("deprecated", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("decommissioned", StringComparison.OrdinalIgnoreCase))
        {
            RecordModelUnavailable(descriptor, msg, chainConfig);
        }
    }

    #endregion

    #region OmniRoute Execution

    private async Task<string?> CallOmniRouteAsync(
        string modelName,
        string prompt,
        string? systemPrompt,
        bool jsonMode,
        float temperature,
        string chainConfig,
        CancellationToken cancellationToken)
    {
        var url = apiConfiguration.Ai.OmniRoute.Url;
        if (string.IsNullOrWhiteSpace(url))
        {
            logger.LogDebug("[AiGateway] OmniRoute URL is not configured. Skipping OmniRoute model '{Model}'.", modelName);
            return null;
        }

        var client = httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(Math.Clamp(apiConfiguration.Ai.Providers.Gemini.TimeoutSeconds, 30, 300));

        var endpoint = url.TrimEnd('/') + (url.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase) ? string.Empty : "/chat/completions");

        var messages = new List<object>();
        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            messages.Add(new { role = "system", content = systemPrompt });
        }
        messages.Add(new { role = "user", content = prompt });

        var requestBody = new
        {
            model = modelName,
            messages,
            temperature,
            response_format = jsonMode ? new { type = "json_object" } : null
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        if (!string.IsNullOrWhiteSpace(apiConfiguration.Ai.OmniRoute.ApiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiConfiguration.Ai.OmniRoute.ApiKey);
        }

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("[AiGateway] OmniRoute request failed with HTTP {StatusCode}: {Error}", response.StatusCode, errContent);
            return null;
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        return ExtractContentFromChatCompletion(json);
    }

    #endregion

    #region Model Parsing, Circuit Breaker & Sentry Alerting

    private sealed record ModelDescriptor(string Provider, string ModelName, string Raw);

    private static bool IsModelTemporarilyBypassed(ModelDescriptor descriptor)
    {
        if (DecommissionedModels.TryGetValue(descriptor.Raw, out var expiry))
        {
            if (DateTimeOffset.UtcNow < expiry)
            {
                return true;
            }

            DecommissionedModels.TryRemove(descriptor.Raw, out _);
        }

        return false;
    }

    private void RecordModelUnavailable(ModelDescriptor descriptor, string errorReason, string? chainContext)
    {
        // 1. In-memory circuit breaker (bypass model for 24h)
        DecommissionedModels[descriptor.Raw] = DateTimeOffset.UtcNow.AddHours(24);

        // 2. Structured Log
        logger.LogError(
            "[AiGateway:ModelUnavailable] Model '{Descriptor}' was reported as not found, deprecated or decommissioned by provider {Provider}: {Reason}. Automatically bypassing for 24 hours.",
            descriptor.Raw,
            descriptor.Provider,
            errorReason);

        // 3. Sentry Event Alerting
        try
        {
            var sentryEvent = new SentryEvent
            {
                Message = $"AI Model Deprecated / Not Found: {descriptor.Raw}",
                Level = SentryLevel.Error
            };

            sentryEvent.SetTag("ai.provider", descriptor.Provider);
            sentryEvent.SetTag("ai.model", descriptor.ModelName);
            sentryEvent.SetTag("ai.descriptor", descriptor.Raw);
            sentryEvent.SetTag("ai.issue", "model_not_found_or_deprecated");

            if (!string.IsNullOrWhiteSpace(chainContext))
            {
                sentryEvent.SetExtra("ai.chain", chainContext);
            }
            sentryEvent.SetExtra("ai.error_details", errorReason);

            SentrySdk.CaptureEvent(sentryEvent);
        }
        catch (Exception sentryEx)
        {
            logger.LogDebug(sentryEx, "[AiGateway] Failed recording Sentry alert for unavailable model.");
        }
    }

    private static ModelDescriptor[] ParseChain(string? rawChain)
    {
        if (string.IsNullOrWhiteSpace(rawChain))
        {
            return [];
        }

        var items = rawChain.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var descriptors = new List<ModelDescriptor>(items.Length);

        foreach (var item in items)
        {
            descriptors.Add(ResolveDescriptor(item));
        }

        return descriptors.DistinctBy(d => $"{d.Provider}:{d.ModelName}", StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static ModelDescriptor ResolveDescriptor(string raw)
    {
        var trimmed = raw.Trim();

        // 1. Explicit provider:model format
        if (trimmed.Contains(':', StringComparison.Ordinal))
        {
            var parts = trimmed.Split(':', 2, StringSplitOptions.TrimEntries);
            var provider = parts[0].ToLowerInvariant();
            var model = parts[1];
            return new ModelDescriptor(provider, model, trimmed);
        }

        // 2. Legacy / Alias resolution
        var lower = trimmed.ToLowerInvariant();

        if (lower.StartsWith("groq-", StringComparison.OrdinalIgnoreCase) || lower.StartsWith("groq", StringComparison.OrdinalIgnoreCase))
        {
            var resolvedGroq = lower switch
            {
                "groq-gpt-120b" or "groq-llama-3.3" => "openai/gpt-oss-120b",
                "groq-gpt-20b" or "groq-llama-8b" => "openai/gpt-oss-20b",
                "groq-qwen-3.6" => "qwen/qwen3.6-27b",
                "groq-compound" => "groq/compound",
                "groq-compound-mini" => "groq/compound-mini",
                _ when trimmed.Contains('-') => trimmed[(trimmed.IndexOf('-') + 1)..],
                _ => trimmed
            };
            return new ModelDescriptor("groq", resolvedGroq, trimmed);
        }

        if (lower.StartsWith("gemini", StringComparison.OrdinalIgnoreCase))
        {
            return new ModelDescriptor("gemini", trimmed, trimmed);
        }

        if (lower.StartsWith("omniroute", StringComparison.OrdinalIgnoreCase))
        {
            return new ModelDescriptor("omniroute", trimmed, trimmed);
        }

        // Default to gemini if unknown prefix
        return new ModelDescriptor("gemini", trimmed, trimmed);
    }

    public static string CleanMarkdownCodeBlock(string input)
    {
        var trimmed = input.Trim();
        if (trimmed.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
        {
            trimmed = trimmed[7..];
        }
        else if (trimmed.StartsWith("```"))
        {
            trimmed = trimmed[3..];
        }

        if (trimmed.EndsWith("```"))
        {
            trimmed = trimmed[..^3];
        }

        return trimmed.Trim();
    }

    private static bool IsValidJson(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return false;
        try
        {
            using var doc = JsonDocument.Parse(input);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string? ExtractContentFromChatCompletion(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("choices", out var choices) &&
                choices.ValueKind == JsonValueKind.Array &&
                choices.GetArrayLength() > 0)
            {
                var first = choices[0];
                if (first.TryGetProperty("message", out var msg) &&
                    msg.TryGetProperty("content", out var content) &&
                    content.ValueKind == JsonValueKind.String)
                {
                    return content.GetString();
                }
            }
        }
        catch
        {
            // Ignore
        }

        return null;
    }

    #endregion
}
