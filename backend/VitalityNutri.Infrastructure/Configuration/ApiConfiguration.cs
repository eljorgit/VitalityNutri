namespace VitalityNutri.Infrastructure.Configuration;

public sealed class ApiConfiguration
{
    public AppConfiguration App { get; init; } = new();
    public DatabaseOptions Database { get; init; } = new();
    public ConnectionStringsConfiguration ConnectionStrings { get; init; } = new();
    public SecurityConfiguration Security { get; init; } = new();
    public AiConfiguration Ai { get; init; } = new();
    public ExternalServicesConfiguration ExternalServices { get; init; } = new();
    public TelemetryConfiguration Telemetry { get; init; } = new();
}

public sealed class AppConfiguration
{
    public string Mode { get; init; } = "Oss";
}

public sealed class ConnectionStringsConfiguration
{
    public string Default { get; init; } = string.Empty;
}

public sealed class SecurityConfiguration
{
    public bool UseHttpsRedirection { get; init; }
    public string AllowedCorsOrigins { get; init; } = string.Empty;
}

public sealed class TelemetryConfiguration
{
    public ApplicationInsightsConfiguration ApplicationInsights { get; init; } = new();
    public SentryConfiguration Sentry { get; init; } = new();
}

public sealed class ApplicationInsightsConfiguration
{
    public string? ConnectionString { get; init; }
}

public sealed class SentryConfiguration
{
    public string? Dsn { get; init; }
    public string? Environment { get; init; }
}

public sealed class AiConfiguration
{
    public bool UseOmniRoute { get; init; }
    public OmniRouteConfiguration OmniRoute { get; init; } = new();
    public PdfConfiguration Pdf { get; init; } = new();
    public FallbackChainsConfiguration FallbackChains { get; init; } = new();
    public AiProvidersConfiguration Providers { get; init; } = new();
    public AiModelsConfiguration Models { get; init; } = new();
}

public sealed class OmniRouteConfiguration
{
    public string Url { get; init; } = string.Empty;
    public string? ApiKey { get; init; }
}

public sealed class PdfConfiguration
{
    public int SelectableTextThreshold { get; init; } = 100;
}

public sealed class FallbackChainsConfiguration
{
    public string Text { get; init; } = string.Empty;
    public string Vision { get; init; } = string.Empty;
}

public sealed class AiProvidersConfiguration
{
    public ProviderCredentialConfiguration Groq { get; init; } = new();
    public GeminiProviderConfiguration Gemini { get; init; } = new();
}

public sealed class ProviderCredentialConfiguration
{
    public string? ApiKey { get; init; }
}

public sealed class GeminiProviderConfiguration
{
    public string? ApiKey { get; init; }
    public int TimeoutSeconds { get; init; } = 300;
}

public sealed class AiModelsConfiguration
{
    public string PdfText { get; init; } = "nutri-pdf-text";
    public string PdfVision { get; init; } = "nutri-pdf-vision";
    public string BatchCooking { get; init; } = "nutri-batch";
    public string RecipeAi { get; init; } = "nutri-recipe";
    public string Chat { get; init; } = "nutri-chat";
}

public sealed class ExternalServicesConfiguration
{
    public UnsplashConfiguration Unsplash { get; init; } = new();
}

public sealed class UnsplashConfiguration
{
    public string? AccessKey { get; init; }
}
