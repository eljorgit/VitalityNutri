namespace VitalityNutri.Infrastructure.Configuration;

public static class DatabaseProviderPolicy
{
    public static bool IsAllowed(string mode, string provider) =>
        string.Equals(mode, "SaaS", StringComparison.OrdinalIgnoreCase)
            ? string.Equals(provider, DatabaseOptions.MySqlProvider, StringComparison.OrdinalIgnoreCase)
            : string.Equals(mode, "Oss", StringComparison.OrdinalIgnoreCase) &&
              (string.Equals(provider, DatabaseOptions.MySqlProvider, StringComparison.OrdinalIgnoreCase) ||
               string.Equals(provider, DatabaseOptions.SqliteProvider, StringComparison.OrdinalIgnoreCase));
}