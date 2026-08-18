using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
namespace VitalityNutri.Application.GroceryLists.GetGroceryList;
public sealed record GetGroceryListQuery : IRequest<GroceryListResult>;
public sealed record GroceryListResult(JsonElement CheckedItems, string ListType, string SelectedSingleDay, string Selected3DaysStart, JsonElement ExcludedMeals, JsonElement Multipliers);
internal sealed class GetGroceryListQueryHandler(IGroceryListRepository repository) : IRequestHandler<GetGroceryListQuery, GroceryListResult>
{
    public async Task<GroceryListResult> Handle(GetGroceryListQuery request, CancellationToken cancellationToken)
    {
        var state = await repository.GetAsync(cancellationToken);
        return state is null
            ? new(JsonElementParser.Parse("{}"), "semanal", "", "", JsonElementParser.Parse("[]"), JsonElementParser.Parse("{}"))
            : new(JsonElementParser.Parse(state.CheckedItemsJson), state.ListType, state.SelectedSingleDay, state.SelectedThreeDaysStart,
                JsonElementParser.Parse(state.ExcludedMealsJson), JsonElementParser.Parse(state.MultipliersJson));
    }
}