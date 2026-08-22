using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing;
using VitalityNutri.Infrastructure.Processing.Ai;
using Xunit;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class DeterministicTranslationServiceTests
{
    [Fact]
    public async Task TranslatePlanJsonAsync_PerformsLeanExtractionAndRecombination_WithSectionObjects()
    {
        var planJson = """
        {
          "days": {
            "friday": {
              "lunch": {
                "id": 12,
                "tag": "Comida",
                "recipeName": "Dorada con guarnición hervida",
                "tips": "Sazonar las verduras con hierbas.",
                "calories": 400,
                "ingredients": {
                  "primerPlato": [
                    { "name": "dorada", "unit": "unidad", "originalAmount": 1 },
                    { "name": "judías verdes", "unit": "ración", "originalAmount": 1 }
                  ],
                  "postre": [
                    { "name": "kiwi", "unit": "unidad", "originalAmount": 2 }
                  ]
                },
                "steps": {
                  "primerPlato": [
                    "1. Trocea la patata."
                  ],
                  "postre": [
                    "1. Pela y trocea los dos kiwis frescos."
                  ]
                }
              }
            }
          }
        }
        """;

        var aiGatewayStub = new PlanAiGatewayStub();
        var config = new ApiConfiguration();
        var service = new DeterministicTranslationService(config, aiGatewayStub, NullLogger<DeterministicTranslationService>.Instance);

        var resultJson = await service.TranslatePlanJsonAsync(planJson, "es", "en", CancellationToken.None);

        Assert.NotNull(resultJson);
        using var doc = JsonDocument.Parse(resultJson);
        var lunch = doc.RootElement.GetProperty("days").GetProperty("friday").GetProperty("lunch");

        // Verify translated text fields
        Assert.Equal("Sea Bream with Boiled Side", lunch.GetProperty("recipeName").GetString());
        Assert.Equal("Lunch", lunch.GetProperty("tag").GetString());
        Assert.Equal("Season vegetables with herbs.", lunch.GetProperty("tips").GetString());

        // Verify section-grouped ingredients
        var primerIngs = lunch.GetProperty("ingredients").GetProperty("primerPlato");
        Assert.Equal("sea bream", primerIngs[0].GetProperty("name").GetString());
        Assert.Equal("unit", primerIngs[0].GetProperty("unit").GetString());
        Assert.Equal(1, primerIngs[0].GetProperty("originalAmount").GetInt32());

        Assert.Equal("green beans", primerIngs[1].GetProperty("name").GetString());
        Assert.Equal("serving", primerIngs[1].GetProperty("unit").GetString());

        var postreIngs = lunch.GetProperty("ingredients").GetProperty("postre");
        Assert.Equal("kiwi", postreIngs[0].GetProperty("name").GetString());
        Assert.Equal("unit", postreIngs[0].GetProperty("unit").GetString());

        // Verify section-grouped steps
        var primerSteps = lunch.GetProperty("steps").GetProperty("primerPlato");
        Assert.Equal("1. Chop the potato.", primerSteps[0].GetString());

        var postreSteps = lunch.GetProperty("steps").GetProperty("postre");
        Assert.Equal("1. Peel and slice the kiwis.", postreSteps[0].GetString());

        // Verify calories untouched
        Assert.Equal(400, lunch.GetProperty("calories").GetInt32());
    }

    [Fact]
    public async Task TranslatePlanJsonAsync_HandlesObjectWrappedResponse()
    {
        var planJson = """
        {
          "days": {
            "monday": {
              "breakfast": {
                "recipeName": "Tostada con tomate",
                "tag": "Desayuno",
                "tips": "Usar buen aceite.",
                "ingredients": [
                  { "name": "pan", "unit": "rebanada" }
                ],
                "steps": [
                  "Tostar el pan."
                ]
              }
            }
          }
        }
        """;

        var aiGatewayStub = new ObjectWrappedAiGatewayStub();
        var config = new ApiConfiguration();
        var service = new DeterministicTranslationService(config, aiGatewayStub, NullLogger<DeterministicTranslationService>.Instance);

        var resultJson = await service.TranslatePlanJsonAsync(planJson, "es", "en", CancellationToken.None);

        Assert.NotNull(resultJson);
        using var doc = JsonDocument.Parse(resultJson);
        var breakfast = doc.RootElement.GetProperty("days").GetProperty("monday").GetProperty("breakfast");

        Assert.Equal("Toast with Tomato", breakfast.GetProperty("recipeName").GetString());
        Assert.Equal("Breakfast", breakfast.GetProperty("tag").GetString());
    }

    private sealed class ObjectWrappedAiGatewayStub : IUnifiedAiGateway
    {
        public Task<string?> GenerateTextAsync(
            string chainConfig,
            string prompt,
            string? systemPrompt = null,
            bool jsonMode = true,
            float temperature = 0.2F,
            CancellationToken cancellationToken = default)
        {
            var response = """
            {
              "items": [
                {
                  "id": "monday_breakfast",
                  "name": "Toast with Tomato",
                  "tag": "Breakfast",
                  "tips": "Use good olive oil.",
                  "ingredients": {
                    "general": [
                      { "name": "bread", "unit": "slice" }
                    ]
                  },
                  "steps": {
                    "general": [
                      "Toast the bread."
                    ]
                  }
                }
              ]
            }
            """;
            return Task.FromResult<string?>(response);
        }

        public Task<string?> GenerateMultimodalAsync(string chainConfig, string prompt, byte[] fileBytes, string mimeType, float temperature = 0.2F, CancellationToken cancellationToken = default) => Task.FromResult<string?>(null);
        public async IAsyncEnumerable<string> StreamTextAsync(string chainConfig, string prompt, string? systemPrompt = null, bool jsonMode = true, float temperature = 0.2F, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default) { await Task.CompletedTask; yield break; }
        public async IAsyncEnumerable<string> StreamMultimodalAsync(string chainConfig, string prompt, byte[] fileBytes, string mimeType, float temperature = 0.2F, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default) { await Task.CompletedTask; yield break; }
    }

    private sealed class PlanAiGatewayStub : IUnifiedAiGateway
    {
        public string LastPrompt { get; private set; } = string.Empty;

        public Task<string?> GenerateTextAsync(
            string chainConfig,
            string prompt,
            string? systemPrompt = null,
            bool jsonMode = true,
            float temperature = 0.2F,
            CancellationToken cancellationToken = default)
        {
            LastPrompt = prompt;
            var response = """
            [
              {
                "id": "friday_lunch",
                "name": "Sea Bream with Boiled Side",
                "tag": "Lunch",
                "tips": "Season vegetables with herbs.",
                "nutritionistTips": null,
                "ingredients": {
                  "primerPlato": [
                    { "name": "sea bream", "unit": "unit" },
                    { "name": "green beans", "unit": "serving" }
                  ],
                  "postre": [
                    { "name": "kiwi", "unit": "unit" }
                  ]
                },
                "steps": {
                  "primerPlato": [
                    "1. Chop the potato."
                  ],
                  "postre": [
                    "1. Peel and slice the kiwis."
                  ]
                }
              }
            ]
            """;
            return Task.FromResult<string?>(response);
        }

        public Task<string?> GenerateMultimodalAsync(
            string chainConfig,
            string prompt,
            byte[] fileBytes,
            string mimeType,
            float temperature = 0.2F,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<string?>(null);
        }

        public async IAsyncEnumerable<string> StreamTextAsync(
            string chainConfig,
            string prompt,
            string? systemPrompt = null,
            bool jsonMode = true,
            float temperature = 0.2F,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            await Task.CompletedTask;
            yield break;
        }

        public async IAsyncEnumerable<string> StreamMultimodalAsync(
            string chainConfig,
            string prompt,
            byte[] fileBytes,
            string mimeType,
            float temperature = 0.2F,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            await Task.CompletedTask;
            yield break;
        }
    }
}
