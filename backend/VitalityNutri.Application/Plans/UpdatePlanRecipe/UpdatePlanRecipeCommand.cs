using System.Text.Json;
using System.Text.Json.Nodes;
using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common;

namespace VitalityNutri.Application.Plans.UpdatePlanRecipe;

public sealed record UpdatePlanRecipeCommand(string Day, string Meal, JsonElement? Recipe) : IRequest<JsonElement?>;

internal sealed class UpdatePlanRecipeCommandValidator : AbstractValidator<UpdatePlanRecipeCommand>
{
    private static readonly string[] Days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    private static readonly string[] Meals = ["breakfast", "lunch", "snack", "dinner"];

    public UpdatePlanRecipeCommandValidator()
    {
        RuleFor(x => x.Day).Must(day => Days.Contains(day, StringComparer.OrdinalIgnoreCase));
        RuleFor(x => x.Meal).Must(meal => Meals.Contains(meal, StringComparer.OrdinalIgnoreCase));
    }
}

internal sealed class UpdatePlanRecipeCommandHandler(
    IPlanRepository repository,
    IPlanTranslationRepository translationRepository)
    : IRequestHandler<UpdatePlanRecipeCommand, JsonElement?>
{
    public async Task<JsonElement?> Handle(UpdatePlanRecipeCommand request, CancellationToken token)
    {
        var plan = await repository.GetActiveAsync(token);
        if (plan is null) return null;

        var root = JsonNode.Parse(plan.PlanJson) as JsonObject ?? throw new JsonException("Plan JSON must be an object.");
        var days = root["days"] as JsonObject ?? throw new JsonException("Plan JSON must contain days.");
        var day = days[request.Day.ToLowerInvariant()] as JsonObject ?? throw new JsonException("Plan day must be an object.");

        day[request.Meal.ToLowerInvariant()] = request.Recipe.HasValue
            ? JsonNode.Parse(request.Recipe.Value.GetRawText())
            : null;

        plan.ReplacePlanJson(root.ToJsonString());
        await repository.SaveAsync(plan, token);
        await translationRepository.InvalidateAsync(plan.Id, token);

        return JsonElementParser.Parse(plan.PlanJson);
    }
}