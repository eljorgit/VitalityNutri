using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.Profile.GetAiSettings;

public sealed record GetAiSettingsQuery : IRequest<AiSettingsDto>;

public sealed class GetAiSettingsQueryHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IAiUsageLedgerRepository aiUsageLedgerRepository,
    IAiCreditLimits aiCreditLimits)
    : IRequestHandler<GetAiSettingsQuery, AiSettingsDto>
{
    public async Task<AiSettingsDto> Handle(GetAiSettingsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("AI settings are not available in demo mode.");
        }

        var settings = await userAiSettingsRepository.EnsureSettingsAsync(userId, cancellationToken);
        var keys = await userAiSettingsRepository.GetKeysAsync(userId, cancellationToken);

        var weekStart = AiWeek.WeekStartUtc();
        var usage = await aiUsageLedgerRepository.GetOrCreateAsync(userId, weekStart, cancellationToken);

        return AiSettingsMapper.ToDto(
            settings,
            keys,
            aiCreditLimits.GetWeeklyPlatformLimit(),
            usage.CreditsUsed,
            weekStart);
    }
}
