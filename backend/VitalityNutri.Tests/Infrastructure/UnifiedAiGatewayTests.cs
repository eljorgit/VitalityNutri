using System.Net;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing.Ai;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class UnifiedAiGatewayTests
{
    [Fact]
    public void CleanMarkdownCodeBlock_RemovesFences_Correctly()
    {
        var rawJson = "```json\n{\"test\": 123}\n```";
        var cleaned = UnifiedAiGateway.CleanMarkdownCodeBlock(rawJson);
        Assert.Equal("{\"test\": 123}", cleaned);

        var plain = "```\n{\"hello\": \"world\"}\n```";
        var cleanedPlain = UnifiedAiGateway.CleanMarkdownCodeBlock(plain);
        Assert.Equal("{\"hello\": \"world\"}", cleanedPlain);
    }

    [Fact]
    public async Task GenerateTextAsync_ReturnsNull_WhenNoCredentialsConfigured()
    {
        var config = new ApiConfiguration();
        var clientFactory = new TestHttpClientFactory(new MockHttpMessageHandler());
        var gateway = new UnifiedAiGateway(config, clientFactory, NullLogger<UnifiedAiGateway>.Instance);

        var result = await gateway.GenerateTextAsync(
            chainConfig: "groq:openai/gpt-oss-120b,gemini:gemini-3.6-flash",
            prompt: "Say hello",
            cancellationToken: CancellationToken.None);

        Assert.Null(result);
    }

    [Fact]
    public async Task GenerateTextAsync_FailsOverToSecondModel_WhenFirstModelReturns429()
    {
        var config = new ApiConfiguration
        {
            Ai = new AiConfiguration
            {
                Providers = new AiProvidersConfiguration
                {
                    Groq = new ProviderCredentialConfiguration { ApiKey = "mock_groq_key" }
                }
            }
        };

        var handler = new MockFailoverHttpMessageHandler();
        var clientFactory = new TestHttpClientFactory(handler);
        var gateway = new UnifiedAiGateway(config, clientFactory, NullLogger<UnifiedAiGateway>.Instance);

        var chain = "groq:openai/gpt-oss-120b,groq:openai/gpt-oss-20b";
        var result = await gateway.GenerateTextAsync(
            chainConfig: chain,
            prompt: "Test prompt",
            systemPrompt: null,
            jsonMode: true,
            cancellationToken: CancellationToken.None);

        Assert.NotNull(result);
        Assert.Contains("success_from_second_model", result);
        Assert.Equal(2, handler.RequestCount);
    }

    [Fact]
    public async Task GenerateTextAsync_AutoBypassesModel_WhenReportedModelNotFound()
    {
        var config = new ApiConfiguration
        {
            Ai = new AiConfiguration
            {
                Providers = new AiProvidersConfiguration
                {
                    Groq = new ProviderCredentialConfiguration { ApiKey = "mock_groq_key" }
                }
            }
        };

        var handler = new MockModelNotFoundHandler();
        var clientFactory = new TestHttpClientFactory(handler);
        var gateway = new UnifiedAiGateway(config, clientFactory, NullLogger<UnifiedAiGateway>.Instance);

        var chain = "groq:deprecated-model-xyz,groq:openai/gpt-oss-20b";

        // First call: model is called and returns 404 model_not_found, then fails over to second model
        var result1 = await gateway.GenerateTextAsync(chain, "prompt", cancellationToken: CancellationToken.None);
        Assert.NotNull(result1);
        Assert.Equal(2, handler.RequestCount);

        // Second call: first model is already marked as decommissioned in-memory, so it is skipped immediately
        var result2 = await gateway.GenerateTextAsync(chain, "prompt", cancellationToken: CancellationToken.None);
        Assert.NotNull(result2);
        Assert.Equal(3, handler.RequestCount); // Only 1 additional request made instead of 2
    }

    private sealed class MockModelNotFoundHandler : HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;

            var requestBody = request.Content?.ReadAsStringAsync(cancellationToken).Result ?? string.Empty;
            if (requestBody.Contains("deprecated-model-xyz"))
            {
                var errorResponse = new HttpResponseMessage(HttpStatusCode.NotFound)
                {
                    Content = new StringContent("{\"error\": {\"message\": \"The model `deprecated-model-xyz` does not exist or you do not have access to it.\", \"type\": \"invalid_request_error\", \"code\": \"model_not_found\"}}", Encoding.UTF8, "application/json")
                };
                return Task.FromResult(errorResponse);
            }

            var successResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""
                {
                  "choices": [
                    {
                      "message": {
                        "content": "{\"status\": \"ok\"}"
                      }
                    }
                  ]
                }
                """, Encoding.UTF8, "application/json")
            };
            return Task.FromResult(successResponse);
        }
    }

    private sealed class MockFailoverHttpMessageHandler : HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;

            if (RequestCount == 1)
            {
                // First model call fails with 429 Too Many Requests
                var errorResponse = new HttpResponseMessage(HttpStatusCode.TooManyRequests)
                {
                    Content = new StringContent("{\"error\": {\"message\": \"Rate limit reached\"}}", Encoding.UTF8, "application/json")
                };
                return Task.FromResult(errorResponse);
            }

            // Second model call succeeds
            var successResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""
                {
                  "choices": [
                    {
                      "message": {
                        "content": "{\"status\": \"success_from_second_model\"}"
                      }
                    }
                  ]
                }
                """, Encoding.UTF8, "application/json")
            };
            return Task.FromResult(successResponse);
        }
    }

    private sealed class MockHttpMessageHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }
    }

    private sealed class TestHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }
}
