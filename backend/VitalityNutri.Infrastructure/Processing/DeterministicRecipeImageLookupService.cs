using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Processing;

internal sealed partial class DeterministicRecipeImageLookupService(
    ApiConfiguration apiConfiguration,
    IHttpClientFactory httpClientFactory,
    ILogger<DeterministicRecipeImageLookupService> logger)
    : IRecipeImageLookupService
{
    private sealed record FoodCategoryMapping(string[] Keywords, string FallbackUrl, string SearchQuery);

    private static readonly FoodCategoryMapping[] FoodCategories =
    [
        // 1. Oats & Cereals
        new(["avena", "porridge", "gachas", "oatmeal", "muesli", "granola", "cereal", "cereales"],
            "https://images.unsplash.com/photo-1517881917430-e70dfb3610aa?q=80&w=1000&auto=format&fit=crop",
            "oatmeal bowl"),

        // 2. Pasta plates
        new(["pasta", "espagueti", "espaguetis", "macarrones", "tallarines", "lasana", "lasagna", "ravioles", "fideos", "noodles"],
            "https://images.unsplash.com/photo-1546549032-9571cd6b27df?q=80&w=1000&auto=format&fit=crop",
            "pasta spaghetti"),

        // 3. Rice & Quinoa plates
        new(["arroz", "paella", "risotto", "quinoa", "cuscus", "couscous"],
            "https://images.unsplash.com/photo-1534080564583-6be75777b70a?q=80&w=1000&auto=format&fit=crop",
            "risotto rice"),

        // 4. Pizza & Focaccia
        new(["pizza", "focaccia"],
            "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000&auto=format&fit=crop",
            "pizza"),

        // 5. Salads
        new(["ensalada", "salad", "cesar", "caesar"],
            "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1000&auto=format&fit=crop",
            "salad bowl"),

        // 6. Avocado dishes
        new(["aguacate", "avocado", "guacamole"],
            "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?q=80&w=1000&auto=format&fit=crop",
            "avocado toast"),

        // 7. Toast, Sandwiches, Pitufos & Bread
        new(["pitufo", "tostada", "tosta", "sandwich", "sandich", "bocadillo", "pulguita", "mollete", "panecillo", "pan"],
            "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?q=80&w=1000&auto=format&fit=crop",
            "healthy sandwich"),

        // 8. Pancakes & Crepes
        new(["tortitas", "pancakes", "crepes", "gofres", "waffles"],
            "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?q=80&w=1000&auto=format&fit=crop",
            "pancakes"),

        // 9. Eggs & Tortillas
        new(["huevo", "huevos", "tortilla", "revuelto", "poche", "pocha", "escalfado", "frito", "fritos", "omelet", "omelette"],
            "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=1000&auto=format&fit=crop",
            "eggs breakfast"),

        // 10. Salmon
        new(["salmon", "salmón"],
            "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop",
            "cooked salmon"),

        // 11. Other Fish & Seafood
        new(["pescado", "merluza", "bacalao", "lenguado", "lubina", "atun", "bonito", "emperador", "dorada", "trucha", "marisco", "pulpo", "gambas", "langostinos", "calamares"],
            "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=1000&auto=format&fit=crop",
            "fish meal"),

        // 12. Chicken & Poultry
        new(["pollo", "pavo", "pechuga", "alitas", "muslo", "ave"],
            "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=1000&auto=format&fit=crop",
            "grilled chicken"),

        // 13. Meat (Beef, pork, etc.)
        new(["carne", "ternera", "cerdo", "bistec", "filete", "lomo", "entrecot", "solomillo", "hamburguesa", "albondigas", "jamon", "beef", "steak"],
            "https://images.unsplash.com/photo-1532550907401-a500c9a57435?q=80&w=1000&auto=format&fit=crop",
            "steak beef"),

        // 14. Soups, Caldos & Creams
        new(["sopa", "crema", "caldo", "gazpacho", "salmorejo", "pure", "crema de"],
            "https://images.unsplash.com/photo-1547592165-e1d17fed6005?q=80&w=1000&auto=format&fit=crop",
            "vegetable soup"),

        // 15. Yogurt & Dairy
        new(["yogur", "yogurt", "kefir", "cuajada"],
            "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1000&auto=format&fit=crop",
            "yogurt bowl"),

        // 16. Smoothies & Shakes
        new(["batido", "smoothie", "licuado", "shake"],
            "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=1000&auto=format&fit=crop",
            "smoothie"),

        // 17. Fruits
        new(["fruta", "fresas", "fresa", "platano", "manzana", "pera", "naranja", "kiwi", "uvas", "melocoton", "bayas", "arandanos", "frutas"],
            "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?q=80&w=1000&auto=format&fit=crop",
            "fruit platter"),

        // 18. Nuts & Seeds
        new(["frutos secos", "nueces", "almendras", "avellanas", "cacahuetes", "pistachos", "semillas", "chia", "pipas"],
            "https://images.unsplash.com/photo-1596701062351-df5f8a42f3c5?q=80&w=1000&auto=format&fit=crop",
            "mixed nuts"),

        // 19. Hummus & Dips
        new(["hummus", "dip", "pate"],
            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?q=80&w=1000&auto=format&fit=crop",
            "hummus"),

        // 20. Wraps & Tacos
        new(["wrap", "taco", "tacos", "burrito", "fajita", "fajitas", "quesadilla"],
            "https://images.unsplash.com/photo-1626700051175-6518c4793f73?q=80&w=1000&auto=format&fit=crop",
            "tacos wrap"),

        // 21. Coffee & Tea
        new(["cafe", "te", "infusion", "manzanilla", "poleo", "coffee", "tea"],
            "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1000&auto=format&fit=crop",
            "tea coffee cup"),

        // 22. Cheese
        new(["queso", "cottage", "requeson", "burgos", "mozzarella", "feta", "cheese"],
            "https://images.unsplash.com/photo-1486887396153-fa416525c108?q=80&w=1000&auto=format&fit=crop",
            "cheese plate"),

        // 23. General Veggies & Greens
        new(["verduras", "verdura", "vegetales", "espinacas", "espinaca", "brocoli", "calabacin", "berenjena", "pimiento", "zanahoria", "champinones", "champinon", "setas", "puerro", "apio", "esparragos"],
            "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop",
            "cooked vegetables")
    ];

    private static readonly string[] StaticFallbackImages =
    [
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1484723091739-30a097e8f929?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=1000&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop"
    ];

    public async Task<string> ResolveContextualImageAsync(string recipeName, string mealType, CancellationToken cancellationToken)
    {
        var categoryMatch = FindMatchingCategory(recipeName);
        var fallbackUrl = categoryMatch?.FallbackUrl ?? GetMealTypeFallback(mealType);

        var accessKey = apiConfiguration.ExternalServices.Unsplash.AccessKey;
        if (!string.IsNullOrWhiteSpace(accessKey))
        {
            var query = categoryMatch?.SearchQuery ?? GetSearchQueryForMeal(recipeName, mealType);
            try
            {
                var searchResults = await SearchUnsplashLiveAsync(query, accessKey, cancellationToken);
                if (searchResults.Count > 0)
                {
                    return searchResults[0];
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[ImageLookup] Error fetching contextual image from Unsplash for query '{Query}'. Using fallback.", query);
            }
        }

        return fallbackUrl;
    }

    public async Task<IReadOnlyList<string>> SearchImagesAsync(string query, CancellationToken cancellationToken)
    {
        var accessKey = apiConfiguration.ExternalServices.Unsplash.AccessKey;
        if (!string.IsNullOrWhiteSpace(accessKey))
        {
            try
            {
                var liveResults = await SearchUnsplashLiveAsync(query, accessKey, cancellationToken);
                if (liveResults.Count > 0)
                {
                    return liveResults;
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[ImageLookup] Failed querying live Unsplash API for query '{Query}'. Falling back to scraper.", query);
            }
        }

        var scraped = await ScrapeUnsplashImagesAsync(query, cancellationToken);
        if (scraped.Count > 0)
        {
            return scraped;
        }

        return FallbackSearch(query);
    }

    [System.Text.RegularExpressions.GeneratedRegex(@"https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9\-]+")]
    private static partial System.Text.RegularExpressions.Regex UnsplashPhotoUrlRegex();

    private async Task<IReadOnlyList<string>> ScrapeUnsplashImagesAsync(string query, CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("es-ES,es;q=0.9,en;q=0.8");

            var url = $"https://unsplash.com/s/photos/{Uri.EscapeDataString(query)}";
            using var response = await client.GetAsync(url, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return [];
            }

            var html = await response.Content.ReadAsStringAsync(cancellationToken);
            var matches = UnsplashPhotoUrlRegex().Matches(html);
            if (matches.Count == 0)
            {
                return [];
            }

            var unique = matches
                .Select(m => m.Value)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(imgUrl => $"{imgUrl.Split('?')[0]}?auto=format&fit=crop&w=1000&q=80")
                .Take(12)
                .ToArray();

            return unique;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[ImageLookup] Error scraping Unsplash for query '{Query}'.", query);
            return [];
        }
    }

    public async Task<string> ResolveReplacementImageAsync(string recipeName, string mealType, IReadOnlyCollection<string> excludedUrls, CancellationToken cancellationToken)
    {
        var categoryMatch = FindMatchingCategory(recipeName);
        var query = categoryMatch?.SearchQuery ?? $"{recipeName} {mealType}".Trim();
        var searchResults = await SearchImagesAsync(query, cancellationToken);

        var candidate = searchResults.FirstOrDefault(url => !excludedUrls.Contains(url, StringComparer.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(candidate))
        {
            return candidate;
        }

        if (categoryMatch is not null && !excludedUrls.Contains(categoryMatch.FallbackUrl, StringComparer.OrdinalIgnoreCase))
        {
            return categoryMatch.FallbackUrl;
        }

        var mealFallback = GetMealTypeFallback(mealType);
        if (!excludedUrls.Contains(mealFallback, StringComparer.OrdinalIgnoreCase))
        {
            return mealFallback;
        }

        var normalized = Normalize(recipeName + " " + mealType);
        var offset = normalized.Length == 0 ? 0 : normalized.Sum(ch => ch) % StaticFallbackImages.Length;

        return Enumerable.Range(0, StaticFallbackImages.Length)
            .Select(index => StaticFallbackImages[(index + offset) % StaticFallbackImages.Length])
            .FirstOrDefault(url => !excludedUrls.Contains(url, StringComparer.OrdinalIgnoreCase)) ?? StaticFallbackImages[0];
    }

    private async Task<IReadOnlyList<string>> SearchUnsplashLiveAsync(string query, string accessKey, CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Client-ID", accessKey);
        var url = $"https://api.unsplash.com/search/photos?query={Uri.EscapeDataString(query)}&per_page=12&orientation=landscape";
        using var response = await client.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return [];
        }

        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("results", out var results) || results.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var urls = new List<string>();
        foreach (var item in results.EnumerateArray())
        {
            if (item.TryGetProperty("urls", out var urlsObj) && urlsObj.TryGetProperty("regular", out var regularUrl))
            {
                var regular = regularUrl.GetString();
                if (!string.IsNullOrWhiteSpace(regular))
                {
                    urls.Add(regular);
                }
            }
        }

        return urls;
    }

    private static FoodCategoryMapping? FindMatchingCategory(string recipeName)
    {
        var normalizedName = Normalize(recipeName);
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return null;
        }

        foreach (var category in FoodCategories)
        {
            foreach (var keyword in category.Keywords)
            {
                var normalizedKeyword = Normalize(keyword);
                if (normalizedName.Contains(normalizedKeyword, StringComparison.OrdinalIgnoreCase))
                {
                    return category;
                }
            }
        }

        return null;
    }

    private static string GetMealTypeFallback(string mealType) => mealType.ToLowerInvariant() switch
    {
        "breakfast" => "https://images.unsplash.com/photo-1496042399014-dc73c4f2bde1?q=80&w=1000&auto=format&fit=crop", // breakfast table
        "lunch" => "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop",     // salad/bowl
        "snack" => "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?q=80&w=1000&auto=format&fit=crop",     // snack platter
        "dinner" => "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1000&auto=format&fit=crop",    // dinner plate
        _ => "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop"
    };

    private static string GetSearchQueryForMeal(string recipeName, string mealType) => mealType.ToLowerInvariant() switch
    {
        "breakfast" => "healthy breakfast",
        "lunch" => "healthy lunch",
        "snack" => "healthy snack",
        "dinner" => "healthy dinner",
        _ => string.IsNullOrWhiteSpace(recipeName) ? "healthy food" : recipeName
    };

    private static IReadOnlyList<string> FallbackSearch(string query)
    {
        var categoryMatch = FindMatchingCategory(query);
        if (categoryMatch is not null)
        {
            return [categoryMatch.FallbackUrl, .. StaticFallbackImages];
        }

        var normalized = Normalize(query);
        if (normalized.Length == 0)
        {
            return StaticFallbackImages;
        }

        var offset = normalized.Sum(ch => ch) % StaticFallbackImages.Length;
        return Enumerable.Range(0, StaticFallbackImages.Length)
            .Select(index => StaticFallbackImages[(index + offset) % StaticFallbackImages.Length])
            .ToArray();
    }

    private static string Normalize(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character) || char.IsWhiteSpace(character))
            {
                builder.Append(char.ToLowerInvariant(character));
            }
        }

        return builder.ToString().Trim();
    }
}