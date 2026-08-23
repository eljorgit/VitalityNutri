using System.Text.RegularExpressions;

namespace VitalityNutri.Infrastructure.Configuration;

/// <summary>
/// Validates user-defined BYOK fallback chains. Entries may reference stored user keys
/// ("#&lt;keyId&gt;:model") and/or fall back to standard server providers ("provider:model").
/// </summary>
public static partial class ByokChainFormat
{
    public const string RequiredPattern = "#keyId:model";

    [GeneratedRegex(@"^#\d+:.+$", RegexOptions.CultureInvariant)]
    private static partial Regex ByokEntryRegex();

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
        var trimmed = entry.Trim();
        if (trimmed.StartsWith('#'))
        {
            return ByokEntryRegex().IsMatch(trimmed);
        }

        return AiFallbackChainFormat.IsValidEntry(trimmed);
    }
}
