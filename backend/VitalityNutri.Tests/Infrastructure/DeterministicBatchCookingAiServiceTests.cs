using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using VitalityNutri.Application.BatchCooking;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class DeterministicBatchCookingAiServiceTests
{
    private readonly DeterministicBatchCookingAiService service;

    public DeterministicBatchCookingAiServiceTests()
    {
        var config = new ApiConfiguration();
        var httpClientFactory = new StubHttpClientFactory();
        service = new DeterministicBatchCookingAiService(config, httpClientFactory, NullLogger<DeterministicBatchCookingAiService>.Instance);
    }

    [Fact]
    public async Task GenerateGuideAsync_ReturnsValidDeterministicGuide_WhenAiNotConfigured()
    {
        var planJson = """
        {
          "days": {
            "monday": {
              "lunch": { "id": 101, "recipeName": "Arroz con pollo", "ingredients": [{ "name": "Arroz" }, { "name": "Pollo" }] },
              "dinner": { "id": 102, "recipeName": "Crema de calabacín", "ingredients": [{ "name": "Calabacín" }] }
            },
            "tuesday": {
              "lunch": { "id": 103, "recipeName": "Salmón al horno", "ingredients": [{ "name": "Salmón" }] },
              "dinner": { "id": 104, "recipeName": "Ensalada mixta", "ingredients": [{ "name": "Lechuga" }] }
            }
          }
        }
        """;

        var parameters = new BatchCookingParams(
            BurnersCount: 4,
            HasOven: true,
            HasMicrowave: true,
            HasAirfryer: false,
            HasRobot: false,
            CustomTools: "Mandolina");

        var guide = await service.GenerateGuideAsync(planJson, parameters, "es", CancellationToken.None);

        Assert.True(guide.TryGetProperty("steps", out var stepsElement));
        Assert.Equal(JsonValueKind.Array, stepsElement.ValueKind);
        Assert.True(stepsElement.GetArrayLength() >= 4);

        // Verify storage tips
        Assert.True(guide.TryGetProperty("storageTips", out var storageTips));
        Assert.Equal(JsonValueKind.Array, storageTips.ValueKind);
        Assert.True(storageTips.GetArrayLength() > 0);

        // Verify first step has linked recipe ID
        var firstStep = stepsElement[0];
        Assert.True(firstStep.TryGetProperty("recipesAffected", out var recipesAffected));
        Assert.Equal(JsonValueKind.Array, recipesAffected.ValueKind);
        var firstAffected = recipesAffected[0];
        Assert.Equal(101L, firstAffected.GetProperty("id").GetInt64());
        Assert.Equal("Arroz con pollo", firstAffected.GetProperty("name").GetString());
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }
}
