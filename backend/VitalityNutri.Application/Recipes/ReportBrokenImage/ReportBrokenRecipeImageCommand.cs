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
        var plan = request.PlanId.HasValue && request.PlanId.Value > 0
            ? await plans.GetByIdAsync(request.PlanId.Value, cancellationToken)
            : await plans.GetActiveAsync(cancellationToken);

        if (plan is null)
        {
            return;
        }

        var root = JsonNode.Parse(plan.PlanJson) as JsonObject;
        if (root?["days"] is not JsonObject days)
        {
            return;
        }

        var modified = false;

        // 1. If explicit day and meal are provided, update that slot
        if (!string.IsNullOrWhiteSpace(request.Day) && !string.IsNullOrWhiteSpace(request.Meal))
        {
            var dayKey = request.Day.Trim().ToLowerInvariant();
            var mealKey = request.Meal.Trim().ToLowerInvariant();
            if (days[dayKey] is JsonObject dayObj && dayObj[mealKey] is JsonObject mealObj)
            {
                var targetObj = mealObj["recipe"] is JsonObject nestedObj ? nestedObj : mealObj;
                targetObj["image"] = imageUrl;
                modified = true;
            }
        }

        // 2. Also search all slots by recipeId or recipeName to update all occurrences of the same recipe
        foreach (var dayProp in days)
        {
            if (dayProp.Value is not JsonObject dayObj) continue;

            foreach (var mealProp in dayObj)
            {
                if (mealProp.Value is not JsonObject mealObj) continue;

                var targetObj = mealObj["recipe"] is JsonObject nestedObj ? nestedObj : mealObj;
                var id = targetObj["id"]?.GetValue<long?>();
                var name = targetObj["recipeName"]?.GetValue<string>();

                var matchesId = id.HasValue && id.Value == request.RecipeId;
                var matchesName = !string.IsNullOrWhiteSpace(request.RecipeName) &&
                                  !string.IsNullOrWhiteSpace(name) &&
                                  string.Equals(name.Trim(), request.RecipeName.Trim(), StringComparison.OrdinalIgnoreCase);

                if (matchesId || matchesName)
                {
                    targetObj["image"] = imageUrl;
                    modified = true;
                }
            }
        }

        if (modified)
        {
            plan.ReplacePlanJson(root.ToJsonString());
            await plans.SaveAsync(plan, cancellationToken);
        }
    }
}