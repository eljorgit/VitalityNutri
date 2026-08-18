using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Recipes.GetRecipes;

public sealed record GetRecipesQuery : IRequest<IReadOnlyList<RecipeResult>>;

internal sealed class GetRecipesQueryHandler(IRecipeRepository repository)
    : IRequestHandler<GetRecipesQuery, IReadOnlyList<RecipeResult>>
{
    public async Task<IReadOnlyList<RecipeResult>> Handle(GetRecipesQuery request, CancellationToken cancellationToken) =>
        (await repository.GetAllAsync(cancellationToken)).Select(RecipeMappings.ToResult).ToArray();
}