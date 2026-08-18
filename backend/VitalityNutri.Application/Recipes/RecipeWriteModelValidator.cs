using FluentValidation;

namespace VitalityNutri.Application.Recipes;

internal sealed class RecipeWriteModelValidator : AbstractValidator<RecipeWriteModel>
{
    public RecipeWriteModelValidator()
    {
        RuleFor(recipe => recipe.RecipeName).NotEmpty().MaximumLength(512);
        RuleFor(recipe => recipe.Ingredients).Must(value => value.ValueKind is System.Text.Json.JsonValueKind.Array or System.Text.Json.JsonValueKind.Object);
        RuleFor(recipe => recipe.Time).MaximumLength(64);
        RuleFor(recipe => recipe.Tag).MaximumLength(255);
        RuleFor(recipe => recipe.Image).MaximumLength(2048);
        RuleFor(recipe => recipe.Source).MaximumLength(32);
        RuleFor(recipe => recipe.Season).MaximumLength(64);
    }
}