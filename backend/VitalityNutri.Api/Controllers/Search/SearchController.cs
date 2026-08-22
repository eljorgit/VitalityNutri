using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using VitalityNutri.Application.Resources;
using VitalityNutri.Application.Search.AddSearchHistory;
using VitalityNutri.Application.Search.ClearSearchHistory;
using VitalityNutri.Application.Search.DeleteSearchHistory;
using VitalityNutri.Application.Search.GetAllRecipes;
using VitalityNutri.Application.Search.GetSearchHistory;

namespace VitalityNutri.Api.Controllers.Search;

/// <summary>Provides cross-plan search pool and click-history endpoints.</summary>
/// <param name="sender">Application request dispatcher.</param>
/// <param name="localizer">Localized messages accessor.</param>
[ApiController, Route("api")]
public sealed class SearchController(ISender sender, IStringLocalizer<Messages> localizer) : ControllerBase
{
    /// <summary>Returns the lightweight recipe pool from plans and recipe book.</summary>
    [HttpGet("all-recipes")]
    public async Task<ActionResult<IReadOnlyList<SearchRecipeItemResult>>> GetAllRecipes(CancellationToken token) =>
        Ok(await sender.Send(new GetAllRecipesQuery(), token));

    /// <summary>Returns the most recent search clicks.</summary>
    [HttpGet("search-history")]
    public async Task<ActionResult<IReadOnlyList<SearchHistoryResult>>> GetSearchHistory(CancellationToken token) =>
        Ok(await sender.Send(new GetSearchHistoryQuery(), token));

    /// <summary>Adds one item to search history.</summary>
    [HttpPost("search-history")]
    public async Task<ActionResult<SearchWriteResponse>> AddSearchHistory(SearchHistoryWriteRequest request, CancellationToken token)
    {
        if (request.PlanId == 0 || string.IsNullOrWhiteSpace(request.Day) ||
            string.IsNullOrWhiteSpace(request.Meal) || string.IsNullOrWhiteSpace(request.RecipeName))
        {
            return BadRequest(new SearchErrorResponse(localizer[Messages.SearchMissingFields]));
        }

        await sender.Send(new AddSearchHistoryCommand(
            request.PlanId,
            request.PlanName ?? string.Empty,
            request.Day,
            request.Meal,
            request.RecipeName,
            request.Image ?? string.Empty,
            request.IsActive), token);

        return Ok(new SearchWriteResponse(true));
    }

    /// <summary>Clears all search history entries.</summary>
    [HttpDelete("search-history")]
    public async Task<ActionResult<SearchWriteResponse>> ClearSearchHistory(CancellationToken token)
    {
        await sender.Send(new ClearSearchHistoryCommand(), token);
        return Ok(new SearchWriteResponse(true));
    }

    /// <summary>Deletes one search-history entry by identifier.</summary>
    [HttpDelete("search-history/{id}")]
    public async Task<ActionResult<SearchWriteResponse>> DeleteSearchHistory(string id, CancellationToken token)
    {
        if (!long.TryParse(id, out var searchId))
        {
            return BadRequest(new SearchErrorResponse(localizer[Messages.SearchInvalidId]));
        }

        await sender.Send(new DeleteSearchHistoryCommand(searchId), token);
        return Ok(new SearchWriteResponse(true));
    }
}

/// <summary>Request model for creating one search-history row.</summary>
public sealed record SearchHistoryWriteRequest(
    long PlanId,
    string? PlanName,
    string Day,
    string Meal,
    string RecipeName,
    string? Image,
    bool IsActive);

/// <summary>Successful write response.</summary>
public sealed record SearchWriteResponse(bool Success);
/// <summary>Search API error response.</summary>
public sealed record SearchErrorResponse(string Error);