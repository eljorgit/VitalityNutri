namespace VitalityNutri.Application.Resources;

/// <summary>
/// Marker class and strongly-typed keys for localized messages across the API and Application layers.
/// </summary>
public sealed class Messages
{
    public const string BackupInvalidFormat = "Backup_InvalidFormat";
    public const string BatchCookingNoActivePlan = "BatchCooking_NoActivePlan";
    public const string BatchCookingMissingParams = "BatchCooking_MissingParams";
    public const string RecipesMissingQuery = "Recipes_MissingQuery";
    public const string RecipesIdRequired = "Recipes_IdRequired";
    public const string RecipesInvalidParamsOrFileData = "Recipes_InvalidParamsOrFileData";
    public const string RecipesInvalidId = "Recipes_InvalidId";
    public const string RecipesNotFound = "Recipes_NotFound";
    public const string RecipesMissingRequiredFields = "Recipes_MissingRequiredFields";
    public const string SearchMissingFields = "Search_MissingFields";
    public const string SearchInvalidId = "Search_InvalidId";
    public const string UploadsMissingFileNameOrData = "Uploads_MissingFileNameOrData";
    public const string UploadsOnlyPdfSupported = "Uploads_OnlyPdfSupported";
    public const string UploadsFileSizeExceeded = "Uploads_FileSizeExceeded";
    public const string UploadsNoFileToReprocess = "Uploads_NoFileToReprocess";
    public const string UploadsOriginalFileNotFound = "Uploads_OriginalFileNotFound";
    public const string CommonValidationFailed = "Common_ValidationFailed";
    public const string CommonUnexpectedError = "Common_UnexpectedError";
}
