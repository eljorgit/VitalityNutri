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

		if (configuration.Ai.UseOmniRoute && !Uri.TryCreate(configuration.Ai.OmniRoute.Url, UriKind.Absolute, out _))
		{
			throw new InvalidOperationException("ApiConfiguration:Ai:OmniRoute:Url must be absolute.");
		}

		if (string.IsNullOrWhiteSpace(configuration.ConnectionStrings.Default))
		{
			throw new InvalidOperationException("ApiConfiguration:ConnectionStrings:Default is required.");
		}
	}
}
