namespace VitalityNutri.Infrastructure.Processing.Ai;

public enum AiUsageOperation
{
    Unspecified = 0,
    PlanUploadText,
    PlanUploadVision,
    BatchCooking,
    RecipeText,
    RecipeVision,
    TranslationText,
    PlanTranslation
}

public sealed record AiUsageContext(
    AiUsageOperation Operation = AiUsageOperation.Unspecified,
    int SourceTextLength = 0)
{
    public static readonly AiUsageContext None = new();
}