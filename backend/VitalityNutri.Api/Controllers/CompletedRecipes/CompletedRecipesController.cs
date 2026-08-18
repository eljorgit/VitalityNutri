using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using VitalityNutri.Application.CompletedRecipes.GetCompletedRecipes;
using VitalityNutri.Application.CompletedRecipes.SaveCompletedRecipes;
namespace VitalityNutri.Api.Controllers.CompletedRecipes;
/// <summary>Handles active-plan completion state.</summary>
/// <param name="sender">Application request dispatcher.</param>
[ApiController, Route("api/completed-recipes")]
public sealed class CompletedRecipesController(ISender sender) : ControllerBase
{
    /// <summary>Returns completion flags for the active plan.</summary>
    [HttpGet] public async Task<ActionResult<CompletedRecipesResponse>> Get(CancellationToken token) => Ok(new CompletedRecipesResponse(await sender.Send(new GetCompletedRecipesQuery(), token)));

    /// <summary>Saves completion flags for the active plan.</summary>
    [HttpPost]
    public async Task<ActionResult<CompletedRecipesSuccessResponse>> Save(
        SaveCompletedRecipesRequest request,
        CancellationToken token)
    {
        await sender.Send(new SaveCompletedRecipesCommand(request.CompletedRecipes), token);
        return Ok(new CompletedRecipesSuccessResponse(true));
    }
}
/// <summary>Wraps recipe completion flags.</summary>
/// <param name="CompletedRecipes">Completion state keyed by recipe.</param>
public sealed record CompletedRecipesResponse(JsonElement CompletedRecipes);
/// <summary>Completion state submitted by the frontend.</summary>
/// <param name="CompletedRecipes">Completion flags keyed by recipe.</param>
public sealed record SaveCompletedRecipesRequest(JsonElement CompletedRecipes);
/// <summary>Successful completion-state write response.</summary>
/// <param name="Success">Whether the write completed.</param>
public sealed record CompletedRecipesSuccessResponse(bool Success);