using MediatR;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Application.Recipes.ImageSearch;

public sealed record SearchRecipeImagesQuery(string Query) : IRequest<IReadOnlyList<string>>;

internal sealed class SearchRecipeImagesQueryHandler(IRecipeImageLookupService images) : IRequestHandler<SearchRecipeImagesQuery, IReadOnlyList<string>>
{
    public Task<IReadOnlyList<string>> Handle(SearchRecipeImagesQuery request, CancellationToken cancellationToken) =>
        images.SearchImagesAsync(request.Query, cancellationToken);
}