using Microsoft.Extensions.Logging.Abstractions;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Processing;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class DeterministicRecipeImageLookupServiceTests
{
    private readonly DeterministicRecipeImageLookupService service;

    public DeterministicRecipeImageLookupServiceTests()
    {
        var config = new ApiConfiguration();
        var httpClientFactory = new StubHttpClientFactory();
        service = new DeterministicRecipeImageLookupService(config, httpClientFactory, NullLogger<DeterministicRecipeImageLookupService>.Instance);
    }

    [Theory]
    [InlineData("Porridge de avena con frutos rojos", "breakfast", "photo-1517881917430-e70dfb3610aa")]
    [InlineData("Espaguetis boloñesa con verduras", "lunch", "photo-1546549032-9571cd6b27df")]
    [InlineData("Ensalada César con pollo", "lunch", "photo-1512621776951-a57141f2eefd")]
    [InlineData("Tostada de aguacate y huevo poché", "breakfast", "photo-1541532713592-79a0317b6b77")]
    [InlineData("Salmón a la plancha con espárragos", "dinner", "photo-1467003909585-2f8a72700288")]
    [InlineData("Hummus con crudités", "snack", "photo-1541518763669-27fef04b14ea")]
    [InlineData("Batido de plátano y proteínas", "snack", "photo-1553530666-ba11a7da3888")]
    public async Task ResolveContextualImageAsync_MatchesFoodCategoryKeywords(string recipeName, string mealType, string expectedUnsplashPhotoId)
    {
        var imageUrl = await service.ResolveContextualImageAsync(recipeName, mealType, CancellationToken.None);

        Assert.False(string.IsNullOrWhiteSpace(imageUrl));
        Assert.Contains(expectedUnsplashPhotoId, imageUrl);
    }

    [Theory]
    [InlineData("breakfast", "photo-1496042399014-dc73c4f2bde1")]
    [InlineData("lunch", "photo-1546069901-ba9599a7e63c")]
    [InlineData("snack", "photo-1505253716362-afaea1d3d1af")]
    [InlineData("dinner", "photo-1498837167922-ddd27525d352")]
    public async Task ResolveContextualImageAsync_FallsBackToMealType_WhenNoKeywordMatches(string mealType, string expectedUnsplashPhotoId)
    {
        var imageUrl = await service.ResolveContextualImageAsync("Plato desconocido xyz", mealType, CancellationToken.None);

        Assert.False(string.IsNullOrWhiteSpace(imageUrl));
        Assert.Contains(expectedUnsplashPhotoId, imageUrl);
    }

    [Fact]
    public async Task ResolveReplacementImageAsync_ExcludesGivenUrls()
    {
        var excluded = new[]
        {
            "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop"
        };

        var replacement = await service.ResolveReplacementImageAsync("Salmón al horno", "dinner", excluded, CancellationToken.None);

        Assert.False(string.IsNullOrWhiteSpace(replacement));
        Assert.DoesNotContain(excluded[0], replacement);
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new();
    }
}
