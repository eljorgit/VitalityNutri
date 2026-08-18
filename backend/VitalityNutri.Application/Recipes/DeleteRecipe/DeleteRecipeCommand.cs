using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Recipes.DeleteRecipe;

public sealed record DeleteRecipeCommand(long Id) : IRequest;

internal sealed class DeleteRecipeCommandHandler(IRecipeRepository repository)
    : IRequestHandler<DeleteRecipeCommand>
{
    public Task Handle(DeleteRecipeCommand request, CancellationToken cancellationToken) =>
        repository.DeleteAsync(request.Id, cancellationToken);
}