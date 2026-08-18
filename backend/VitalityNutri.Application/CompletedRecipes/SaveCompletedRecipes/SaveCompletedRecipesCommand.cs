using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.CompletedRecipes.SaveCompletedRecipes;

public sealed record SaveCompletedRecipesCommand(JsonElement CompletedRecipes) : IRequest;

internal sealed class SaveCompletedRecipesCommandHandler(
    IPlanRepository planRepository,
    ICompletedRecipesRepository completedRepository) : IRequestHandler<SaveCompletedRecipesCommand>
{
    public async Task Handle(SaveCompletedRecipesCommand request, CancellationToken cancellationToken)
    {
        var activePlan = await planRepository.GetActiveAsync(cancellationToken);
        var planId = activePlan?.Id ?? 0;
        var state = await completedRepository.GetByPlanIdAsync(planId, cancellationToken);
        if (state is null)
        {
            state = new CompletedRecipesState(planId, request.CompletedRecipes.GetRawText());
        }
        else
        {
            state.Update(request.CompletedRecipes.GetRawText());
        }

        await completedRepository.SaveAsync(state, cancellationToken);
    }
}