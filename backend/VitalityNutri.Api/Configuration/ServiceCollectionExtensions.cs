namespace VitalityNutri.Api.Configuration;
using VitalityNutri.Infrastructure.Configuration;

internal static class ServiceCollectionExtensions
{
	public static IServiceCollection AddValidatedConfiguration(this IServiceCollection services, IConfiguration configuration)
	{
		services.AddSingleton(serviceProvider =>
		{
			var runtimeConfiguration = serviceProvider.GetRequiredService<IConfiguration>();
			var fixedConfiguration = runtimeConfiguration.GetSection("ApiConfiguration").Get<ApiConfiguration>()
				?? new ApiConfiguration();

			ValidateConfiguration(fixedConfiguration);
			return fixedConfiguration;
		});

		return services;
	}

	private static void ValidateConfiguration(ApiConfiguration configuration)
	{
		if (!configuration.App.Mode.Equals("Oss", StringComparison.OrdinalIgnoreCase)
			&& !configuration.App.Mode.Equals("SaaS", StringComparison.OrdinalIgnoreCase))
		{
			throw new InvalidOperationException("ApiConfiguration:App:Mode must be Oss or SaaS.");
		}

		var isSaaS = configuration.App.Mode.Equals("SaaS", StringComparison.OrdinalIgnoreCase);
		if (isSaaS && !configuration.Ai.UseOmniRoute)
		{
			throw new InvalidOperationException("ApiConfiguration:Ai:UseOmniRoute must be true when ApiConfiguration:App:Mode is SaaS.");
		}

		if (isSaaS && string.IsNullOrWhiteSpace(configuration.Ai.OmniRoute.ApiKey))
		{
			throw new InvalidOperationException("ApiConfiguration:Ai:OmniRoute:ApiKey is required when ApiConfiguration:App:Mode is SaaS.");
		}

		if (isSaaS && string.IsNullOrWhiteSpace(configuration.Ai.Providers.Gemini.ApiKey))
		{
			throw new InvalidOperationException("ApiConfiguration:Ai:Providers:Gemini:ApiKey is required when ApiConfiguration:App:Mode is SaaS.");
		}

		if (configuration.Ai.UseOmniRoute && !Uri.TryCreate(configuration.Ai.OmniRoute.Url, UriKind.Absolute, out _))
		{
			throw new InvalidOperationException("ApiConfiguration:Ai:OmniRoute:Url must be absolute.");
		}

		ValidateFallbackChains(configuration.Ai.FallbackChains);

		if (isSaaS && string.IsNullOrWhiteSpace(configuration.Auth.JwtSecret))
		{
			throw new InvalidOperationException("ApiConfiguration:Auth:JwtSecret is required when ApiConfiguration:App:Mode is SaaS.");
		}

		if (string.IsNullOrWhiteSpace(configuration.ConnectionStrings.Default))
		{
			throw new InvalidOperationException("ApiConfiguration:ConnectionStrings:Default is required.");
		}
	}

	private static void ValidateFallbackChains(FallbackChainsConfiguration fallbackChains)
	{
		var chains = new (string PropertyName, string Value)[]
		{
			("PlanText", fallbackChains.PlanText),
			("PlanVision", fallbackChains.PlanVision),
			("BatchCooking", fallbackChains.BatchCooking),
			("RecipeAi", fallbackChains.RecipeAi),
			("RecipeVision", fallbackChains.RecipeVision),
			("Translation", fallbackChains.Translation),
		};

		foreach (var (propertyName, chain) in chains)
		{
			if (string.IsNullOrWhiteSpace(chain))
			{
				throw new InvalidOperationException(
					$"ApiConfiguration:Ai:FallbackChains:{propertyName} is required and must be configured in appsettings or environment variables with at least one '{AiFallbackChainFormat.RequiredPattern}' entry.");
			}

			var invalidEntries = AiFallbackChainFormat.GetInvalidEntries(chain);
			if (invalidEntries.Count > 0)
			{
				var supported = string.Join(", ", AiFallbackChainFormat.SupportedProviders);
				throw new InvalidOperationException(
					$"ApiConfiguration:Ai:FallbackChains:{propertyName} contains invalid entries [{string.Join(", ", invalidEntries)}]. Every entry must use the '{AiFallbackChainFormat.RequiredPattern}' pattern with a supported provider ({supported}).");
			}
		}
	}
}
