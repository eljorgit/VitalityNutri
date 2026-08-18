using System.Text.Json;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using VitalityNutri.Application.GroceryLists.GetGroceryList;
using VitalityNutri.Application.GroceryLists.SaveGroceryList;
namespace VitalityNutri.Api.Controllers.GroceryLists;
/// <summary>Handles grocery-list state operations.</summary>
/// <param name="sender">Application request dispatcher.</param>
[ApiController, Route("api/grocery-list")]
public sealed class GroceryListsController(ISender sender) : ControllerBase
{
    /// <summary>Returns the current grocery-list state.</summary>
    [HttpGet] public async Task<ActionResult<GroceryListResult>> Get(CancellationToken token) => Ok(await sender.Send(new GetGroceryListQuery(), token));

    /// <summary>Saves the current grocery-list state.</summary>
    [HttpPost]
    public async Task<ActionResult<SuccessResponse>> Save(SaveGroceryListRequest request, CancellationToken token)
    {
        await sender.Send(new SaveGroceryListCommand(request.CheckedItems, request.ListType,
            request.SelectedSingleDay, request.Selected3DaysStart, request.ExcludedMeals,
            request.Multipliers), token);
        return Ok(new SuccessResponse(true));
    }
}

/// <summary>Grocery-list state submitted by the frontend.</summary>
/// <param name="CheckedItems">Checked-item map.</param>
/// <param name="ListType">Selected list range.</param>
/// <param name="SelectedSingleDay">Selected day.</param>
/// <param name="Selected3DaysStart">Three-day range start.</param>
/// <param name="ExcludedMeals">Excluded meal identifiers.</param>
/// <param name="Multipliers">Quantity multipliers.</param>
public sealed record SaveGroceryListRequest(JsonElement CheckedItems, string ListType,
    string SelectedSingleDay, string Selected3DaysStart, IReadOnlyList<string> ExcludedMeals,
    JsonElement Multipliers);
/// <summary>Successful write response.</summary>
/// <param name="Success">Whether the write completed.</param>
public sealed record SuccessResponse(bool Success);