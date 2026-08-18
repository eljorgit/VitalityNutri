using System.Text.Json;
namespace VitalityNutri.Application.Common;
internal static class JsonElementParser { public static JsonElement Parse(string json) => JsonSerializer.Deserialize<JsonElement>(json); }