using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.AiSettings;

/// <summary>Credit costs per AI operation (platform AI only; BYOK bypasses quotas).</summary>
public static class AiCreditPolicy
{
    public const decimal PlanUploadTextCost = 2m;
    public const decimal PlanUploadVisionCost = 3m;
    public const decimal BatchCookingCost = 2m;
    public const decimal RecipeTextMinCost = 0.25m;
    public const decimal RecipeTextMaxCost = 1m;
    public const decimal RecipeVisionCost = 3m;
    public const decimal TranslationTextCost = 0.1m;
    public const decimal PlanTranslationCost = 0.5m;

    public static decimal GetRecipeTextCost(int sourceTextLength)
    {
        if (sourceTextLength <= 500)
        {
            return 0.25m;
        }

        if (sourceTextLength <= 1500)
        {
            return 0.5m;
        }

        if (sourceTextLength <= 3000)
        {
            return 0.75m;
        }

        return 1m;
    }
}

/// <summary>Thrown when the weekly platform-AI credit allowance is exhausted.</summary>
public sealed class AiCreditsExhaustedException(string message)
    : VitalityNutri.Application.Common.Exceptions.UnprocessableEntityException(message);

/// <summary>ISO-week helpers shared by ledger consumers.</summary>
public static class AiWeek
{
    /// <summary>Returns Monday (UTC) of the week containing <paramref name="utcNow"/>.</summary>
    public static DateOnly WeekStartUtc(DateTimeOffset? utcNow = null)
    {
        var date = (utcNow ?? DateTimeOffset.UtcNow).UtcDateTime.Date;
        var daysSinceMonday = ((int)date.DayOfWeek + 6) % 7;
        return DateOnly.FromDateTime(date.AddDays(-daysSinceMonday));
    }
}
