using System.Text.Json;
using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.GroceryLists.SaveGroceryList;

public sealed record SaveGroceryListCommand(
    JsonElement CheckedItems,
    string ListType,
    string SelectedSingleDay,
    string Selected3DaysStart,
    IReadOnlyList<string> ExcludedMeals,
    JsonElement Multipliers) : IRequest;

internal sealed class SaveGroceryListCommandValidator : AbstractValidator<SaveGroceryListCommand>
{
    public SaveGroceryListCommandValidator()
    {
        RuleFor(command => command.ListType).NotEmpty().MaximumLength(32);
        RuleFor(command => command.SelectedSingleDay).MaximumLength(32);
        RuleFor(command => command.Selected3DaysStart).MaximumLength(32);
    }
}

internal sealed class SaveGroceryListCommandHandler(IGroceryListRepository repository)
    : IRequestHandler<SaveGroceryListCommand>
{
    public async Task Handle(SaveGroceryListCommand request, CancellationToken cancellationToken)
    {
        var state = await repository.GetAsync(cancellationToken);
        var excludedMealsJson = JsonSerializer.Serialize(request.ExcludedMeals);
        if (state is null)
        {
            state = new GroceryListState(request.CheckedItems.GetRawText(), request.ListType,
                request.SelectedSingleDay, request.Selected3DaysStart, excludedMealsJson,
                request.Multipliers.GetRawText());
        }
        else
        {
            state.Update(request.CheckedItems.GetRawText(), request.ListType,
                request.SelectedSingleDay, request.Selected3DaysStart, excludedMealsJson,
                request.Multipliers.GetRawText());
        }

        await repository.SaveAsync(state, cancellationToken);
    }
}