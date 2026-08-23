namespace VitalityNutri.Infrastructure.Configuration;

public sealed class ApiConfiguration
{
    public AppConfiguration App { get; init; } = new();
    public DatabaseOptions Database { get; init; } = new();
    public ConnectionStringsConfiguration ConnectionStrings { get; init; } = new();
    public SecurityConfiguration Security { get; init; } = new();
    public AuthConfiguration Auth { get; init; } = new();
    public UploadConfiguration Upload { get; init; } = new();
    public AiConfiguration Ai { get; init; } = new();
    public EmailConfiguration Email { get; init; } = new();
    public ExternalServicesConfiguration ExternalServices { get; init; } = new();
    public TelemetryConfiguration Telemetry { get; init; } = new();
}

public sealed class EmailConfiguration
{
    public bool Enabled { get; init; }

    public SmtpConfiguration Smtp { get; init; } = new();

    public EmailFromConfiguration From { get; init; } = new();

    public EmailLinksConfiguration Links { get; init; } = new();
}

public sealed class SmtpConfiguration
{
    public string Host { get; init; } = string.Empty;
    public int Port { get; init; } = 587;
    public string? Username { get; init; }
    public string? Password { get; init; }
    public bool UseStartTls { get; init; } = true;
}

public sealed class EmailFromConfiguration
{
    public string Address { get; init; } = "no-reply@vitalitynutri.com";
    public string Name { get; init; } = "VitalityNutri";
}

public sealed class EmailLinksConfiguration
{
    public string PublicBaseUrl { get; init; } = string.Empty;
}

public sealed class UploadConfiguration
{
    public int MaxFileSizeMb { get; init; } = 15;
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
    public AiCreditsConfiguration Credits { get; init; } = new();
}

public sealed class AiCreditsConfiguration
{
    public decimal WeeklyPlatformLimit { get; init; } = 10m;
}

public sealed class OmniRouteConfiguration
{
    public string Url { get; init; } = string.Empty;
    public string? ApiKey { get; init; }
}

public sealed class PdfConfiguration
{
    public int SelectableTextThreshold { get; init; } = 100;
    public int MaxVisionImageDimension { get; init; } = 1600;
    public int VisionJpegQuality { get; init; } = 70;
    public int MinCompressionBytes { get; init; } = 262144;
}

public sealed class FallbackChainsConfiguration
{
    public string PlanText { get; init; } = "openai:gpt-5-mini,anthropic:claude-sonnet-4-5,omniroute:strict-json";
    public string PlanVision { get; init; } = "anthropic:claude-sonnet-4-5,openai:gpt-5-mini,omniroute:vision-multimodal,gemini:gemini-3.5-flash-lite,gemini:gemini-3.1-flash-lite,gemini:gemini-3.7-flash,gemini:gemini-3.6-flash,gemini:gemini-3.5-flash";
    public string BatchCooking { get; init; } = "openai:gpt-5-mini,anthropic:claude-sonnet-4-5,omniroute:strict-json";
    public string RecipeAi { get; init; } = "openai:gpt-5-mini,anthropic:claude-sonnet-4-5,omniroute:strict-json";
    public string RecipeVision { get; init; } = "anthropic:claude-sonnet-4-5,openai:gpt-5-mini,omniroute:vision-multimodal,gemini:gemini-3.5-flash-lite,gemini:gemini-3.1-flash-lite,gemini:gemini-3.7-flash,gemini:gemini-3.6-flash,gemini:gemini-3.5-flash";
    public string Translation { get; init; } = "openai:gpt-5-mini,omniroute:light-free";
}

public sealed class AiProvidersConfiguration
{
    public ProviderCredentialConfiguration Groq { get; init; } = new();
    public GeminiProviderConfiguration Gemini { get; init; } = new();
    public AnthropicProviderConfiguration Anthropic { get; init; } = new();
    public OpenAiProviderConfiguration OpenAi { get; init; } = new();
    public OpenRouterProviderConfiguration OpenRouter { get; init; } = new();
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

public sealed class AnthropicProviderConfiguration
{
    public string? ApiKey { get; init; }
    public int TimeoutSeconds { get; init; } = 300;
    public int MaxTokens { get; init; } = 8192;
}

public sealed class OpenAiProviderConfiguration
{
    public string? ApiKey { get; init; }
    public int TimeoutSeconds { get; init; } = 300;
}

public sealed class OpenRouterProviderConfiguration
{
    public string? ApiKey { get; init; }
    public string Url { get; init; } = "https://openrouter.ai/api/v1";
    public int TimeoutSeconds { get; init; } = 300;
}

public sealed class ExternalServicesConfiguration
{
    public UnsplashConfiguration Unsplash { get; init; } = new();
}

public sealed class UnsplashConfiguration
{
    public string? AccessKey { get; init; }
}

public sealed class AuthConfiguration
{
    public string JwtSecret { get; init; } = "VitalityNutri_Dev_Default_Jwt_Secret_Salt_Key_2026_Minimum_64_Chars_Long!!";
    public string Issuer { get; init; } = "VitalityNutri";
    public string Audience { get; init; } = "VitalityNutriApp";
    public int ExpirationMinutes { get; init; } = 1440; // 24 hours
    public GoogleAuthConfiguration Google { get; init; } = new();
    public AppleAuthConfiguration Apple { get; init; } = new();
}

public sealed class GoogleAuthConfiguration
{
    public bool Enabled { get; init; }
    public string? ClientId { get; init; }
}

public sealed class AppleAuthConfiguration
{
    public bool Enabled { get; init; }
    public string? ClientId { get; init; }
    public string? TeamId { get; init; }
    public string? KeyId { get; init; }
}

