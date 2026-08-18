using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Persistence;
using VitalityNutri.Infrastructure.Persistence.Repositories;
using VitalityNutri.Infrastructure.Processing;

namespace VitalityNutri.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services)
    {
        services.AddHttpClient();

        services.AddDbContext<VitalityNutriDbContext>((serviceProvider, options) =>
        {
            var apiConfiguration = serviceProvider.GetRequiredService<ApiConfiguration>();
            ValidateRuntimeConfiguration(apiConfiguration);

            var database = apiConfiguration.Database;
            var connectionString = apiConfiguration.ConnectionStrings.Default;
            if (string.Equals(database.Provider, DatabaseOptions.SqliteProvider, StringComparison.OrdinalIgnoreCase))
            {
                options.UseSqlite(connectionString, x => x.MigrationsAssembly("VitalityNutri.Migrations.Sqlite"));
                return;
            }

            options.UseMySQL(connectionString, x => x.MigrationsAssembly("VitalityNutri.Migrations.MySql"));
        });
        services.AddScoped<IPlanRepository, PlanRepository>();
        services.AddScoped<IGroceryListRepository, GroceryListRepository>();
        services.AddScoped<ICompletedRecipesRepository, CompletedRecipesRepository>();
        services.AddScoped<IIngredientRepository, IngredientRepository>();
        services.AddScoped<IRecipeRepository, RecipeRepository>();
        services.AddScoped<ISearchHistoryRepository, SearchHistoryRepository>();
        services.AddScoped<IBackupRepository, BackupRepository>();
        services.AddScoped<IBatchCookingRepository, BatchCookingRepository>();
        services.AddScoped<IUploadedPlanRepository, UploadedPlanRepository>();
        services.AddScoped<IUploadFileStorage, UploadFileStorage>();
        services.AddScoped<IPlanExtractionService, DeterministicPlanExtractionService>();
        services.AddScoped<IRecipeAiProcessingService, DeterministicRecipeAiProcessingService>();
        services.AddScoped<IRecipeImageLookupService, DeterministicRecipeImageLookupService>();
        services.AddScoped<IBatchCookingAiService, DeterministicBatchCookingAiService>();

        return services;
    }

    private static void ValidateRuntimeConfiguration(ApiConfiguration configuration)
    {
        if (!DatabaseProviderPolicy.IsAllowed(configuration.App.Mode, configuration.Database.Provider))
        {
            throw new InvalidOperationException("Invalid ApiConfiguration:App:Mode and ApiConfiguration:Database:Provider combination. SaaS requires MySql; OSS supports MySql or Sqlite.");
        }

        if (string.IsNullOrWhiteSpace(configuration.ConnectionStrings.Default))
        {
            throw new InvalidOperationException("ApiConfiguration:ConnectionStrings:Default is required.");
        }
    }
}
