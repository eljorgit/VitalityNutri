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
		var provider = apiConfiguration.Database.Provider;
		var builder = new DbContextOptionsBuilder<VitalityNutriDbContext>();
		var configuredConnection = apiConfiguration.ConnectionStrings.Default;
		if (string.Equals(provider, DatabaseOptions.SqliteProvider, StringComparison.OrdinalIgnoreCase))
		{
			var connection = configuredConnection ?? "Data Source=vitalitynutri-design.db";
			builder.UseSqlite(connection, x => x.MigrationsAssembly("VitalityNutri.Migrations.Sqlite"));
		}
		else
		{
			var connection = configuredConnection
				?? "Server=localhost;Port=3306;Database=vitalitynutri;User ID=vitalitynutri;Password=design-time;";
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
