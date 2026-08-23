using System.Text.Json;
using System.Text.Json.Serialization;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using VitalityNutri.Application.Recipes;
using VitalityNutri.Application.Recipes.CreateRecipe;
using VitalityNutri.Application.Recipes.DeleteRecipe;
using VitalityNutri.Application.Recipes.GetFavoriteStatus;
using VitalityNutri.Application.Recipes.GetRecipeById;
using VitalityNutri.Application.Recipes.ImageSearch;
using VitalityNutri.Application.Recipes.GetRecipes;
using VitalityNutri.Application.Recipes.GetRecipeTags;
using VitalityNutri.Application.Recipes.ProcessAi;
using VitalityNutri.Application.Recipes.ReportBrokenImage;
using VitalityNutri.Application.Recipes.ToggleFavorite;
using VitalityNutri.Application.Recipes.UpdateRecipe;

using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Recipes.Translate;
using Microsoft.Extensions.Localization;
using VitalityNutri.Application.Resources;

namespace VitalityNutri.Api.Controllers.Recipes;

/// <summary>Handles recipe-book CRUD operations.</summary>
/// <param name="sender">Application request dispatcher.</param>
/// <param name="languageProvider">Language resolution provider.</param>
/// <param name="localizer">Localized messages accessor.</param>
/// <param name="currentUserProvider">Current user context provider.</param>
[ApiController, Route("api/recipes")]
public sealed class RecipesController(
    ISender sender,
    ICurrentLanguageProvider languageProvider,
    IStringLocalizer<Messages> localizer,
    ICurrentUserProvider currentUserProvider) : ControllerBase
{
    /// <summary>Returns recipes ordered from newest to oldest.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RecipeResult>>> GetAll(CancellationToken token) =>
        Ok(await sender.Send(new GetRecipesQuery(), token));

    /// <summary>Returns the distinct recipe tags.</summary>
    [HttpGet("tags")]
    public async Task<ActionResult<IReadOnlyList<string>>> GetTags(CancellationToken token) =>
        Ok(await sender.Send(new GetRecipeTagsQuery(), token));

    /// <summary>Returns favorite status for a valid recipe identifier.</summary>
    [HttpGet("favorite-status")]
    public async Task<ActionResult<FavoriteStatusResult>> GetFavoriteStatus([FromQuery] string? id, CancellationToken token)
    {
        if (!long.TryParse(id, out var recipeId)) return Ok(new FavoriteStatusResult(false));
        return Ok(await sender.Send(new GetFavoriteStatusQuery(recipeId), token));
    }

    /// <summary>Searches recipe images.</summary>
    [HttpGet("image-search")]
    public async Task<ActionResult<object>> SearchImages([FromQuery] string? query, CancellationToken token)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesMissingQuery]));
        }

        var results = await sender.Send(new SearchRecipeImagesQuery(query), token);
        return Ok(new { success = true, results });
    }

    /// <summary>Reports a broken recipe image and tries to assign a new valid replacement.</summary>
    [HttpPost("report-broken-image")]
    public async Task<ActionResult<object>> ReportBrokenImage(ReportBrokenImageRequest request, CancellationToken token)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new RecipeErrorResponse("Image replacement is disabled in demo mode."));
        }

        if (!request.RecipeId.HasValue || request.RecipeId.Value <= 0)
        {
            return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesIdRequired]));
        }

        var newImageUrl = await sender.Send(new ReportBrokenRecipeImageCommand(
            request.RecipeId.Value,
            request.RecipeName,
            request.PlanId,
            request.Day,
            request.Meal,
            request.BrokenUrl), token);

        return Ok(new { success = true, newImageUrl });
    }

    /// <summary>Processes recipe content with AI-compatible contract.</summary>
    [HttpPost("process-ai"), EnableRateLimiting("general-write")]
    public async Task<ActionResult<object>> ProcessAi(ProcessRecipeAiRequest request, CancellationToken token)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new RecipeErrorResponse("AI recipe generation is disabled in demo mode."));
        }

        if (!IsValidSourcePayload(request))
        {
            return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesInvalidParamsOrFileData]));
        }

        var optionsCount = Math.Clamp(request.OptionsCount ?? 3, 1, 5);
        var result = await sender.Send(new ProcessRecipeAiCommand(
            request.SourceType!,
            request.FileData,
            request.TextData,
            optionsCount,
            request.ExtraPrompt,
            request.Lang ?? "es"), token);

        return Ok(new { success = result.Success, options = result.Options });
    }

    /// <summary>Returns one recipe.</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<RecipeResult>> GetById(string id, CancellationToken token)
    {
        if (!long.TryParse(id, out var recipeId)) return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesInvalidId]));
        var recipe = await sender.Send(new GetRecipeByIdQuery(recipeId), token);
        return recipe is null ? NotFound(new RecipeErrorResponse(localizer[Messages.RecipesNotFound])) : Ok(recipe);
    }

    /// <summary>Creates a recipe.</summary>
    [HttpPost, EnableRateLimiting("general-write")]
    public async Task<ActionResult<RecipeCreatedResponse>> Create(RecipeWriteRequest request, CancellationToken token)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new RecipeErrorResponse("Recipe creation is disabled in demo mode."));
        }

        if (!request.TryToModel(out var recipe))
            return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesMissingRequiredFields]));
        var id = await sender.Send(new CreateRecipeCommand(recipe), token);
        return Ok(new RecipeCreatedResponse(true, id));
    }

    /// <summary>Updates a recipe.</summary>
    [HttpPut("{id}"), EnableRateLimiting("general-write")]
    public async Task<ActionResult<RecipeWriteResponse>> Update(string id, RecipeWriteRequest request, CancellationToken token)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new RecipeErrorResponse("Recipe updating is disabled in demo mode."));
        }

        if (!long.TryParse(id, out var recipeId)) return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesInvalidId]));
        if (!request.TryToModel(out var recipe))
            return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesMissingRequiredFields]));
        await sender.Send(new UpdateRecipeCommand(recipeId, recipe), token);
        return Ok(new RecipeWriteResponse(true));
    }

    /// <summary>Toggles a recipe's favorite status.</summary>
    [HttpPut("{id}/toggle-favorite"), EnableRateLimiting("general-write")]
    public async Task<ActionResult<FavoriteToggleResponse>> ToggleFavorite(string id, CancellationToken token)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new RecipeErrorResponse("Favorites are read-only in demo mode."));
        }

        if (!long.TryParse(id, out var recipeId)) return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesInvalidId]));
        var isFavorite = await sender.Send(new ToggleFavoriteCommand(recipeId), token);
        return isFavorite.HasValue
            ? Ok(new FavoriteToggleResponse(true, isFavorite.Value))
            : NotFound(new RecipeErrorResponse(localizer[Messages.RecipesNotFound]));
    }

    /// <summary>Deletes a recipe.</summary>
    [HttpDelete("{id}"), EnableRateLimiting("general-write")]
    public async Task<ActionResult<RecipeWriteResponse>> Delete(string id, CancellationToken token)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new RecipeErrorResponse("Recipe deletion is disabled in demo mode."));
        }

        if (!long.TryParse(id, out var recipeId)) return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesInvalidId]));
        await sender.Send(new DeleteRecipeCommand(recipeId), token);
        return Ok(new RecipeWriteResponse(true));
    }

    /// <summary>Translates an arbitrary recipe payload (e.g. from an active meal plan) to the target language on demand using AI.</summary>
    [HttpPost("translate"), EnableRateLimiting("general-write")]
    public async Task<ActionResult<TranslateRecipeResult>> TranslatePayload([FromBody] TranslateRecipePayloadRequest request, [FromQuery] string? targetLang, CancellationToken token)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new RecipeErrorResponse("Recipe translation is disabled in demo mode."));
        }

        var lang = string.IsNullOrWhiteSpace(targetLang) ? (string.IsNullOrWhiteSpace(request.TargetLanguage) ? languageProvider.GetCurrentLanguage() : request.TargetLanguage) : targetLang;
        var result = await sender.Send(new TranslateRecipePayloadCommand(
            request.RecipeName ?? string.Empty,
            request.Tips ?? string.Empty,
            request.NutritionistTips,
            request.Ingredients,
            request.Steps,
            request.SourceLanguage,
            lang), token);

        return Ok(result);
    }

    /// <summary>Gets the cached translation for a stored recipe without generating via AI.</summary>
    [HttpGet("{id}/translate")]
    public async Task<ActionResult<TranslateRecipeResult?>> GetTranslation(string id, [FromQuery] string? targetLang, CancellationToken token)
    {
        if (!long.TryParse(id, out var recipeId)) return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesInvalidId]));
        var lang = string.IsNullOrWhiteSpace(targetLang) ? languageProvider.GetCurrentLanguage() : targetLang;
        var result = await sender.Send(new VitalityNutri.Application.Recipes.GetRecipeTranslation.GetRecipeTranslationQuery(recipeId, lang), token);
        return Ok(result);
    }

    /// <summary>Translates a stored recipe's title, ingredients, steps and tips to the target language on demand using AI.</summary>
    [HttpPost("{id}/translate"), EnableRateLimiting("general-write")]
    public async Task<ActionResult<TranslateRecipeResult>> Translate(string id, [FromQuery] string? targetLang, CancellationToken token)
    {
        if (currentUserProvider.IsDemo())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new RecipeErrorResponse("Recipe translation is disabled in demo mode."));
        }

        if (!long.TryParse(id, out var recipeId)) return BadRequest(new RecipeErrorResponse(localizer[Messages.RecipesInvalidId]));
        var lang = string.IsNullOrWhiteSpace(targetLang) ? languageProvider.GetCurrentLanguage() : targetLang;
        var result = await sender.Send(new TranslateRecipeCommand(recipeId, lang), token);
        return result is null
            ? NotFound(new RecipeErrorResponse(localizer[Messages.RecipesNotFound]))
            : Ok(result);
    }

    private static bool IsValidSourcePayload(ProcessRecipeAiRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SourceType)) return false;

        return request.SourceType.Equals("image", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(request.FileData)
            || request.SourceType.Equals("pdf", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(request.FileData)
            || request.SourceType.Equals("text", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(request.TextData)
            || request.SourceType.Equals("mejora", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(request.TextData);
    }
}

/// <summary>Payload for translating an arbitrary recipe on demand.</summary>
public sealed record TranslateRecipePayloadRequest(
    string? RecipeName,
    string? Tips,
    string? NutritionistTips,
    JsonElement Ingredients,
    JsonElement Steps,
    string? SourceLanguage = null,
    string? TargetLanguage = null);

/// <summary>Payload for recipe AI processing request.</summary>
public sealed record ProcessRecipeAiRequest(string? SourceType, string? FileData, string? TextData, int? OptionsCount = 3, string? ExtraPrompt = null, string? Lang = null);

/// <summary>Recipe fields accepted by create and update operations.</summary>
public sealed record RecipeWriteRequest(
    string? RecipeName,
    int? Calories,
    string? Time,
    string? Tag,
    string? Image,
    JsonElement? Ingredients,
    string? Tips,
    JsonElement? Steps,
    string? NutritionistTips,
    JsonElement? Nutrition,
    int? Servings,
    string? Source,
    long? SourcePlanId,
    bool? IsAiGenerated,
    bool? IsFavorite,
    string? Season)
{
    internal bool TryToModel(out RecipeWriteModel model)
    {
        model = null!;
        if (string.IsNullOrWhiteSpace(RecipeName) || !Ingredients.HasValue ||
            Ingredients.Value.ValueKind is not (JsonValueKind.Array or JsonValueKind.Object)) return false;
        model = new RecipeWriteModel(
            RecipeName, Calories ?? 0, Time ?? "20 min", Tag, Image, Ingredients.Value,
            Tips ?? string.Empty, Steps ?? JsonSerializer.Deserialize<JsonElement>("[]"),
            NutritionistTips, Nutrition, Servings ?? 1, Source ?? "manual", SourcePlanId,
            IsAiGenerated ?? false, IsFavorite ?? false, Season ?? "Todas");
        return true;
    }
}

/// <summary>Successful recipe creation response.</summary>
public sealed record RecipeCreatedResponse(bool Success, long Id);
/// <summary>Successful recipe write response.</summary>
public sealed record RecipeWriteResponse(bool Success);
/// <summary>Successful favorite toggle response.</summary>
public sealed record FavoriteToggleResponse(bool Success, bool IsFavorite);
/// <summary>Recipe API error response.</summary>
public sealed record RecipeErrorResponse(string Error);

/// <summary>Payload for broken image report handling.</summary>
public sealed record ReportBrokenImageRequest(
    string? RecipeName,
    string? Day,
    string? Meal,
    long? PlanId,
    long? RecipeId,
    string? BrokenUrl);