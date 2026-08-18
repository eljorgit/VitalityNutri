using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
namespace VitalityNutri.Application.Ingredients.SaveIngredient;
public sealed record SaveIngredientCommand(string Name, string Category) : IRequest;
internal sealed class SaveIngredientCommandValidator : AbstractValidator<SaveIngredientCommand>
{
    public SaveIngredientCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(255);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(128);
    }
}
internal sealed class SaveIngredientCommandHandler(IIngredientRepository repository) : IRequestHandler<SaveIngredientCommand>
{
    public Task Handle(SaveIngredientCommand request, CancellationToken token) => repository.SaveAsync(request.Name, request.Category, token);
}