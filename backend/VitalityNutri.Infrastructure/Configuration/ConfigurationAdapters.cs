using Microsoft.Extensions.Options;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Processing;

namespace VitalityNutri.Infrastructure.Configuration;

internal sealed class ConfigAiCreditLimits(IOptions<ApiConfiguration> options) : IAiCreditLimits
{
    public decimal GetWeeklyPlatformLimit() => options.Value.Ai.Credits.WeeklyPlatformLimit;
}

public sealed class ConfigAppLinksProvider(IOptions<ApiConfiguration> options) : IAppLinksProvider
{
    public string GetPublicBaseUrl()
    {
        var value = options.Value.Email.Links.PublicBaseUrl;
        return string.IsNullOrWhiteSpace(value) ? string.Empty : value.TrimEnd('/');
    }
}
