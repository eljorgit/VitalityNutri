using System.Text.Json;
using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Plans.GetActivePlan;

public sealed record GetActivePlanQuery : IRequest<PlanEnvelope?>;

public sealed record PlanEnvelope(JsonElement Plan, JsonElement Metadata);

internal sealed class GetActivePlanQueryHandler(IPlanRepository repository)
    : IRequestHandler<GetActivePlanQuery, PlanEnvelope?>
{
    public async Task<PlanEnvelope?> Handle(GetActivePlanQuery request, CancellationToken cancellationToken)
    {
        var entity = await repository.GetActiveAsync(cancellationToken);
        if (entity is null)
        {
            return null;
        }

        return new PlanEnvelope(
            JsonSerializer.Deserialize<JsonElement>(entity.PlanJson),
            JsonSerializer.Deserialize<JsonElement>(entity.MetadataJson));
    }
}
