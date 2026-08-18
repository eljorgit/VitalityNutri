using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Recipes.CreateRecipe;

public sealed record CreateRecipeCommand(RecipeWriteModel Recipe) : IRequest<long>;

internal sealed class CreateRecipeCommandValidator : AbstractValidator<CreateRecipeCommand>
{
    public CreateRecipeCommandValidator() => RuleFor(command => command.Recipe).SetValidator(new RecipeWriteModelValidator());
}

internal sealed class CreateRecipeCommandHandler(IRecipeRepository recipes, IIngredientRepository ingredients)
    : IRequestHandler<CreateRecipeCommand, long>
{
    public async Task<long> Handle(CreateRecipeCommand request, CancellationToken cancellationToken)
    {
        var id = await recipes.AddAsync(RecipeMappings.ToEntity(request.Recipe), cancellationToken);
        await ingredients.SaveManyAsync(RecipeIngredients.Extract(request.Recipe.Ingredients), cancellationToken);
        return id;
    }
}