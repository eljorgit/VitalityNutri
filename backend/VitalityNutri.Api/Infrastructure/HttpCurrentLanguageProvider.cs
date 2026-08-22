using Microsoft.AspNetCore.Http;
using VitalityNutri.Application.Abstractions.Common;

namespace VitalityNutri.Api.Infrastructure;

/// <summary>
/// Resolves the current request language based on query parameters, Accept-Language headers, or default fallback.
/// </summary>
/// <param name="httpContextAccessor">Accessor for current HTTP context.</param>
public sealed class HttpCurrentLanguageProvider(IHttpContextAccessor httpContextAccessor) : ICurrentLanguageProvider
{
    private static readonly HashSet<string> SupportedLanguages = new(StringComparer.OrdinalIgnoreCase)
    {
        "en", "es"
    };

    /// <summary>
    /// Gets the resolved language code (e.g. "en", "es").
    /// </summary>
    public string GetCurrentLanguage()
    {
        var httpContext = httpContextAccessor.HttpContext;
        if (httpContext is null)
        {
            return "en";
        }

        // 1. Query parameter override
        if (httpContext.Request.Query.TryGetValue("lang", out var langQuery) && !string.IsNullOrWhiteSpace(langQuery))
        {
            var clean = NormalizeLang(langQuery.ToString());
            if (clean is not null) return clean;
        }

        if (httpContext.Request.Query.TryGetValue("language", out var languageQuery) && !string.IsNullOrWhiteSpace(languageQuery))
        {
            var clean = NormalizeLang(languageQuery.ToString());
            if (clean is not null) return clean;
        }

        // 2. Accept-Language header
        var acceptHeader = httpContext.Request.Headers.AcceptLanguage.ToString();
        if (!string.IsNullOrWhiteSpace(acceptHeader))
        {
            var languages = acceptHeader.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var langItem in languages)
            {
                var candidate = langItem.Split(';')[0].Trim();
                var clean = NormalizeLang(candidate);
                if (clean is not null) return clean;
            }
        }

        // 3. Fallback default
        return "en";
    }

    private static string? NormalizeLang(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var prefix = value.Trim().ToLowerInvariant();
        if (prefix.Length > 2)
        {
            prefix = prefix[..2];
        }

        return SupportedLanguages.Contains(prefix) ? prefix : null;
    }
}
