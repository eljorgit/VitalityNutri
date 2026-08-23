using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Profile.SetAiMode;

public sealed record SetAiModeCommand(string Mode) : IRequest<AiSettingsDto>;

public sealed class SetAiModeCommandValidator : AbstractValidator<SetAiModeCommand>
{
    public SetAiModeCommandValidator()
    {
        RuleFor(x => x.Mode)
            .Must(m => m is UserAiSettings.ModePlatform or UserAiSettings.ModeByok)
            .WithMessage("AI mode must be 'Platform' or 'Byok'.");
    }
}

public sealed class SetAiModeCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IAiUsageLedgerRepository aiUsageLedgerRepository,
    IAiCreditLimits aiCreditLimits)
    : IRequestHandler<SetAiModeCommand, AiSettingsDto>
{
    public async Task<AiSettingsDto> Handle(SetAiModeCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot change AI settings.");
        }

        var settings = await userAiSettingsRepository.EnsureSettingsAsync(userId, cancellationToken);
        settings.SetMode(request.Mode);
        await userAiSettingsRepository.UpdateAsync(settings, cancellationToken);

        var keys = await userAiSettingsRepository.GetKeysAsync(userId, cancellationToken);
        var usage = await aiUsageLedgerRepository.GetOrCreateAsync(userId, AiWeek.WeekStartUtc(), cancellationToken);

        return AiSettingsMapper.ToDto(
            settings,
            keys,
            aiCreditLimits.GetWeeklyPlatformLimit(),
            usage.CreditsUsed,
            AiWeek.WeekStartUtc());
    }
}
