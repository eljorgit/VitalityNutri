using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Persistence;

namespace VitalityNutri.Infrastructure;

public static class DatabaseMigrationExtensions
{
    public static async Task ApplyDatabaseMigrationsAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        if (!scope.ServiceProvider.GetRequiredService<ApiConfiguration>().Database.ApplyMigrations) return;
        await scope.ServiceProvider.GetRequiredService<VitalityNutriDbContext>().Database.MigrateAsync(cancellationToken);
    }
}