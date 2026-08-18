using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace VitalityNutri.Tests.Api;

public sealed class ModeAiConfigurationGuardTests
{
    [Fact]
    public void SaaSMode_WithoutOmniRouteKey_FailsOnStartup()
    {
        using var factory = new ConfiguredApiFactory(new Dictionary<string, string?>
        {
            ["ApiConfiguration:App:Mode"] = "SaaS",
            ["ApiConfiguration:Database:Provider"] = "MySql",
            ["ApiConfiguration:Database:ApplyMigrations"] = "false",
            ["ApiConfiguration:Ai:UseOmniRoute"] = "true",
            ["ApiConfiguration:Ai:OmniRoute:Url"] = "http://omniroute:20128/v1",
            ["ApiConfiguration:Ai:OmniRoute:ApiKey"] = ""
        });

        var exception = Assert.ThrowsAny<Exception>(() => factory.CreateClient());
        Assert.Contains("ApiConfiguration:Ai:OmniRoute:ApiKey is required when ApiConfiguration:App:Mode is SaaS", exception.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task SaaSMode_WithOmniRouteKey_StartsAndServesHealth()
    {
        using var factory = new ConfiguredApiFactory(new Dictionary<string, string?>
        {
            ["ApiConfiguration:App:Mode"] = "SaaS",
            ["ApiConfiguration:Database:Provider"] = "MySql",
            ["ApiConfiguration:Database:ApplyMigrations"] = "false",
            ["ApiConfiguration:Ai:UseOmniRoute"] = "true",
            ["ApiConfiguration:Ai:OmniRoute:Url"] = "http://omniroute:20128/v1",
            ["ApiConfiguration:Ai:OmniRoute:ApiKey"] = "test-key"
        });

        using var client = factory.CreateClient();
        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task OssMode_AllowsDirectByokWithoutOmniRouteKey()
    {
        using var factory = new ConfiguredApiFactory(new Dictionary<string, string?>
        {
            ["ApiConfiguration:App:Mode"] = "Oss",
            ["ApiConfiguration:Ai:UseOmniRoute"] = "false",
            ["ApiConfiguration:Ai:OmniRoute:ApiKey"] = ""
        });

        using var client = factory.CreateClient();
        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed class ConfiguredApiFactory(IReadOnlyDictionary<string, string?> values)
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureAppConfiguration((_, configBuilder) =>
            {
                var baseline = new Dictionary<string, string?>
                {
                    ["ApiConfiguration:App:Mode"] = "Oss",
                    ["ApiConfiguration:Database:Provider"] = "Sqlite",
                    ["ApiConfiguration:Database:ApplyMigrations"] = "false",
                    ["ApiConfiguration:ConnectionStrings:Default"] = "Data Source=:memory:",
                    ["ApiConfiguration:Security:UseHttpsRedirection"] = "false",
                    ["ApiConfiguration:Ai:UseOmniRoute"] = "false",
                    ["ApiConfiguration:Ai:OmniRoute:Url"] = "http://omniroute:20128/v1",
                    ["ApiConfiguration:Ai:OmniRoute:ApiKey"] = ""
                };

                foreach (var pair in values)
                {
                    baseline[pair.Key] = pair.Value;
                }

                configBuilder.Sources.Clear();
                configBuilder.AddInMemoryCollection(baseline);
            });
        }
    }
}
