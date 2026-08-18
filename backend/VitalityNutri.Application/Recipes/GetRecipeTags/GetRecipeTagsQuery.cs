using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Recipes.GetRecipeTags;

public sealed record GetRecipeTagsQuery : IRequest<IReadOnlyList<string>>;

internal sealed class GetRecipeTagsQueryHandler(IRecipeRepository repository)
    : IRequestHandler<GetRecipeTagsQuery, IReadOnlyList<string>>
{
    public async Task<IReadOnlyList<string>> Handle(GetRecipeTagsQuery request, CancellationToken cancellationToken) =>
        (await repository.GetAllAsync(cancellationToken))
            .Select(recipe => recipe.Tag)
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Distinct()
            .Cast<string>()
            .ToArray();
}