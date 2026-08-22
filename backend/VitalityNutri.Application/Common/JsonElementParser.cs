using System.Text.Json;
namespace VitalityNutri.Application.Common;
public static class JsonElementParser { public static JsonElement Parse(string json) => JsonSerializer.Deserialize<JsonElement>(json); }