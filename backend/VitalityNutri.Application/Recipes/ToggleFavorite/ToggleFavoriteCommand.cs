using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Recipes.ToggleFavorite;

public sealed record ToggleFavoriteCommand(long Id) : IRequest<bool?>;

internal sealed class ToggleFavoriteCommandHandler(IRecipeRepository repository)
    : IRequestHandler<ToggleFavoriteCommand, bool?>
{
    public Task<bool?> Handle(ToggleFavoriteCommand request, CancellationToken cancellationToken) =>
        repository.ToggleFavoriteAsync(request.Id, cancellationToken);
}