using MediatR; using Microsoft.AspNetCore.Mvc; using VitalityNutri.Application.Ingredients.GetIngredients;
using VitalityNutri.Application.Ingredients.SaveIngredient;
namespace VitalityNutri.Api.Controllers.Ingredients;
/// <summary>Handles ingredient catalog queries.</summary>
/// <param name="sender">Application request dispatcher.</param>
[ApiController, Route("api/ingredients")]
public sealed class IngredientsController(ISender sender) : ControllerBase
{
    /// <summary>Returns known ingredients ordered by name.</summary>
    [HttpGet] public async Task<ActionResult<IReadOnlyList<IngredientResult>>> Get(CancellationToken token) => Ok(await sender.Send(new GetIngredientsQuery(), token));

    /// <summary>Creates or updates an ingredient.</summary>
    [HttpPost]
    public async Task<ActionResult<IngredientWriteResponse>> Save(SaveIngredientRequest request, CancellationToken token)
    {
        await sender.Send(new SaveIngredientCommand(request.Name, request.Category), token);
        return Ok(new IngredientWriteResponse(true));
    }
}
/// <summary>Ingredient to create or update.</summary>
/// <param name="Name">Ingredient name.</param>
/// <param name="Category">Ingredient category.</param>
public sealed record SaveIngredientRequest(string Name, string Category);
/// <summary>Successful ingredient write response.</summary>
/// <param name="Success">Whether the write completed.</param>
public sealed record IngredientWriteResponse(bool Success);