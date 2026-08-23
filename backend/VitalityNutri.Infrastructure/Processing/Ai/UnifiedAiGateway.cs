using System.ClientModel;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Anthropic;
using Anthropic.Models.Messages;
using Google.GenAI;
using Google.GenAI.Types;
using Content = Google.GenAI.Types.Content;
using GenAiContent = Google.GenAI.Types.Content;
using Microsoft.Extensions.Logging;
using OpenAI;
using OpenAI.Chat;
using Sentry;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing.Ai;

public sealed class UnifiedAiGateway(
    ApiConfiguration apiConfiguration,
    IHttpClientFactory httpClientFactory,
    ILogger<UnifiedAiGateway> logger,
    IByokCredentialResolver byokCredentialResolver)
    : IUnifiedAiGateway
{
    private static readonly ConcurrentDictionary<string, DateTimeOffset> DecommissionedModels = new(StringComparer.OrdinalIgnoreCase);

    public async Task<string?> GenerateTextAsync(
        string chainConfig,
        string prompt,
        string? systemPrompt = null,
        bool jsonMode = true,
        float temperature = 0.2f,
        AiUsageContext? usageContext = null,
        CancellationToken cancellationToken = default)
    {
        var chain = await MaterializeChainAsync(ParseChain(chainConfig), cancellationToken);
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
                CheckAndRecordProviderException(descriptor, ex, chainConfig);
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
        AiUsageContext? usageContext = null,
        CancellationToken cancellationToken = default)
    {
        var chain = await MaterializeChainAsync(ParseChain(chainConfig), cancellationToken);
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
                CheckAndRecordProviderException(descriptor, ex, chainConfig);
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
        AiUsageContext? usageContext = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chain = await MaterializeChainAsync(ParseChain(chainConfig), cancellationToken);
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
                CheckAndRecordProviderException(descriptor, ex, chainConfig);
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
                        CheckAndRecordProviderException(descriptor, ex, chainConfig);
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
        AiUsageContext? usageContext = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var chain = await MaterializeChainAsync(ParseChain(chainConfig), cancellationToken);
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
                CheckAndRecordProviderException(descriptor, ex, chainConfig);
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
                        CheckAndRecordProviderException(descriptor, ex, chainConfig);
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
        if (descriptor.Provider.Equals("omniroute", StringComparison.OrdinalIgnoreCase))
        {
            return await CallOmniRouteAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, chainConfig, cancellationToken);
        }

        if (descriptor.Provider.Equals("groq", StringComparison.OrdinalIgnoreCase))
        {
            return await CallGroqAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, chainConfig, cancellationToken, descriptor.ApiKeyOverride);
        }

        if (descriptor.Provider.Equals("gemini", StringComparison.OrdinalIgnoreCase))
        {
            return await CallGeminiTextAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, cancellationToken, descriptor.ApiKeyOverride);
        }

        if (descriptor.Provider.Equals("anthropic", StringComparison.OrdinalIgnoreCase))
        {
            return await CallAnthropicTextAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, cancellationToken, descriptor.ApiKeyOverride);
        }

        if (descriptor.Provider.Equals("openai-compatible", StringComparison.OrdinalIgnoreCase))
        {
            return await CallChatCompletionsTextAsync(
                descriptor.ApiKeyOverride,
                descriptor.BaseUrlOverride,
                300,
                descriptor.ModelName,
                prompt,
                systemPrompt,
                jsonMode,
                temperature,
                cancellationToken);
        }

        if (descriptor.Provider.Equals("openai", StringComparison.OrdinalIgnoreCase))
        {
            return await CallChatCompletionsTextAsync(
                descriptor.ApiKeyOverride ?? apiConfiguration.Ai.Providers.OpenAi.ApiKey,
                descriptor.BaseUrlOverride,
                apiConfiguration.Ai.Providers.OpenAi.TimeoutSeconds,
                descriptor.ModelName,
                prompt,
                systemPrompt,
                jsonMode,
                temperature,
                cancellationToken);
        }

        if (descriptor.Provider.Equals("openrouter", StringComparison.OrdinalIgnoreCase))
        {
            return await CallChatCompletionsTextAsync(
                descriptor.ApiKeyOverride ?? apiConfiguration.Ai.Providers.OpenRouter.ApiKey,
                descriptor.BaseUrlOverride ?? apiConfiguration.Ai.Providers.OpenRouter.Url,
                apiConfiguration.Ai.Providers.OpenRouter.TimeoutSeconds,
                descriptor.ModelName,
                prompt,
                systemPrompt,
                jsonMode,
                temperature,
                cancellationToken);
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
            return await CallGeminiMultimodalAsync(descriptor.ModelName, prompt, fileBytes, mimeType, temperature, cancellationToken, descriptor.ApiKeyOverride);
        }

        if (descriptor.Provider.Equals("omniroute", StringComparison.OrdinalIgnoreCase))
        {
            return await CallOmniRouteMultimodalAsync(descriptor.ModelName, prompt, fileBytes, mimeType, temperature, chainConfig, cancellationToken);
        }

        if (descriptor.Provider.Equals("anthropic", StringComparison.OrdinalIgnoreCase))
        {
            return await CallAnthropicMultimodalAsync(descriptor.ModelName, prompt, fileBytes, mimeType, temperature, cancellationToken, descriptor.ApiKeyOverride);
        }

        if (descriptor.Provider.Equals("openai", StringComparison.OrdinalIgnoreCase) || descriptor.Provider.Equals("openai-compatible", StringComparison.OrdinalIgnoreCase))
        {
            return await CallChatCompletionsMultimodalAsync(
                descriptor.ApiKeyOverride ?? apiConfiguration.Ai.Providers.OpenAi.ApiKey,
                descriptor.BaseUrlOverride,
                apiConfiguration.Ai.Providers.OpenAi.TimeoutSeconds,
                "openai",
                descriptor.ModelName,
                prompt,
                fileBytes,
                mimeType,
                temperature,
                cancellationToken);
        }

        if (descriptor.Provider.Equals("openrouter", StringComparison.OrdinalIgnoreCase))
        {
            return await CallChatCompletionsMultimodalAsync(
                descriptor.ApiKeyOverride ?? apiConfiguration.Ai.Providers.OpenRouter.ApiKey,
                descriptor.BaseUrlOverride ?? apiConfiguration.Ai.Providers.OpenRouter.Url,
                apiConfiguration.Ai.Providers.OpenRouter.TimeoutSeconds,
                "openrouter",
                descriptor.ModelName,
                prompt,
                fileBytes,
                mimeType,
                temperature,
                cancellationToken);
        }

        logger.LogWarning("[AiGateway] Multimodal execution supports only the Gemini, OmniRoute, Anthropic, OpenAI and OpenRouter providers. Skipping '{Descriptor}'.", descriptor.Raw);
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
            await foreach (var chunk in StreamGeminiTextAsync(descriptor.ModelName, prompt, systemPrompt, jsonMode, temperature, cancellationToken, descriptor.ApiKeyOverride))
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
            await foreach (var chunk in StreamGeminiMultimodalAsync(descriptor.ModelName, prompt, fileBytes, mimeType, temperature, cancellationToken, descriptor.ApiKeyOverride))
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
        CancellationToken cancellationToken,
        string? apiKeyOverride = null)
    {
        var apiKey = string.IsNullOrWhiteSpace(apiKeyOverride)
            ? apiConfiguration.Ai.Providers.Groq.ApiKey
            : apiKeyOverride;
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
        CancellationToken cancellationToken,
        string? apiKeyOverride = null)
    {
        var apiKey = ResolveGeminiApiKey(apiKeyOverride);
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

        var contents = new GenAiContent
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
        CancellationToken cancellationToken,
        string? apiKeyOverride = null)
    {
        var apiKey = ResolveGeminiApiKey(apiKeyOverride);
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogDebug("[AiGateway] Gemini API key is not configured. Skipping Gemini model '{Model}'.", modelName);
            return null;
        }

        var client = CreateGeminiClient(apiKey);
        var contents = new GenAiContent
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
        [EnumeratorCancellation] CancellationToken cancellationToken,
        string? apiKeyOverride = null)
    {
        var apiKey = ResolveGeminiApiKey(apiKeyOverride);
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

        var contents = new GenAiContent
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
        [EnumeratorCancellation] CancellationToken cancellationToken,
        string? apiKeyOverride = null)
    {
        var apiKey = ResolveGeminiApiKey(apiKeyOverride);
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            yield break;
        }

        var client = CreateGeminiClient(apiKey);
        var contents = new GenAiContent
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

    private string? ResolveGeminiApiKey(string? apiKeyOverride) => string.IsNullOrWhiteSpace(apiKeyOverride)
        ? apiConfiguration.Ai.Providers.Gemini.ApiKey
        : apiKeyOverride;

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

    private void CheckAndRecordProviderException(ModelDescriptor descriptor, Exception ex, string? chainConfig)
    {
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

        return await SendOmniRouteChatCompletionAsync(modelName, requestBody, cancellationToken);
    }

    private async Task<string?> CallOmniRouteMultimodalAsync(
        string modelName,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature,
        string chainConfig,
        CancellationToken cancellationToken)
    {
        var url = apiConfiguration.Ai.OmniRoute.Url;
        if (string.IsNullOrWhiteSpace(url))
        {
            logger.LogDebug("[AiGateway] OmniRoute URL is not configured. Skipping OmniRoute multimodal model '{Model}'.", modelName);
            return null;
        }

        var base64 = Convert.ToBase64String(fileBytes);

        object? attachmentPart = mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase)
            ? new { type = "image_url", image_url = new { url = $"data:{mimeType};base64,{base64}" } }
            : mimeType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase)
                ? new { type = "file", file = new { filename = "document.pdf", file_data = $"data:application/pdf;base64,{base64}" } }
                : null;

        if (attachmentPart is null)
        {
            logger.LogWarning("[AiGateway] OmniRoute multimodal does not support mime type '{MimeType}'. Skipping '{Model}'.", mimeType, modelName);
            return null;
        }

        var requestBody = new
        {
            model = modelName,
            messages = new object[]
            {
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        attachmentPart,
                        new { type = "text", text = prompt }
                    }
                }
            },
            temperature,
            response_format = new { type = "json_object" }
        };

        return await SendOmniRouteChatCompletionAsync(modelName, requestBody, cancellationToken);
    }

    private async Task<string?> SendOmniRouteChatCompletionAsync(
        string modelName,
        object requestBody,
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

    #region Anthropic Execution

    private async Task<string?> CallAnthropicTextAsync(
        string modelName,
        string prompt,
        string? systemPrompt,
        bool jsonMode,
        float temperature,
        CancellationToken cancellationToken,
        string? apiKeyOverride = null)
    {
        var anthropic = apiConfiguration.Ai.Providers.Anthropic;
        var apiKey = string.IsNullOrWhiteSpace(apiKeyOverride) ? anthropic.ApiKey : apiKeyOverride;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogDebug("[AiGateway] Anthropic API key is not configured. Skipping model '{Model}'.", modelName);
            return null;
        }

        var userMessage = new MessageParam
        {
            Role = Role.User,
            Content = prompt
        };

        var parameters = string.IsNullOrWhiteSpace(systemPrompt)
            ? BuildAnthropicCreateParams(anthropic.MaxTokens, modelName, userMessage)
            : BuildAnthropicCreateParams(anthropic.MaxTokens, modelName, userMessage, systemPrompt);

        var client = CreateAnthropicClient(apiKey, anthropic.TimeoutSeconds);
        var message = await client.Messages.Create(parameters, cancellationToken);
        return ExtractAnthropicText(message);
    }

    private static MessageCreateParams BuildAnthropicCreateParams(int maxTokens, string modelName, MessageParam userMessage)
    {
        return new MessageCreateParams
        {
            MaxTokens = maxTokens,
            Model = modelName,
            Messages = [userMessage]
        };
    }

    private static MessageCreateParams BuildAnthropicCreateParams(int maxTokens, string modelName, MessageParam userMessage, string systemPrompt)
    {
        return new MessageCreateParams
        {
            MaxTokens = maxTokens,
            Model = modelName,
            System = systemPrompt,
            Messages = [userMessage]
        };
    }

    private async Task<string?> CallAnthropicMultimodalAsync(
        string modelName,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature,
        CancellationToken cancellationToken,
        string? apiKeyOverride = null)
    {
        var anthropic = apiConfiguration.Ai.Providers.Anthropic;
        var apiKey = string.IsNullOrWhiteSpace(apiKeyOverride) ? anthropic.ApiKey : apiKeyOverride;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogDebug("[AiGateway] Anthropic API key is not configured. Skipping multimodal model '{Model}'.", modelName);
            return null;
        }

        var blocks = new List<ContentBlockParam>();
        if (mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            blocks.Add(new ImageBlockParam
            {
                Source = new Base64ImageSource
                {
                    Data = Convert.ToBase64String(fileBytes),
                    MediaType = mimeType
                }
            });
        }
        else if (mimeType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
        {
            blocks.Add(new DocumentBlockParam
            {
                Source = new Base64PdfSource(Convert.ToBase64String(fileBytes))
            });
        }
        else
        {
            logger.LogWarning("[AiGateway] Anthropic multimodal does not support mime type '{MimeType}'. Skipping '{Model}'.", mimeType, modelName);
            return null;
        }

        blocks.Add(new TextBlockParam(prompt));

        var parameters = new MessageCreateParams
        {
            MaxTokens = anthropic.MaxTokens,
            Model = modelName,
#pragma warning disable CS0618 // Temperature deprecated for newest Claude models; kept for older-model compatibility.
            Temperature = temperature,
#pragma warning restore CS0618
            Messages =
            [
                new MessageParam
                {
                    Role = Role.User,
                    Content = blocks
                }
            ]
        };

        var client = CreateAnthropicClient(apiKey, anthropic.TimeoutSeconds);
        var message = await client.Messages.Create(parameters, cancellationToken);
        return ExtractAnthropicText(message);
    }

    private AnthropicClient CreateAnthropicClient(string apiKey, int timeoutSeconds)
    {
        return new AnthropicClient
        {
            ApiKey = apiKey,
            Timeout = TimeSpan.FromSeconds(Math.Clamp(timeoutSeconds, 30, 3600))
        };
    }

    private static string? ExtractAnthropicText(Message message)
    {
        if (message.Content is null || message.Content.Count == 0)
        {
            return null;
        }

        var builder = new StringBuilder();
        foreach (var block in message.Content)
        {
            if (block.Value is TextBlock textBlock && !string.IsNullOrEmpty(textBlock.Text))
            {
                builder.Append(textBlock.Text);
            }
        }

        return builder.Length > 0 ? builder.ToString() : null;
    }

    #endregion

    #region Chat Completions Execution (OpenAI & OpenRouter)

    private async Task<string?> CallChatCompletionsTextAsync(
        string? apiKey,
        string? endpointOverride,
        int timeoutSeconds,
        string modelName,
        string prompt,
        string? systemPrompt,
        bool jsonMode,
        float temperature,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogDebug("[AiGateway] Chat Completions API key is not configured. Skipping model '{Model}'.", modelName);
            return null;
        }

        var messages = new List<ChatMessage>();
        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            messages.Add(new SystemChatMessage(systemPrompt));
        }
        messages.Add(new UserChatMessage(prompt));

        var options = new ChatCompletionOptions
        {
            Temperature = temperature
        };
        if (jsonMode)
        {
            options.ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat();
        }

        var result = await CreateChatCompletionsClient(apiKey, endpointOverride, timeoutSeconds, modelName)
            .CompleteChatAsync(messages, options, cancellationToken);
        return ExtractChatCompletionsText(result.Value);
    }

    private async Task<string?> CallChatCompletionsMultimodalAsync(
        string? apiKey,
        string? endpointOverride,
        int timeoutSeconds,
        string providerLabel,
        string modelName,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogDebug("[AiGateway] {Provider} API key is not configured. Skipping multimodal model '{Model}'.", providerLabel, modelName);
            return null;
        }

        var parts = new List<ChatMessageContentPart>();
        if (mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            parts.Add(ChatMessageContentPart.CreateImagePart(BinaryData.FromBytes(fileBytes), mimeType));
        }
        else if (mimeType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
        {
#pragma warning disable OPENAI001 // Experimental OpenAI SDK surface; required for PDF multimodal input.
            parts.Add(ChatMessageContentPart.CreateFilePart(BinaryData.FromBytes(fileBytes), mimeType, "document.pdf"));
#pragma warning restore OPENAI001
        }
        else
        {
            logger.LogWarning("[AiGateway] {Provider} multimodal does not support mime type '{MimeType}'. Skipping '{Model}'.", providerLabel, mimeType, modelName);
            return null;
        }

        parts.Add(ChatMessageContentPart.CreateTextPart(prompt));

        var messages = new List<ChatMessage>
        {
            new UserChatMessage(parts)
        };
        var options = new ChatCompletionOptions
        {
            Temperature = temperature,
            ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat()
        };

        var result = await CreateChatCompletionsClient(apiKey, endpointOverride, timeoutSeconds, modelName)
            .CompleteChatAsync(messages, options, cancellationToken);
        return ExtractChatCompletionsText(result.Value);
    }

    private ChatClient CreateChatCompletionsClient(string apiKey, string? endpointOverride, int timeoutSeconds, string modelName)
    {
        var options = new OpenAIClientOptions();
        if (!string.IsNullOrWhiteSpace(endpointOverride))
        {
            options.Endpoint = new Uri(endpointOverride);
        }

        options.NetworkTimeout = TimeSpan.FromSeconds(Math.Clamp(timeoutSeconds, 30, 3600));
        return new ChatClient(modelName, new ApiKeyCredential(apiKey), options);
    }

    private static string? ExtractChatCompletionsText(ChatCompletion completion)
    {
        var content = completion?.Content;
        if (content is null || content.Count == 0)
        {
            return null;
        }

        return string.Concat(content.Select(part => part.Text ?? string.Empty));
    }

    #endregion

    #region Model Parsing, Circuit Breaker & Sentry Alerting

    private sealed record ModelDescriptor(
        string Provider,
        string ModelName,
        string Raw,
        string? ApiKeyOverride = null,
        string? BaseUrlOverride = null);

    /// <summary>
    /// Replaces "#&lt;keyId&gt;:model" tokens with the owning user's decrypted provider credentials.
    /// Unresolvable tokens are dropped from the chain. Server entries pass through untouched and
    /// Raw keeps the "#id" form so the circuit breaker stays scoped per user key.
    /// </summary>
    private async Task<ModelDescriptor[]> MaterializeChainAsync(ModelDescriptor[] chain, CancellationToken cancellationToken)
    {
        if (!chain.Any(static d => d.Provider.StartsWith('#')))
        {
            return chain;
        }

        var materialized = new List<ModelDescriptor>(chain.Length);
        foreach (var descriptor in chain)
        {
            if (!descriptor.Provider.StartsWith('#'))
            {
                materialized.Add(descriptor);
                continue;
            }

            var creds = await byokCredentialResolver.ResolveAsync(descriptor.Provider, cancellationToken);
            if (creds is null)
            {
                logger.LogWarning("[AiGateway] BYOK credential '{Token}' could not be resolved for the current user. Skipping '{Raw}'.", descriptor.Provider, descriptor.Raw);
                continue;
            }

            if (creds.ProviderType.Equals("openai-compatible", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(creds.BaseUrl))
            {
                logger.LogWarning("[AiGateway] BYOK key {Token} requires a base URL for provider type 'openai-compatible'. Skipping '{Raw}'.", descriptor.Provider, descriptor.Raw);
                continue;
            }

            materialized.Add(descriptor with
            {
                Provider = creds.ProviderType,
                ApiKeyOverride = creds.ApiKey,
                BaseUrlOverride = creds.BaseUrl
            });
        }

        return [.. materialized];
    }

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

    private ModelDescriptor[] ParseChain(string? rawChain)
    {
        if (string.IsNullOrWhiteSpace(rawChain))
        {
            return [];
        }

        var items = rawChain.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var descriptors = new List<ModelDescriptor>(items.Length);

        foreach (var item in items)
        {
            var descriptor = ResolveDescriptor(item);
            if (descriptor is null)
            {
                logger.LogWarning("[AiGateway] Chain entry '{Entry}' violates the required '{Pattern}' format. Skipping entry.", item, AiFallbackChainFormat.RequiredPattern);
                continue;
            }

            descriptors.Add(descriptor);
        }

        return descriptors.DistinctBy(d => $"{d.Provider}:{d.ModelName}", StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static ModelDescriptor? ResolveDescriptor(string raw)
    {
        var trimmed = raw.Trim();

        if (!trimmed.Contains(':', StringComparison.Ordinal))
        {
            return null;
        }

        var parts = trimmed.Split(':', 2, StringSplitOptions.TrimEntries);
        var provider = parts[0].ToLowerInvariant();
        var model = parts[1];

        return parts.Length == 2 && provider.Length > 0 && model.Length > 0
            ? new ModelDescriptor(provider, model, trimmed)
            : null;
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
