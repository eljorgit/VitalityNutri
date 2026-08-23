using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.AiSettings;

/// <summary>Credit costs per AI operation (platform AI only; BYOK bypasses quotas).</summary>
public static class AiCreditPolicy
{
    public const decimal PlanUploadCost = 3m;
    public const decimal BatchCookingCost = 2m;
    public const decimal RecipeAiCost = 1m;
    public const decimal TranslationCost = 0.25m;
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
