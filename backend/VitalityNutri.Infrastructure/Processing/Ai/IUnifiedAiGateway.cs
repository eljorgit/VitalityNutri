namespace VitalityNutri.Infrastructure.Processing.Ai;

public interface IUnifiedAiGateway
{
    Task<string?> GenerateTextAsync(
        string chainConfig,
        string prompt,
        string? systemPrompt = null,
        bool jsonMode = true,
        float temperature = 0.2f,
        CancellationToken cancellationToken = default);

    Task<string?> GenerateMultimodalAsync(
        string chainConfig,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature = 0.2f,
        CancellationToken cancellationToken = default);

    IAsyncEnumerable<string> StreamTextAsync(
        string chainConfig,
        string prompt,
        string? systemPrompt = null,
        bool jsonMode = true,
        float temperature = 0.2f,
        CancellationToken cancellationToken = default);

    IAsyncEnumerable<string> StreamMultimodalAsync(
        string chainConfig,
        string prompt,
        byte[] fileBytes,
        string mimeType,
        float temperature = 0.2f,
        CancellationToken cancellationToken = default);
}
