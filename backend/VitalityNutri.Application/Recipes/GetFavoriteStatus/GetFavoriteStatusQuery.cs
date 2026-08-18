using MediatR;
using System.Text.Json.Serialization;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Recipes.GetFavoriteStatus;

public sealed record GetFavoriteStatusQuery(long Id) : IRequest<FavoriteStatusResult>;
public sealed record FavoriteStatusResult(bool IsFavorite, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] long? Id = null);

internal sealed class GetFavoriteStatusQueryHandler(IRecipeRepository repository)
    : IRequestHandler<GetFavoriteStatusQuery, FavoriteStatusResult>
{
    public async Task<FavoriteStatusResult> Handle(GetFavoriteStatusQuery request, CancellationToken cancellationToken)
    {
        var recipe = await repository.GetByIdAsync(request.Id, cancellationToken);
        return recipe is null ? new(false) : new(recipe.IsFavorite, recipe.Id);
    }
}