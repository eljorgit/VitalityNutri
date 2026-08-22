using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Recipes.UpdateRecipe;

public sealed record UpdateRecipeCommand(long Id, RecipeWriteModel Recipe) : IRequest;

internal sealed class UpdateRecipeCommandValidator : AbstractValidator<UpdateRecipeCommand>
{
    public UpdateRecipeCommandValidator()
    {
        RuleFor(command => command.Id).GreaterThan(0);
        RuleFor(command => command.Recipe).SetValidator(new RecipeWriteModelValidator());
    }
}

internal sealed class UpdateRecipeCommandHandler(
    IRecipeRepository recipes,
    IIngredientRepository ingredients,
    IRecipeTranslationRepository translationRepository)
    : IRequestHandler<UpdateRecipeCommand>
{
    public async Task Handle(UpdateRecipeCommand request, CancellationToken cancellationToken)
    {
        await recipes.UpdateAsync(request.Id, request.Recipe, cancellationToken);
        await ingredients.SaveManyAsync(RecipeIngredients.Extract(request.Recipe.Ingredients), cancellationToken);
        await translationRepository.InvalidateAsync(request.Id, cancellationToken);
    }
}