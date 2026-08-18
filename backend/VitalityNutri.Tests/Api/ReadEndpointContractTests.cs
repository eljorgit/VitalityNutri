using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using System.Text.Json;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Domain.Entities;
namespace VitalityNutri.Tests.Api;
public sealed class ReadEndpointContractTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private readonly HttpClient client = factory.CreateClient();
    [Theory]
    [InlineData("/health")]
    [InlineData("/api/plan")]
    [InlineData("/api/history")]
    [InlineData("/api/grocery-list")]
    [InlineData("/api/completed-recipes")]
    [InlineData("/api/ingredients")]
    [InlineData("/api/recipes")]
    [InlineData("/api/recipes/tags")]
    [InlineData("/api/recipes/favorite-status")]
    [InlineData("/api/all-recipes")]
    [InlineData("/api/search-history")]
    [InlineData("/api/backup/export")]
    [InlineData("/api/plan/batch-cooking")]
    [InlineData("/api/test-sentry")]
    public async Task Reads_ReturnOk(string path) => Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(path)).StatusCode);
    [Fact] public async Task MissingPlan_Returns404() => Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/plan/999")).StatusCode);
    [Fact] public async Task InvalidPlan_Returns400() => Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/plan/0")).StatusCode);

    [Fact] public async Task PlanReset_ReturnsSuccess() =>
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/plan/reset", null)).StatusCode);

    [Fact] public async Task MissingHistoryRestore_Returns404() =>
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync("/api/history/restore/999", null)).StatusCode);

    [Fact] public async Task MissingHistoryDelete_Returns404() =>
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync("/api/history/999")).StatusCode);

    [Fact]
    public async Task IngredientPost_ReturnsSuccess()
    {
        var response = await client.PostAsJsonAsync("/api/ingredients", new { name = "Apple", category = "Fruit" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task InvalidIngredient_Returns400()
    {
        var response = await client.PostAsJsonAsync("/api/ingredients", new { name = "", category = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GroceryList_PostReturnsSuccess()
    {
        var response = await client.PostAsJsonAsync("/api/grocery-list", new
        {
            checkedItems = new { apples = true }, listType = "semanal",
            selectedSingleDay = "", selected3DaysStart = "", excludedMeals = Array.Empty<string>(),
            multipliers = new { global = 1 }
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task CompletedRecipes_PostReturnsSuccess()
    {
        var response = await client.PostAsJsonAsync("/api/completed-recipes", new
        {
            completedRecipes = new { monday_breakfast = true }
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RecipeCrud_PreservesLegacyStatuses()
    {
        var invalid = await client.PostAsJsonAsync("/api/recipes", new { recipeName = "", ingredients = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var created = await client.PostAsJsonAsync("/api/recipes", new
        {
            recipeName = "Soup", ingredients = new[] { new { name = "Carrot", category = "Produce" } }
        });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        Assert.Equal(42, (await created.Content.ReadFromJsonAsync<RecipeCreatedContract>())?.Id);

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/recipes/999")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsync("/api/recipes/999/toggle-favorite", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("/api/recipes/999")).StatusCode);
    }

    [Fact]
    public async Task ProcessRecipeAi_InvalidPayload_Returns400()
    {
        var response = await client.PostAsJsonAsync("/api/recipes/process-ai", new
        {
            sourceType = "image",
            fileData = ""
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ProcessRecipeAi_Text_ReturnsSuccessEnvelope()
    {
        var response = await client.PostAsJsonAsync("/api/recipes/process-ai", new
        {
            sourceType = "text",
            textData = "Tortilla francesa con ensalada",
            optionsCount = 2,
            extraPrompt = "Sin lactosa"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ProcessAiResponseContract>();
        Assert.NotNull(payload);
        Assert.True(payload!.Success);
        Assert.NotNull(payload.Options);
        Assert.True(payload.Options.Count >= 1);
    }

    [Fact]
    public async Task ProcessRecipeAi_DeduplicatesRepeatedOptions()
    {
        var response = await client.PostAsJsonAsync("/api/recipes/process-ai", new
        {
            sourceType = "text",
            textData = "tortilla",
            optionsCount = 4,
            extraPrompt = "dedup test"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ProcessAiResponseContract>();
        Assert.NotNull(payload);
        Assert.True(payload!.Success);
        Assert.Equal(2, payload.Options.Count);
    }

    [Fact]
    public async Task RecipeImageSearch_MissingQuery_Returns400()
    {
        var response = await client.GetAsync("/api/recipes/image-search");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task RecipeImageSearch_WithQuery_ReturnsSuccessEnvelope()
    {
        var response = await client.GetAsync("/api/recipes/image-search?query=pasta");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ImageSearchResponseContract>();
        Assert.NotNull(payload);
        Assert.True(payload!.Success);
        Assert.NotEmpty(payload.Results);
    }

    [Fact]
    public async Task ReportBrokenImage_MissingRecipeId_Returns400()
    {
        var response = await client.PostAsJsonAsync("/api/recipes/report-broken-image", new { recipeName = "Soup" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ReportBrokenImage_WithRecipeId_ReturnsSuccessEnvelope()
    {
        var response = await client.PostAsJsonAsync("/api/recipes/report-broken-image", new
        {
            recipeId = 42,
            recipeName = "Soup",
            day = "monday",
            meal = "lunch",
            planId = 1,
            brokenUrl = "https://example.com/broken.jpg"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<ReportBrokenImageResponseContract>();
        Assert.NotNull(payload);
        Assert.True(payload!.Success);
    }

    [Fact]
    public async Task SearchHistoryCrud_PreservesLegacyStatuses()
    {
        var invalidPost = await client.PostAsJsonAsync("/api/search-history", new { planId = 0, day = "", meal = "", recipeName = "" });
        Assert.Equal(HttpStatusCode.BadRequest, invalidPost.StatusCode);

        var created = await client.PostAsJsonAsync("/api/search-history", new
        {
            planId = 10,
            planName = "Plan A",
            day = "monday",
            meal = "lunch",
            recipeName = "Soup",
            image = "",
            isActive = true
        });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync("/api/search-history/not-a-number")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("/api/search-history/999")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("/api/search-history")).StatusCode);
    }

    [Fact]
    public async Task BackupImport_PreservesLegacyStatuses()
    {
        var invalid = await client.PostAsJsonAsync("/api/backup/import", new { foo = "bar" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var valid = await client.PostAsJsonAsync("/api/backup/import", new
        {
            version = 1,
            exportedAt = DateTimeOffset.UtcNow,
            plans = Array.Empty<object>(),
            groceryListState = Array.Empty<object>(),
            completedRecipesState = Array.Empty<object>(),
            searchHistory = Array.Empty<object>()
        });
        Assert.Equal(HttpStatusCode.OK, valid.StatusCode);
    }

    [Fact]
    public async Task BatchCookingCrud_PreservesLegacyStatuses()
    {
        var missingParams = await client.PostAsJsonAsync("/api/plan/batch-cooking", new { forceRegenerate = true });
        Assert.Equal(HttpStatusCode.BadRequest, missingParams.StatusCode);

        var generated = await client.PostAsJsonAsync("/api/plan/batch-cooking", new
        {
            @params = new
            {
                burnersCount = 4,
                hasOven = true,
                hasMicrowave = true,
                hasAirfryer = false,
                hasRobot = false,
                customTools = string.Empty
            },
            forceRegenerate = false
        });
        Assert.Equal(HttpStatusCode.OK, generated.StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/plan/batch-cooking/reset", null)).StatusCode);
    }

    [Fact]
    public async Task Upload_MissingPayload_Returns400()
    {
        var response = await client.PostAsJsonAsync("/api/upload", new { fileName = "", fileData = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_InvalidExtension_Returns400()
    {
        var response = await client.PostAsJsonAsync("/api/upload", new { fileName = "plan.txt", fileData = "Zm9v" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Upload_DuplicateHash_ReturnsDuplicateEnvelope()
    {
        var response = await client.PostAsJsonAsync("/api/upload", new
        {
            fileName = "plan.pdf",
            fileData = "Zm9v"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<UploadDuplicateResponse>();
        Assert.NotNull(payload);
        Assert.True(payload!.DuplicateDetected);
        Assert.NotNull(payload.ExistingPlan);
        Assert.Equal(77, payload.ExistingPlan!.Id);
    }

    [Fact]
    public async Task Upload_ForceReprocess_ReturnsSuccessEnvelope()
    {
        var response = await client.PostAsJsonAsync("/api/upload", new
        {
            fileName = "plan.pdf",
            fileData = "Zm9v",
            forceReprocess = true
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<UploadSuccessResponse>();
        Assert.NotNull(payload);
        Assert.True(payload!.Success);
    }

    [Fact]
    public async Task Reprocess_WithoutActiveFile_Returns400()
    {
        var response = await client.PostAsJsonAsync("/api/reprocess", new { lang = "es" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private sealed record RecipeCreatedContract(bool Success, long Id);
    private sealed record ProcessAiResponseContract(bool Success, IReadOnlyList<ProcessAiOptionContract> Options);
    private sealed record ProcessAiOptionContract(string RecipeName);
    private sealed record ImageSearchResponseContract(bool Success, IReadOnlyList<string> Results);
    private sealed record ReportBrokenImageResponseContract(bool Success, string? NewImageUrl);
    private sealed record UploadDuplicateResponse(bool DuplicateDetected, UploadExistingPlan? ExistingPlan);
    private sealed record UploadExistingPlan(long Id, string FileName, bool IsActive);
    private sealed record UploadSuccessResponse(bool Success);
}
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configBuilder) =>
        {
            configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ApiConfiguration:Database:Provider"] = "Sqlite",
                ["ApiConfiguration:Database:ApplyMigrations"] = "false",
                ["ApiConfiguration:ConnectionStrings:Default"] = "Data Source=:memory:",
                ["ApiConfiguration:Telemetry:Sentry:Dsn"] = "",
                ["Sentry:Dsn"] = ""
            });
        });
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IPlanRepository>(); services.RemoveAll<IGroceryListRepository>(); services.RemoveAll<ICompletedRecipesRepository>(); services.RemoveAll<IIngredientRepository>(); services.RemoveAll<IRecipeRepository>(); services.RemoveAll<ISearchHistoryRepository>(); services.RemoveAll<IBackupRepository>(); services.RemoveAll<IBatchCookingRepository>(); services.RemoveAll<IUploadedPlanRepository>(); services.RemoveAll<IUploadFileStorage>(); services.RemoveAll<IPlanExtractionService>(); services.RemoveAll<IRecipeAiProcessingService>();
            services.AddSingleton<IPlanRepository, Plans>(); services.AddSingleton<IGroceryListRepository, Grocery>(); services.AddSingleton<ICompletedRecipesRepository, Completed>(); services.AddSingleton<IIngredientRepository, Ingredients>(); services.AddSingleton<IRecipeRepository, Recipes>(); services.AddSingleton<ISearchHistoryRepository, SearchHistory>(); services.AddSingleton<IBackupRepository, Backup>(); services.AddSingleton<IBatchCookingRepository, BatchCooking>(); services.AddSingleton<IUploadedPlanRepository, UploadedPlans>(); services.AddSingleton<IUploadFileStorage, UploadFileStorage>(); services.AddSingleton<IPlanExtractionService, PlanExtractionService>(); services.AddSingleton<IRecipeAiProcessingService, DuplicateRecipeAiProcessingService>();
        });
    }
    private sealed class Plans : IPlanRepository
    {
        public Task<MealPlan?> GetActiveAsync(CancellationToken t) =>
            Task.FromResult<MealPlan?>(new MealPlan("{\"days\":{\"monday\":{\"lunch\":{\"id\":1,\"recipeName\":\"Soup\",\"ingredients\":[]}}}}", "{}", "plan.pdf"));
        public Task<MealPlan?> GetByIdAsync(long id, CancellationToken t) => Task.FromResult<MealPlan?>(null);
        public Task<IReadOnlyList<MealPlan>> GetHistoryAsync(CancellationToken t) => Task.FromResult<IReadOnlyList<MealPlan>>([]);
        public Task ResetActiveAsync(CancellationToken t) => Task.CompletedTask;
        public Task<MealPlan?> RestoreAsync(long id, CancellationToken t) => Task.FromResult<MealPlan?>(null);
        public Task<bool> DeleteAsync(long id, CancellationToken t) => Task.FromResult(false);
        public Task SaveAsync(MealPlan plan, CancellationToken t) => Task.CompletedTask;
    }
    private sealed class Grocery : IGroceryListRepository
    {
        public Task<GroceryListState?> GetAsync(CancellationToken t) => Task.FromResult<GroceryListState?>(null);
        public Task SaveAsync(GroceryListState state, CancellationToken t) => Task.CompletedTask;
    }
    private sealed class Completed : ICompletedRecipesRepository
    {
        public Task<CompletedRecipesState?> GetByPlanIdAsync(long id, CancellationToken t) => Task.FromResult<CompletedRecipesState?>(null);
        public Task SaveAsync(CompletedRecipesState state, CancellationToken t) => Task.CompletedTask;
    }
    private sealed class Ingredients : IIngredientRepository
    {
        public Task<IReadOnlyList<Ingredient>> GetAllAsync(CancellationToken t) => Task.FromResult<IReadOnlyList<Ingredient>>([]);
        public Task SaveAsync(string name, string category, CancellationToken t) => Task.CompletedTask;
        public Task SaveManyAsync(IReadOnlyCollection<(string Name, string Category)> ingredients, CancellationToken t) => Task.CompletedTask;
    }
    private sealed class Recipes : IRecipeRepository
    {
        public Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken t) => Task.FromResult<IReadOnlyList<Recipe>>([]);
        public Task<Recipe?> GetByIdAsync(long id, CancellationToken t) => Task.FromResult<Recipe?>(id == 42 ? new Recipe("Soup", 100, "20 min", null, null, "[]", "", "[]", null, null, 1, "manual", null, false, false, "Todas") : null);
        public Task<long> AddAsync(Recipe recipe, CancellationToken t) => Task.FromResult(42L);
        public Task UpdateAsync(long id, RecipeWriteModel recipe, CancellationToken t) => Task.CompletedTask;
        public Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<bool?> ToggleFavoriteAsync(long id, CancellationToken t) => Task.FromResult<bool?>(null);
        public Task DeleteAsync(long id, CancellationToken t) => Task.CompletedTask;
    }
    private sealed class SearchHistory : ISearchHistoryRepository
    {
        public Task<IReadOnlyList<SearchHistoryItem>> GetRecentAsync(int limit, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<SearchHistoryItem>>([]);
        public Task AddAsync(SearchHistoryItem item, int limit, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task DeleteAsync(long id, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task ClearAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
    private sealed class Backup : IBackupRepository
    {
        public Task<VitalityNutri.Application.Backups.BackupExportResult> ExportAsync(CancellationToken cancellationToken) =>
            Task.FromResult(new VitalityNutri.Application.Backups.BackupExportResult(
                1,
                DateTimeOffset.UtcNow,
                [],
                [],
                [],
                []));

        public Task ImportAsync(System.Text.Json.JsonElement payload, CancellationToken cancellationToken) => Task.CompletedTask;
    }
    private sealed class BatchCooking : IBatchCookingRepository
    {
        public Task<BatchCookingState?> GetByPlanIdAsync(long planId, CancellationToken cancellationToken) => Task.FromResult<BatchCookingState?>(null);
        public Task SaveAsync(BatchCookingState state, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task ResetAsync(long planId, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private sealed class UploadedPlans : IUploadedPlanRepository
    {
        public Task<DuplicatePlanRecord?> FindByHashAsync(string hash, CancellationToken cancellationToken) =>
            Task.FromResult(hash == "dup-hash" ? new DuplicatePlanRecord(77, "duplicate-plan.pdf", true) : null);

        public Task<ActiveStoredPlan?> GetActiveAsync(CancellationToken cancellationToken) =>
            Task.FromResult<ActiveStoredPlan?>(null);

        public Task<SavedPlanEnvelope> SaveUploadedPlanAsync(string originalFileName, string savedFileName, string fileHash, string planJson, DateTimeOffset processedAtUtc, CancellationToken cancellationToken) =>
            Task.FromResult(new SavedPlanEnvelope(planJson, "{\"id\":1,\"fileName\":\"plan.pdf\",\"savedFileName\":\"stored.pdf\",\"processedAt\":\"2026-01-01T00:00:00Z\"}"));

        public Task<SavedPlanEnvelope> ReprocessActivePlanAsync(string planJson, string fileHash, DateTimeOffset processedAtUtc, CancellationToken cancellationToken) =>
            Task.FromResult(new SavedPlanEnvelope(planJson, "{}"));
    }

    private sealed class UploadFileStorage : IUploadFileStorage
    {
        public Task<StoredUploadFile> SaveBase64PdfAsync(string fileName, string base64Content, CancellationToken cancellationToken) =>
            Task.FromResult(new StoredUploadFile("stored.pdf", "C:\\temp\\stored.pdf", "dup-hash"));

        public Task<StoredUploadFileInfo?> GetActiveFileAsync(string savedFileName, CancellationToken cancellationToken) =>
            Task.FromResult<StoredUploadFileInfo?>(null);

        public Task DeleteFileIfExistsAsync(string savedFileName, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<string> ComputeFileHashAsync(string filePath, CancellationToken cancellationToken) =>
            Task.FromResult("dup-hash");
    }

    private sealed class PlanExtractionService : IPlanExtractionService
    {
        public Task<string> ExtractPlanJsonAsync(string filePath, string language, CancellationToken cancellationToken) =>
            Task.FromResult("{\"days\":{\"monday\":{\"breakfast\":{\"recipeName\":\"Test meal\",\"ingredients\":[],\"instructions\":[]},\"lunch\":null,\"snack\":null,\"dinner\":null}}}");
    }

    private sealed class DuplicateRecipeAiProcessingService : IRecipeAiProcessingService
    {
        public Task<IReadOnlyList<RecipeAiOption>> ProcessAsync(RecipeAiInput input, CancellationToken cancellationToken)
        {
            var options = new List<RecipeAiOption>
            {
                Create("Tortilla", ["Huevo", "Sal"]),
                Create("  tortilla  ", ["sal", "huevo"]),
                Create("Ensalada", ["Lechuga", "Tomate"]),
                Create("ENSALADA", ["tomate", "lechuga"])
            };

            return Task.FromResult<IReadOnlyList<RecipeAiOption>>(options.Take(Math.Max(1, input.OptionsCount)).ToArray());
        }

        private static RecipeAiOption Create(string name, string[] ingredientNames)
        {
            var ingredients = ingredientNames
                .Select(x => new { name = x, originalAmount = 1, unit = "unidad", category = "Otros" })
                .ToArray();

            return new RecipeAiOption(
                name,
                200,
                "15 min",
                "meal",
                string.Empty,
                JsonSerializer.SerializeToElement(ingredients),
                JsonSerializer.SerializeToElement(new[] { "Paso 1: mezclar", "Paso 2: cocinar" }),
                "",
                "",
                null,
                1);
        }
    }
}
