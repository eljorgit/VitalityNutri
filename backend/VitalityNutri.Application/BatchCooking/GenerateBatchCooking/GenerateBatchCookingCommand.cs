using System.Text.Json;
using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.BatchCooking.GenerateBatchCooking;

public sealed record GenerateBatchCookingCommand(BatchCookingParams Params, bool ForceRegenerate) : IRequest<BatchCookingGenerateResult?>;

internal sealed class GenerateBatchCookingCommandValidator : AbstractValidator<GenerateBatchCookingCommand>
{
    public GenerateBatchCookingCommandValidator()
    {
        RuleFor(x => x.Params.BurnersCount).InclusiveBetween(1, 12);
        RuleFor(x => x.Params.CustomTools).MaximumLength(500);
    }
}

internal sealed class GenerateBatchCookingCommandHandler(IPlanRepository plans, IBatchCookingRepository batch)
    : IRequestHandler<GenerateBatchCookingCommand, BatchCookingGenerateResult?>
{
    private static readonly string[] Days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    private static readonly string[] Meals = ["lunch", "dinner"];

    public async Task<BatchCookingGenerateResult?> Handle(GenerateBatchCookingCommand request, CancellationToken cancellationToken)
    {
        var active = await plans.GetActiveAsync(cancellationToken);
        if (active is null)
        {
            return null;
        }

        var cached = await batch.GetByPlanIdAsync(active.Id, cancellationToken);
        if (!request.ForceRegenerate && cached is not null)
        {
            var cachedParams = JsonSerializer.Deserialize<BatchCookingParams>(cached.ParamsJson);
            if (cachedParams is not null && BatchCookingParamsComparer.Matches(cachedParams, request.Params))
            {
                return new BatchCookingGenerateResult(true, BatchCookingJson.Parse(cached.GuideJson), BatchCookingJson.Parse(cached.ParamsJson));
            }
        }

        var guide = BuildGuide(active.PlanJson, request.Params);
        var state = new BatchCookingState(active.Id, BatchCookingJson.Serialize(guide), JsonSerializer.Serialize(request.Params));
        await batch.SaveAsync(state, cancellationToken);

        return new BatchCookingGenerateResult(true, guide, JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(request.Params)));
    }

    private static JsonElement BuildGuide(string planJson, BatchCookingParams parameters)
    {
        var utensils = GetUtensils(parameters);
        var recipes = ExtractRecipes(planJson);
        var stepRows = recipes.Select((recipe, index) => new
        {
            stepNumber = index + 1,
            title = $"Preparar {recipe.RecipeName}",
            description = $"Cocina y porciona {recipe.RecipeName} para {recipe.Day}/{recipe.Meal}.",
            duration = "20 min",
            utensils,
            recipesAffected = new[] { new { id = recipe.Id, name = recipe.RecipeName } },
            ingredients = recipe.IngredientNames,
        }).ToArray();

        var storage = new[]
        {
            new
            {
                preparation = "Enfriar y porcionar en recipientes individuales.",
                container = "Hermético de vidrio o BPA-free",
                duration = "3-4 días en refrigeración",
                freezable = true,
                reheatingAndTips = "Recalentar en microondas u horno según textura del plato."
            }
        };

        var guide = new
        {
            introduction = "Guía de batch cooking generada a partir del plan activo.",
            prepTime = $"{Math.Max(45, stepRows.Length * 20)} min",
            steps = stepRows,
            storageTips = storage,
        };

        return JsonSerializer.Deserialize<JsonElement>(JsonSerializer.Serialize(guide));
    }

    private static string[] GetUtensils(BatchCookingParams parameters)
    {
        var utensils = new List<string> { "cuchillo", "tabla", $"{parameters.BurnersCount} fogones" };
        if (parameters.HasOven) utensils.Add("horno");
        if (parameters.HasMicrowave) utensils.Add("microondas");
        if (parameters.HasAirfryer) utensils.Add("airfryer");
        if (parameters.HasRobot) utensils.Add("robot de cocina");
        if (!string.IsNullOrWhiteSpace(parameters.CustomTools)) utensils.Add(parameters.CustomTools.Trim());
        return utensils.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
    }

    private static IReadOnlyList<(long? Id, string RecipeName, string Day, string Meal, string[] IngredientNames)> ExtractRecipes(string planJson)
    {
        var results = new List<(long? Id, string RecipeName, string Day, string Meal, string[] IngredientNames)>();

        try
        {
            using var doc = JsonDocument.Parse(planJson);
            if (!doc.RootElement.TryGetProperty("days", out var daysElement) || daysElement.ValueKind != JsonValueKind.Object)
            {
                return results;
            }

            foreach (var day in Days)
            {
                if (!daysElement.TryGetProperty(day, out var dayElement) || dayElement.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                foreach (var meal in Meals)
                {
                    if (!dayElement.TryGetProperty(meal, out var recipeElement) || recipeElement.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    var name = ReadString(recipeElement, "recipeName");
                    if (string.IsNullOrWhiteSpace(name))
                    {
                        continue;
                    }

                    results.Add((ReadLong(recipeElement, "id"), name, day, meal, ReadIngredients(recipeElement)));
                }
            }
        }
        catch (JsonException)
        {
            return results;
        }

        return results;
    }

    private static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property) || property.ValueKind != JsonValueKind.String)
        {
            return string.Empty;
        }

        return property.GetString() ?? string.Empty;
    }

    private static long? ReadLong(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetInt64(out var numericValue))
        {
            return numericValue;
        }

        return null;
    }

    private static string[] ReadIngredients(JsonElement recipeElement)
    {
        if (!recipeElement.TryGetProperty("ingredients", out var ingredients))
        {
            return [];
        }

        if (ingredients.ValueKind == JsonValueKind.Array)
        {
            return ReadArray(ingredients);
        }

        if (ingredients.ValueKind == JsonValueKind.Object)
        {
            return ingredients.EnumerateObject()
                .Where(property => property.Value.ValueKind == JsonValueKind.Array)
                .SelectMany(property => ReadArray(property.Value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        return [];
    }

    private static string[] ReadArray(JsonElement ingredients)
    {
        return ingredients.EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.Object && item.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
            .Select(item => item.GetProperty("name").GetString() ?? string.Empty)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToArray();
    }
}