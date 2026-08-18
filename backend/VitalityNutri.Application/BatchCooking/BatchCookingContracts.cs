using System.Text.Json;

namespace VitalityNutri.Application.BatchCooking;

public sealed record BatchCookingParams(
    int BurnersCount,
    bool HasOven,
    bool HasMicrowave,
    bool HasAirfryer,
    bool HasRobot,
    string CustomTools);

public sealed record BatchCookingResponse(JsonElement? Guide, JsonElement? Params);

public sealed record BatchCookingGenerateResult(bool Success, JsonElement Guide, JsonElement Params);

internal static class BatchCookingParamsComparer
{
    public static bool Matches(BatchCookingParams left, BatchCookingParams right) =>
        left.BurnersCount == right.BurnersCount &&
        left.HasOven == right.HasOven &&
        left.HasMicrowave == right.HasMicrowave &&
        left.HasAirfryer == right.HasAirfryer &&
        left.HasRobot == right.HasRobot &&
        string.Equals((left.CustomTools ?? string.Empty).Trim(), (right.CustomTools ?? string.Empty).Trim(), StringComparison.Ordinal);
}

internal static class BatchCookingJson
{
    public static JsonElement Parse(string json) => JsonSerializer.Deserialize<JsonElement>(json);
    public static string Serialize(JsonElement value) => JsonSerializer.Serialize(value);
}