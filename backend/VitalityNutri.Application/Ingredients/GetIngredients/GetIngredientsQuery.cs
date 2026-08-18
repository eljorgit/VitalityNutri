using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
namespace VitalityNutri.Application.Ingredients.GetIngredients;
public sealed record GetIngredientsQuery : IRequest<IReadOnlyList<IngredientResult>>;
public sealed record IngredientResult(long Id, string Name, string Category);
internal sealed class GetIngredientsQueryHandler(IIngredientRepository repository) : IRequestHandler<GetIngredientsQuery, IReadOnlyList<IngredientResult>>
{
    public async Task<IReadOnlyList<IngredientResult>> Handle(GetIngredientsQuery request, CancellationToken cancellationToken) =>
        (await repository.GetAllAsync(cancellationToken)).Select(x => new IngredientResult(x.Id, x.Name, x.Category)).ToArray();
}