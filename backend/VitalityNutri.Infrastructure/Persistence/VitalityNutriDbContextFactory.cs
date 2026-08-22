using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Persistence;

public sealed class VitalityNutriDbContextFactory : IDesignTimeDbContextFactory<VitalityNutriDbContext>
{
	public VitalityNutriDbContext CreateDbContext(string[] args)
	{
		var configuration = BuildConfiguration();
		var apiConfiguration = configuration.GetSection("ApiConfiguration").Get<ApiConfiguration>() ?? new ApiConfiguration();
		var provider = configuration["ApiConfiguration:Database:Provider"]
			?? configuration["ApiConfiguration__Database__Provider"]
			?? apiConfiguration.Database.Provider;

		var cmdArgs = Environment.GetCommandLineArgs();
		var isSqlite = string.Equals(provider, DatabaseOptions.SqliteProvider, StringComparison.OrdinalIgnoreCase)
			|| args.Any(a => a.Contains("Sqlite", StringComparison.OrdinalIgnoreCase))
			|| cmdArgs.Any(a => a.Contains("Sqlite", StringComparison.OrdinalIgnoreCase));

		var builder = new DbContextOptionsBuilder<VitalityNutriDbContext>();
		var configuredConnection = configuration.GetConnectionString("Default")
			?? configuration["ApiConfiguration:ConnectionStrings:Default"]
			?? configuration["ApiConfiguration__ConnectionStrings__Default"]
			?? apiConfiguration.ConnectionStrings.Default;

		if (isSqlite)
		{
			var connection = !string.IsNullOrWhiteSpace(configuredConnection) && !configuredConnection.Contains("Server=", StringComparison.OrdinalIgnoreCase)
				? configuredConnection
				: "Data Source=vitalitynutri-design.db";
			builder.UseSqlite(connection, x => x.MigrationsAssembly("VitalityNutri.Migrations.Sqlite"));
		}
		else
		{
			var connection = !string.IsNullOrWhiteSpace(configuredConnection) && configuredConnection.Contains("Server=", StringComparison.OrdinalIgnoreCase)
				? configuredConnection
				: "Server=localhost;Port=3306;Database=vitalitynutri;User ID=vitalitynutri;Password=design-time;";
			builder.UseMySQL(connection, x => x.MigrationsAssembly("VitalityNutri.Migrations.MySql"));
		}

		return new VitalityNutriDbContext(builder.Options);
	}

	private static IConfiguration BuildConfiguration()
	{
		return new ConfigurationBuilder()
			.AddEnvironmentVariables()
			.Build();
	}
}
