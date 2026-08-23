using System.Net.Http.Headers;
using System.Net.Http.Json;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing.Ai;

/// <summary>
/// Google Generative Language API adapter. Model ids are returned without the
/// "models/" prefix so they can be used directly in chain tokens.
/// </summary>
public sealed class GeminiByokProviderAdapter(IHttpClientFactory httpClientFactory) : IByokProviderAdapter
{
    public string ProviderType => "gemini";

    public bool SupportsMultimodal => true;

    public async Task<ByokValidationResult> ValidateAsync(string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var models = await ListModelsAsync(apiKey, baseUrl, cancellationToken);
            return new ByokValidationResult(true) { Models = models };
        }
        catch (ByokProviderException ex)
        {
            return new ByokValidationResult(false, ex.Message);
        }
    }

    public async Task<IReadOnlyList<string>> ListModelsAsync(string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
    {
        var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200");
        request.Headers.Add("x-goog-api-key", apiKey);

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new ByokProviderException(await ByokHttpErrorDescriber.DescribeErrorAsync(response));
        }

        var payload = await response.Content.ReadFromJsonAsync<GeminiModelsResponse>(cancellationToken: cancellationToken);
        return [.. (payload?.Models ?? [])
            .Select(m => (m.Name ?? string.Empty).Replace("models/", string.Empty, StringComparison.Ordinal))
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)];
    }

    private sealed record GeminiModelsResponse([property: System.Text.Json.Serialization.JsonPropertyName("models")] List<GeminiModel>? Models);

    private sealed record GeminiModel([property: System.Text.Json.Serialization.JsonPropertyName("name")] string? Name);
}

/// <summary>
/// OpenAI-compatible /v1/models adapter covering OpenAI, Groq, OpenRouter and any
/// custom base URL (OpenRouter proxies, Ollama, vLLM...).
/// </summary>
public sealed class OpenAiCompatibleByokProviderAdapter(
    IHttpClientFactory httpClientFactory,
    string providerType,
    string? fixedBaseUrl,
    bool supportsMultimodal) : IByokProviderAdapter
{
    public string ProviderType => providerType;

    public bool SupportsMultimodal => supportsMultimodal;

    public async Task<ByokValidationResult> ValidateAsync(string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var models = await ListModelsAsync(apiKey, baseUrl, cancellationToken);
            return new ByokValidationResult(true) { Models = models };
        }
        catch (ByokProviderException ex)
        {
            return new ByokValidationResult(false, ex.Message);
        }
    }

    public async Task<IReadOnlyList<string>> ListModelsAsync(string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
    {
        var endpoint = ResolveEndpoint(baseUrl);
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            throw new ByokProviderException("A base URL is required for this provider type.");
        }

        var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new ByokProviderException(await ByokHttpErrorDescriber.DescribeErrorAsync(response));
        }

        var payload = await response.Content.ReadFromJsonAsync<ChatCompletionsModelsResponse>(cancellationToken: cancellationToken);
        return [.. (payload?.Data ?? [])
            .Select(m => m.Id ?? string.Empty)
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)];
    }

    private string? ResolveEndpoint(string? baseUrl)
    {
        if (fixedBaseUrl is not null)
        {
            return $"{fixedBaseUrl.TrimEnd('/')}/models";
        }

        return string.IsNullOrWhiteSpace(baseUrl) ? null : $"{baseUrl.TrimEnd('/')}/models";
    }

    private sealed record ChatCompletionsModelsResponse([property: System.Text.Json.Serialization.JsonPropertyName("data")] List<ChatCompletionsModel>? Data);

    private sealed record ChatCompletionsModel([property: System.Text.Json.Serialization.JsonPropertyName("id")] string? Id);
}

/// <summary>Anthropic Messages API adapter.</summary>
public sealed class AnthropicByokProviderAdapter(IHttpClientFactory httpClientFactory) : IByokProviderAdapter
{
    public string ProviderType => "anthropic";

    public bool SupportsMultimodal => true;

    public async Task<ByokValidationResult> ValidateAsync(string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var models = await ListModelsAsync(apiKey, baseUrl, cancellationToken);
            return new ByokValidationResult(true) { Models = models };
        }
        catch (ByokProviderException ex)
        {
            return new ByokValidationResult(false, ex.Message);
        }
    }

    public async Task<IReadOnlyList<string>> ListModelsAsync(string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
    {
        var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "https://api.anthropic.com/v1/models?limit=100");
        request.Headers.TryAddWithoutValidation("x-api-key", apiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");

        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new ByokProviderException(await ByokHttpErrorDescriber.DescribeErrorAsync(response));
        }

        var payload = await response.Content.ReadFromJsonAsync<AnthropicModelsResponse>(cancellationToken: cancellationToken);
        return [.. (payload?.Data ?? [])
            .Select(m => m.Id ?? string.Empty)
            .Where(id => id.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)];
    }

    private sealed record AnthropicModelsResponse([property: System.Text.Json.Serialization.JsonPropertyName("data")] List<AnthropicModel>? Data);

    private sealed record AnthropicModel([property: System.Text.Json.Serialization.JsonPropertyName("id")] string? Id);
}
