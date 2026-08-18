using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.RateLimiting;
using NLog;
using NLog.Web;
using Scalar.AspNetCore;
using VitalityNutri.Api.Configuration;
using VitalityNutri.Api.Infrastructure;
using VitalityNutri.Application;
using VitalityNutri.Infrastructure;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Persistence;

var logger = LogManager.Setup().LoadConfigurationFromAppSettings().GetCurrentClassLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Logging & Observability
    builder.Logging.ClearProviders();
    builder.Host.UseNLog();

    var apiConfig = builder.Configuration.GetSection("ApiConfiguration").Get<ApiConfiguration>() ?? new ApiConfiguration();

    // Sentry integration
    var sentryDsn = apiConfig.Telemetry.Sentry.Dsn ?? builder.Configuration["Sentry:Dsn"];
    if (!builder.Environment.IsEnvironment("Testing") && !string.IsNullOrWhiteSpace(sentryDsn))
    {
        builder.WebHost.UseSentry(options =>
        {
            options.Dsn = sentryDsn;
            var sentryEnv = apiConfig.Telemetry.Sentry.Environment ?? builder.Configuration["Sentry:Environment"];
            if (!string.IsNullOrWhiteSpace(sentryEnv))
            {
                options.Environment = sentryEnv;
            }
            options.TracesSampleRate = 1.0;
            options.AutoSessionTracking = true;
            options.AddExceptionFilterForType<FluentValidation.ValidationException>();
        });
    }

    // Application Insights integration
    var appInsightsConn = apiConfig.Telemetry.ApplicationInsights.ConnectionString
        ?? builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"];
    if (!string.IsNullOrWhiteSpace(appInsightsConn))
    {
        builder.Services.AddApplicationInsightsTelemetry(options =>
        {
            options.ConnectionString = appInsightsConn;
        });
    }

    // Core API Services
    builder.Services.AddOpenApi();
    builder.Services.AddControllers();
    builder.Services.AddProblemDetails();
    builder.Services.AddExceptionHandler<ApiExceptionHandler>();
    builder.Services.AddValidatedConfiguration(builder.Configuration);
    builder.Services.AddApplication();
    builder.Services.AddInfrastructure();

    // EF Core Health Checks
    builder.Services.AddHealthChecks()
        .AddDbContextCheck<VitalityNutriDbContext>("database");

    // CORS Configuration
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            if (builder.Environment.IsDevelopment())
            {
                policy.SetIsOriginAllowed(_ => true)
                      .AllowAnyMethod()
                      .AllowAnyHeader()
                      .AllowCredentials();
            }
            else
            {
                var allowedOrigins = apiConfig.Security.AllowedCorsOrigins
                    .Split([';', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                if (allowedOrigins.Length > 0)
                {
                    policy.WithOrigins(allowedOrigins)
                          .AllowAnyMethod()
                          .AllowAnyHeader()
                          .AllowCredentials();
                }
                else
                {
                    policy.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                }
            }
        });
    });

    // Rate Limiting
    builder.Services.AddRateLimiter(limiterOptions =>
    {
        limiterOptions.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        if (builder.Environment.IsEnvironment("Testing"))
        {
            limiterOptions.AddPolicy("upload", _ => RateLimitPartition.GetNoLimiter("test"));
            limiterOptions.AddPolicy("batch-cooking", _ => RateLimitPartition.GetNoLimiter("test"));
            limiterOptions.AddPolicy("general-write", _ => RateLimitPartition.GetNoLimiter("test"));
            return;
        }

        limiterOptions.AddPolicy("upload", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 5,
                    Window = TimeSpan.FromMinutes(15),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0
                }));

        limiterOptions.AddPolicy("batch-cooking", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(5),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0
                }));

        limiterOptions.AddPolicy("general-write", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 30,
                    Window = TimeSpan.FromMinutes(1),
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit = 0
                }));
    });

    var app = builder.Build();

    // Auto-apply DB migrations and seed initial demo data
    await app.Services.ApplyDatabaseMigrationsAsync();
    await app.Services.SeedDemoDataAsync();

    // Exception handling & Security headers
    app.UseExceptionHandler();

    app.Use(async (context, next) =>
    {
        context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
        context.Response.Headers.Append("X-Frame-Options", "DENY");
        context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
        await next();
    });

    app.UseCors();
    app.UseRateLimiter();

    // Serve React SPA static assets from wwwroot
    app.UseDefaultFiles();
    app.UseStaticFiles();

    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.MapScalarApiReference(options =>
        {
            options.Title = "VitalityNutri API";
        });
    }

    if (app.Services.GetRequiredService<ApiConfiguration>().Security.UseHttpsRedirection)
    {
        app.UseHttpsRedirection();
    }

    app.MapHealthChecks("/health");
    app.MapControllers();
    app.MapFallbackToFile("index.html");

    await app.RunAsync();
}
catch (Exception exception)
{
    logger.Error(exception, "Stopped program because of an unhandled startup exception.");
    throw;
}
finally
{
    LogManager.Shutdown();
}

/// <summary>Exposes the entry point to integration tests.</summary>
public partial class Program;
