using Microsoft.Extensions.Localization;

namespace VitalityNutri.Tests;

/// <summary>Simple test localizer implementation for unit tests.</summary>
public sealed class TestLocalizer<T> : IStringLocalizer<T>
{
    public LocalizedString this[string name] => new(name, name);
    public LocalizedString this[string name, params object[] arguments] =>
        new(name, arguments.Length > 0 ? string.Format(name, arguments) : name);

    public IEnumerable<LocalizedString> GetAllStrings(bool includeParentCultures) => [];
}
