using System.Text.RegularExpressions;

namespace VitalityNutri.Infrastructure.Configuration;

public static partial class AiFallbackChainFormat
{
    public const string RequiredPattern = "provider:model";

    public static readonly string[] SupportedProviders = ["gemini", "groq", "omniroute", "anthropic", "openai", "openrouter"];

    [GeneratedRegex(@"^[A-Za-z0-9_-]+:.+$", RegexOptions.CultureInvariant)]
    private static partial Regex ChainEntryRegex();

    public static bool IsValidChain(string? chain)
    {
        return !string.IsNullOrWhiteSpace(chain) && GetInvalidEntries(chain).Count == 0;
    }

    public static IReadOnlyList<string> GetInvalidEntries(string? chain)
    {
        if (string.IsNullOrWhiteSpace(chain))
        {
            return [];
        }

        return chain.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(static entry => !IsValidEntry(entry))
            .ToArray();
    }

    public static bool IsValidEntry(string entry)
    {
        if (!ChainEntryRegex().IsMatch(entry))
        {
            return false;
        }

        var provider = entry.Split(':', 2)[0];
        return SupportedProviders.Contains(provider, StringComparer.OrdinalIgnoreCase);
    }
}
