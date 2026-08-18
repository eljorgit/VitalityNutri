namespace VitalityNutri.Application.Abstractions.Processing;

public interface IRecipeImageLookupService
{
    Task<IReadOnlyList<string>> SearchImagesAsync(string query, CancellationToken cancellationToken);
    Task<string> ResolveReplacementImageAsync(string recipeName, string mealType, IReadOnlyCollection<string> excludedUrls, CancellationToken cancellationToken);
    Task<string> ResolveContextualImageAsync(string recipeName, string mealType, CancellationToken cancellationToken);
}