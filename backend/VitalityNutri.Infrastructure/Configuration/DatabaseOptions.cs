namespace VitalityNutri.Infrastructure.Configuration;

public sealed class DatabaseOptions
{
    public const string MySqlProvider = "MySql";
    public const string SqliteProvider = "Sqlite";

    public string Provider { get; init; } = MySqlProvider;
    public bool ApplyMigrations { get; init; }
}
