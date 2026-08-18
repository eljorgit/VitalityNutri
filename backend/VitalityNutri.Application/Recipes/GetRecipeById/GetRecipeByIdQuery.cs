using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Recipes.GetRecipeById;

public sealed record GetRecipeByIdQuery(long Id) : IRequest<RecipeResult?>;

internal sealed class GetRecipeByIdQueryHandler(IRecipeRepository repository)
    : IRequestHandler<GetRecipeByIdQuery, RecipeResult?>
{
    public async Task<RecipeResult?> Handle(GetRecipeByIdQuery request, CancellationToken cancellationToken)
    {
        var recipe = await repository.GetByIdAsync(request.Id, cancellationToken);
        return recipe is null ? null : RecipeMappings.ToResult(recipe);
    }
}