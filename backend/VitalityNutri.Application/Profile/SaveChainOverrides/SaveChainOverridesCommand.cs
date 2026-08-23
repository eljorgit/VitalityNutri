using System.Text.Json;
using System.Text.RegularExpressions;
using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Profile.SaveChainOverrides;

public sealed record SaveChainOverridesCommand(IReadOnlyList<ChainOverrideInput> Overrides) : IRequest<AiSettingsDto>;

/// <param name="ChainName">One of the named chains (PlanText, PlanVision, ...).</param>
/// <param name="Tokens">Ordered entries: "#&lt;keyId&gt;:model" or "provider:model"; empty list clears the override.</param>
public sealed record ChainOverrideInput(string ChainName, IReadOnlyList<string> Tokens);

public sealed class SaveChainOverridesCommandValidator : AbstractValidator<SaveChainOverridesCommand>
{
    private static readonly Regex TokenPattern = new(@"^(#\d+|[A-Za-z0-9_-]+):.+$", RegexOptions.Compiled);

    public SaveChainOverridesCommandValidator()
    {
        RuleForEach(x => x.Overrides).ChildRules(o =>
        {
            o.RuleFor(x => x.ChainName)
                .Must(name => NamedAiChains.IsValid(name))
                .WithMessage("Unknown chain name; allowed: " + string.Join(", ", NamedAiChains.All) + ".");

            o.RuleFor(x => x.Tokens)
                .Must(tokens => tokens.Count <= 5)
                .WithMessage("A chain may contain at most 5 models.");

            o.RuleForEach(x => x.Tokens)
                .Matches(TokenPattern)
                .WithMessage("Each entry must be '#keyId:model' or 'provider:model'.");
        });

        RuleFor(x => x.Overrides)
            .Must(o => o.Select(i => i.ChainName.Trim()).Count() == o.Count)
            .WithMessage("Duplicate chain names are not allowed.");
    }
}

public sealed class SaveChainOverridesCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IAiUsageLedgerRepository aiUsageLedgerRepository,
    IAiCreditLimits aiCreditLimits)
    : IRequestHandler<SaveChainOverridesCommand, AiSettingsDto>
{
    public async Task<AiSettingsDto> Handle(SaveChainOverridesCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot change AI settings.");
        }

        // Validate that referenced #keyId tokens belong to this user before persisting.
        var ownedKeyIds = (await userAiSettingsRepository.GetKeysAsync(userId, cancellationToken))
            .Select(k => k.Id)
            .ToHashSet();

        foreach (var entry in request.Overrides.Where(o => o.Tokens.Count > 0))
        {
            foreach (var token in entry.Tokens)
            {
                if (!token.StartsWith('#'))
                {
                    continue;
                }

                var keyIdPart = token[1..].Split(':')[0];
                if (!long.TryParse(keyIdPart, out var keyId) || !ownedKeyIds.Contains(keyId))
                {
                    throw new NotFoundException($"Chain '{entry.ChainName}' references an unknown provider key #{keyIdPart}.");
                }
            }
        }

        var settings = await userAiSettingsRepository.EnsureSettingsAsync(userId, cancellationToken);
        settings.ReplaceChainOverrides(JsonSerializer.Serialize(
            request.Overrides.ToDictionary(o => o.ChainName.Trim(), o => o.Tokens)));
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
