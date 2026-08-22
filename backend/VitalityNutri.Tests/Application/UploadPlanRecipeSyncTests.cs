using System.Text.Json;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Application.Uploads;
using VitalityNutri.Application.Uploads.ReprocessPlan;
using VitalityNutri.Application.Uploads.UploadPlan;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Tests.Application;

public sealed class UploadPlanRecipeSyncTests
{
    [Fact]
    public async Task UploadPlan_SyncsRecipesIntoRepository()
    {
        var fileStorage = new UploadStorage();
        var uploadedPlans = new UploadedPlans(
            metadataJson: "{\"id\":99}",
            activePlan: null);
        var extraction = new PlanExtraction("""
            {
              "days": {
                "monday": {
                  "breakfast": {
                    "recipeName": "Avena",
                    "ingredients": [{ "name": "Avena" }],
                    "instructions": ["Mezclar"]
                  }
                }
              }
            }
            """);
        var recipes = new Recipes();

        var handler = new UploadPlanCommandHandler(fileStorage, uploadedPlans, extraction, recipes);
        var result = await handler.Handle(new UploadPlanCommand("plan.pdf", "Zm9v", "es", true), CancellationToken.None);

        Assert.True(result.Success);
        Assert.Single(recipes.Added);
        Assert.Equal("Avena", recipes.Added[0].RecipeName);
        Assert.Equal("plan", recipes.Added[0].Source);
        Assert.Equal(99, recipes.Added[0].SourcePlanId);
        Assert.True(recipes.Added[0].IsAiGenerated);
    }

    [Fact]
    public async Task ReprocessPlan_UpdatesExistingRecipeAndPreservesFavorite()
    {
        var existing = new Recipe(
            "Avena",
            100,
            "10 min",
            "breakfast",
            null,
            "[]",
            string.Empty,
            "[]",
            null,
            null,
            1,
            "manual",
            null,
            false,
            true,
            "Todas");

        var recipes = new Recipes(existing);
        var fileStorage = new UploadStorage(activeFile: new StoredUploadFileInfo("stored.pdf", "C:\\temp\\stored.pdf"));
        var uploadedPlans = new UploadedPlans(
            metadataJson: "{\"id\":101}",
            activePlan: new ActiveStoredPlan(101, "plan.pdf", "stored.pdf", "hash-1"));
        var extraction = new PlanExtraction("""
            {
              "days": {
                "monday": {
                  "breakfast": {
                    "recipeName": "Avena",
                    "ingredients": [{ "name": "Avena" }],
                    "instructions": ["Mezclar"]
                  }
                }
              }
            }
            """);

        var localizer = new TestLocalizer<VitalityNutri.Application.Resources.Messages>();
        var handler = new ReprocessPlanCommandHandler(uploadedPlans, fileStorage, extraction, recipes, localizer);
        var result = await handler.Handle(new ReprocessPlanCommand("es"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Single(recipes.Updated);
        Assert.Equal(existing.Id, recipes.Updated[0].Id);
        Assert.True(recipes.Updated[0].Model.IsFavorite);
        Assert.Equal(101, recipes.Updated[0].Model.SourcePlanId);
    }

    private sealed class UploadStorage(StoredUploadFileInfo? activeFile = null) : IUploadFileStorage
    {
        public Task<StoredUploadFile> SaveBase64PdfAsync(string fileName, string base64Content, CancellationToken cancellationToken) =>
            Task.FromResult(new StoredUploadFile("stored.pdf", "C:\\temp\\stored.pdf", "hash-1"));

        public Task<StoredUploadFileInfo?> GetActiveFileAsync(string savedFileName, CancellationToken cancellationToken) =>
            Task.FromResult(activeFile);

        public Task DeleteFileIfExistsAsync(string savedFileName, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<string> ComputeFileHashAsync(string filePath, CancellationToken cancellationToken) =>
            Task.FromResult("hash-2");
    }

    private sealed class UploadedPlans(string metadataJson, ActiveStoredPlan? activePlan) : IUploadedPlanRepository
    {
        public Task<DuplicatePlanRecord?> FindByHashAsync(string hash, CancellationToken cancellationToken) =>
            Task.FromResult<DuplicatePlanRecord?>(null);

        public Task<ActiveStoredPlan?> GetActiveAsync(CancellationToken cancellationToken) =>
            Task.FromResult(activePlan);

        public Task<SavedPlanEnvelope> SaveUploadedPlanAsync(string originalFileName, string savedFileName, string fileHash, string planJson, DateTimeOffset processedAtUtc, string originalLanguage, CancellationToken cancellationToken) =>
            Task.FromResult(new SavedPlanEnvelope(planJson, metadataJson));

        public Task<SavedPlanEnvelope> ReprocessActivePlanAsync(string planJson, string fileHash, DateTimeOffset processedAtUtc, string originalLanguage, CancellationToken cancellationToken) =>
            Task.FromResult(new SavedPlanEnvelope(planJson, metadataJson));

        public Task UpdatePlanJsonAsync(long planId, string planJson, CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }

    private sealed class PlanExtraction(string planJson) : IPlanExtractionService
    {
        public Task<string> ExtractPlanJsonAsync(string filePath, string language, CancellationToken cancellationToken) =>
            Task.FromResult(planJson);
    }

    private sealed class Recipes(params Recipe[] existingRecipes) : IRecipeRepository
    {
        private long nextId = 200;
        private readonly List<Recipe> values = [.. existingRecipes];

        public List<Recipe> Added { get; } = [];
        public List<(long Id, RecipeWriteModel Model)> Updated { get; } = [];

        public Task<IReadOnlyList<Recipe>> GetAllAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<Recipe>>(values.ToArray());

        public Task<Recipe?> GetByIdAsync(long id, CancellationToken cancellationToken) =>
            Task.FromResult(values.FirstOrDefault(recipe => recipe.Id == id));

        public Task<long> AddAsync(Recipe recipe, CancellationToken cancellationToken)
        {
            Added.Add(recipe);
            values.Add(recipe);
            nextId += 1;
            return Task.FromResult(nextId);
        }

        public Task UpdateAsync(long id, RecipeWriteModel recipe, CancellationToken cancellationToken)
        {
            Updated.Add((id, recipe));
            return Task.CompletedTask;
        }

        public Task UpdateImageAsync(long id, string? image, CancellationToken cancellationToken) => Task.CompletedTask;

        public Task<bool?> ToggleFavoriteAsync(long id, CancellationToken cancellationToken) => Task.FromResult<bool?>(null);

        public Task DeleteAsync(long id, CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
