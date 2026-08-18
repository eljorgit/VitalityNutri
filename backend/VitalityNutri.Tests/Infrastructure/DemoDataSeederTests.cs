using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Persistence;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class DemoDataSeederTests
{
    [Fact]
    public async Task SeedDemoDataAsync_SeedsDemoPlanWithDemoBadgeMetadata_WhenDatabaseIsEmpty()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(new ApiConfiguration
        {
            App = new AppConfiguration { Mode = "Oss" },
            Database = new DatabaseOptions { Provider = "Sqlite", ApplyMigrations = true },
            ConnectionStrings = new ConnectionStringsConfiguration { Default = "Data Source=:memory:" }
        });

        services.AddDbContext<VitalityNutriDbContext>(options =>
            options.UseSqlite(connection, x => x.MigrationsAssembly("VitalityNutri.Migrations.Sqlite")));

        var provider = services.BuildServiceProvider();

        // Run migrations
        var db = provider.GetRequiredService<VitalityNutriDbContext>();
        await db.Database.MigrateAsync();

        // Assert empty initially
        Assert.False(await db.MealPlans.AnyAsync());

        // Run seeder
        await provider.SeedDemoDataAsync();

        // Verify seeded plan
        var plan = await db.MealPlans.SingleOrDefaultAsync(p => p.IsActive);
        Assert.NotNull(plan);
        Assert.Equal("Plan Demo (sin IA)", plan.FileName);
        Assert.Contains("\"isDemo\":true", plan.MetadataJson);
        Assert.Contains("\"fileName\":\"Plan Demo (sin IA)\"", plan.MetadataJson);

        // Verify ingredients and sample recipes seeded
        Assert.True(await db.Ingredients.AnyAsync());
        Assert.True(await db.Recipes.AnyAsync());
    }
}
