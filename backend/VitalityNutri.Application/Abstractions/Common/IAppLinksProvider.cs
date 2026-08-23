namespace VitalityNutri.Application.Abstractions.Common;

/// <summary>Provides public application URLs for links embedded in transactional emails.</summary>
public interface IAppLinksProvider
{
    string GetPublicBaseUrl();
}
