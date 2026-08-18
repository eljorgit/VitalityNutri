using System.Text.Json.Nodes;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Application.Recipes.ReportBrokenImage;

public sealed record ReportBrokenRecipeImageCommand(
    long RecipeId,
    string? RecipeName,
    long? PlanId,
    string? Day,
    string? Meal,
    string? BrokenUrl) : IRequest<string>;

internal sealed class ReportBrokenRecipeImageCommandHandler(
    IRecipeRepository recipes,
    IPlanRepository plans,
    IRecipeImageLookupService images)
    : IRequestHandler<ReportBrokenRecipeImageCommand, string>
{
    public async Task<string> Handle(ReportBrokenRecipeImageCommand request, CancellationToken cancellationToken)
    {
        await recipes.UpdateImageAsync(request.RecipeId, string.Empty, cancellationToken);
        await UpdatePlanImageAsync(request, string.Empty, cancellationToken);

        var fallbackName = (await recipes.GetByIdAsync(request.RecipeId, cancellationToken))?.RecipeName ?? string.Empty;
        var nameToSearch = string.IsNullOrWhiteSpace(request.RecipeName) ? fallbackName : request.RecipeName;
        if (string.IsNullOrWhiteSpace(nameToSearch))
        {
            return string.Empty;
        }

        var replacement = await images.ResolveReplacementImageAsync(
            nameToSearch,
            string.IsNullOrWhiteSpace(request.Meal) ? "lunch" : request.Meal,
            string.IsNullOrWhiteSpace(request.BrokenUrl) ? [] : [request.BrokenUrl],
            cancellationToken);

        if (string.IsNullOrWhiteSpace(replacement))
        {
            return string.Empty;
        }

        await recipes.UpdateImageAsync(request.RecipeId, replacement, cancellationToken);
        await UpdatePlanImageAsync(request, replacement, cancellationToken);
        return replacement;
    }

    private async Task UpdatePlanImageAsync(ReportBrokenRecipeImageCommand request, string imageUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Day) || string.IsNullOrWhiteSpace(request.Meal))
        {
            return;
        }

        var plan = request.PlanId.HasValue && request.PlanId.Value > 0
            ? await plans.GetByIdAsync(request.PlanId.Value, cancellationToken)
            : await plans.GetActiveAsync(cancellationToken);

        if (plan is null)
        {
            return;
        }

        var root = JsonNode.Parse(plan.PlanJson) as JsonObject;
        var dayNode = root?["days"]?[request.Day.ToLowerInvariant()] as JsonObject;
        var recipeNode = dayNode?[request.Meal.ToLowerInvariant()] as JsonObject;
        if (recipeNode is null)
        {
            return;
        }

        if (recipeNode["id"]?.GetValue<long?>() is long recipeId && recipeId != request.RecipeId)
        {
            return;
        }

        recipeNode["image"] = imageUrl;
        plan.ReplacePlanJson(root!.ToJsonString());
        await plans.SaveAsync(plan, cancellationToken);
    }
}