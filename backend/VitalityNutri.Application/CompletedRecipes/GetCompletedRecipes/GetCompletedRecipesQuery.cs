using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;
namespace VitalityNutri.Application.CompletedRecipes.GetCompletedRecipes;
public sealed record GetCompletedRecipesQuery : IRequest<JsonElement>;
internal sealed class GetCompletedRecipesQueryHandler(IPlanRepository plans, ICompletedRecipesRepository completed) : IRequestHandler<GetCompletedRecipesQuery, JsonElement>
{
    public async Task<JsonElement> Handle(GetCompletedRecipesQuery request, CancellationToken cancellationToken)
    {
        var plan = await plans.GetActiveAsync(cancellationToken);
        var state = await completed.GetByPlanIdAsync(plan?.Id ?? 0, cancellationToken);
        return JsonElementParser.Parse(state?.CompletedJson ?? "{}");
    }
}