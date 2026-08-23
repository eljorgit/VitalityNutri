using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Notifications;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Abstractions.Security;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Notifications;
using VitalityNutri.Infrastructure.Persistence;
using VitalityNutri.Infrastructure.Persistence.Repositories;
using VitalityNutri.Infrastructure.Processing;
using VitalityNutri.Infrastructure.Processing.Ai;
using VitalityNutri.Infrastructure.Security;

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
        services.AddScoped<IUserRepository, EfUserRepository>();
        services.AddScoped<IUserVerificationTokenRepository, EfUserVerificationTokenRepository>();
        services.AddScoped<IAiUsageLedgerRepository, EfAiUsageLedgerRepository>();
        services.AddScoped<IUserAiSettingsRepository, EfUserAiSettingsRepository>();
        services.AddSingleton<IApiKeyProtector, AesGcmApiKeyProtector>();
        services.AddSingleton<IAiCreditLimits, ConfigAiCreditLimits>();
        services.AddSingleton<IAppLinksProvider, ConfigAppLinksProvider>();
        services.AddScoped<IAiProviderCatalog, AiProviderCatalog>();
        services.AddScoped<IByokCredentialResolver, ByokCredentialResolver>();
        services.AddSingleton<IByokProviderRegistry>(serviceProvider => new ByokProviderRegistry(
        [
            new GeminiByokProviderAdapter(serviceProvider.GetRequiredService<IHttpClientFactory>()),
            new OpenAiCompatibleByokProviderAdapter(serviceProvider.GetRequiredService<IHttpClientFactory>(), "openai", "https://api.openai.com/v1", true),
            new OpenAiCompatibleByokProviderAdapter(serviceProvider.GetRequiredService<IHttpClientFactory>(), "groq", "https://api.groq.com/openai/v1", false),
            new OpenAiCompatibleByokProviderAdapter(serviceProvider.GetRequiredService<IHttpClientFactory>(), "openrouter", "https://openrouter.ai/api/v1", true),
            new OpenAiCompatibleByokProviderAdapter(serviceProvider.GetRequiredService<IHttpClientFactory>(), "openai-compatible", null, true),
            new AnthropicByokProviderAdapter(serviceProvider.GetRequiredService<IHttpClientFactory>())
        ]));
        services.AddScoped<IEmailSender, MailKitEmailSender>();
        services.AddScoped<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IGoogleAuthValidator, GoogleAuthValidator>();
        services.AddScoped<IAppleAuthValidator, AppleAuthValidator>();
        services.AddScoped<IDemoSeeder, DemoSeeder>();
        services.AddScoped<IPlanRepository, PlanRepository>();
        services.AddScoped<IGroceryListRepository, GroceryListRepository>();
        services.AddScoped<ICompletedRecipesRepository, CompletedRecipesRepository>();
        services.AddScoped<IIngredientRepository, IngredientRepository>();
        services.AddScoped<IRecipeRepository, RecipeRepository>();
        services.AddScoped<ISearchHistoryRepository, SearchHistoryRepository>();
        services.AddScoped<IBackupRepository, BackupRepository>();
        services.AddScoped<IBatchCookingRepository, BatchCookingRepository>();
        services.AddScoped<IUploadedPlanRepository, UploadedPlanRepository>();
        services.AddScoped<IRecipeTranslationRepository, RecipeTranslationRepository>();
        services.AddScoped<IPlanTranslationRepository, PlanTranslationRepository>();
        services.AddScoped<IUploadFileStorage, UploadFileStorage>();
        services.AddScoped<UnifiedAiGateway>();
        services.AddScoped<AiCreditsGatewayDecorator>();
        services.AddScoped<IUnifiedAiGateway>(serviceProvider =>
            serviceProvider.GetRequiredService<AiCreditsGatewayDecorator>());
        services.AddSingleton<IAiPayloadCompressionService, AiPayloadCompressionService>();
        services.AddScoped<IPlanExtractionService, DeterministicPlanExtractionService>();
        services.AddScoped<IRecipeAiProcessingService, DeterministicRecipeAiProcessingService>();
        services.AddScoped<IRecipeImageLookupService, DeterministicRecipeImageLookupService>();
        services.AddScoped<IBatchCookingAiService, DeterministicBatchCookingAiService>();
        services.AddScoped<ITextTranslationService, DeterministicTranslationService>();

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
