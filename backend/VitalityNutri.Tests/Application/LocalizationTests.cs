using System.Globalization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Resources;

namespace VitalityNutri.Tests.Application;

public sealed class LocalizationTests
{
    private readonly IStringLocalizer<Messages> _localizer;

    public LocalizationTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddLocalization();
        var provider = services.BuildServiceProvider();
        _localizer = provider.GetRequiredService<IStringLocalizer<Messages>>();
    }

    [Theory]
    [InlineData("en", Messages.BackupInvalidFormat, "The backup format is invalid.")]
    [InlineData("es", Messages.BackupInvalidFormat, "El formato de la copia de seguridad no es válido.")]
    [InlineData("en", Messages.BatchCookingNoActivePlan, "No active plan is loaded.")]
    [InlineData("es", Messages.BatchCookingNoActivePlan, "No hay ningún plan activo cargado.")]
    [InlineData("en", Messages.RecipesMissingQuery, "Missing 'query' parameter.")]
    [InlineData("es", Messages.RecipesMissingQuery, "Falta el parámetro 'query'.")]
    [InlineData("en", Messages.RecipesNotFound, "Recipe not found.")]
    [InlineData("es", Messages.RecipesNotFound, "Receta no encontrada.")]
    [InlineData("en", Messages.CommonValidationFailed, "Validation failed")]
    [InlineData("es", Messages.CommonValidationFailed, "Error de validación")]
    [InlineData("en", Messages.CommonUnexpectedError, "An unexpected error occurred")]
    [InlineData("es", Messages.CommonUnexpectedError, "Ocurrió un error inesperado")]
    public void Messages_ReturnsExpectedTranslation_ForGivenCulture(string culture, string key, string expected)
    {
        CultureInfo.CurrentUICulture = new CultureInfo(culture);
        var actual = _localizer[key].Value;
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("en", 15, "The file exceeds the maximum allowed size of 15MB.")]
    [InlineData("es", 15, "El archivo supera el tamaño máximo permitido de 15MB.")]
    public void Messages_ReturnsFormattedTranslation_WithArguments(string culture, int sizeMb, string expected)
    {
        CultureInfo.CurrentUICulture = new CultureInfo(culture);
        var actual = _localizer[Messages.UploadsFileSizeExceeded, sizeMb].Value;
        Assert.Equal(expected, actual);
    }
}
