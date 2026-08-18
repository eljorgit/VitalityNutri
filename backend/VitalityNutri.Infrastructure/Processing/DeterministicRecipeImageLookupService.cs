using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed class DeterministicRecipeImageLookupService(
    ApiConfiguration apiConfiguration,
    IHttpClientFactory httpClientFactory,
    ILogger<DeterministicRecipeImageLookupService> logger)
    : IRecipeImageLookupService
{
    private static readonly string[] StaticFallbackImages =
    [
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1484723091739-30a097e8f929?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop"
    ];

    public async Task<IReadOnlyList<string>> SearchImagesAsync(string query, CancellationToken cancellationToken)
    {
        var accessKey = apiConfiguration.ExternalServices.Unsplash.AccessKey;
        if (!string.IsNullOrWhiteSpace(accessKey))
        {
            try
            {
                var client = httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Client-ID", accessKey);
                var url = $"https://api.unsplash.com/search/photos?query={Uri.EscapeDataString(query)}&per_page=12&orientation=landscape";
                using var response = await client.GetAsync(url, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync(cancellationToken);
                    using var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("results", out var results) && results.ValueKind == JsonValueKind.Array)
                    {
                        var urls = new List<string>();
                        foreach (var item in results.EnumerateArray())
                        {
                            if (item.TryGetProperty("urls", out var urlsObj) && urlsObj.TryGetProperty("regular", out var regularUrl))
                            {
                                var regular = regularUrl.GetString();
                                if (!string.IsNullOrWhiteSpace(regular))
                                {
                                    urls.Add(regular);
                                }
                            }
                        }

                        if (urls.Count > 0)
                        {
                            return urls;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[ImageLookup] Failed querying live Unsplash API for query '{Query}'. Falling back to deterministic images.", query);
            }
        }

        return FallbackSearch(query);
    }

    public async Task<string> ResolveReplacementImageAsync(string recipeName, string mealType, IReadOnlyCollection<string> excludedUrls, CancellationToken cancellationToken)
    {
        var searchResults = await SearchImagesAsync($"{recipeName} {mealType}".Trim(), cancellationToken);
        var candidate = searchResults.FirstOrDefault(url => !excludedUrls.Contains(url, StringComparer.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(candidate))
        {
            return candidate;
        }

        var normalized = Normalize(recipeName + " " + mealType);
        var offset = normalized.Length == 0 ? 0 : normalized.Sum(ch => ch) % StaticFallbackImages.Length;

        return Enumerable.Range(0, StaticFallbackImages.Length)
            .Select(index => StaticFallbackImages[(index + offset) % StaticFallbackImages.Length])
            .FirstOrDefault(url => !excludedUrls.Contains(url, StringComparer.OrdinalIgnoreCase)) ?? StaticFallbackImages[0];
    }

    private static IReadOnlyList<string> FallbackSearch(string query)
    {
        var normalized = Normalize(query);
        if (normalized.Length == 0)
        {
            return StaticFallbackImages;
        }

        var offset = normalized.Sum(ch => ch) % StaticFallbackImages.Length;
        return Enumerable.Range(0, StaticFallbackImages.Length)
            .Select(index => StaticFallbackImages[(index + offset) % StaticFallbackImages.Length])
            .ToArray();
    }

    private static string Normalize(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character) || char.IsWhiteSpace(character))
            {
                builder.Append(char.ToLowerInvariant(character));
            }
        }

        return builder.ToString().Trim();
    }
}