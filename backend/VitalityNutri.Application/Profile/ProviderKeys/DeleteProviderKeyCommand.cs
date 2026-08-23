using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Profile.ProviderKeys;

public sealed record DeleteProviderKeyCommand(long KeyId) : IRequest<DeleteProviderKeyResultDto>;

public sealed record DeleteProviderKeyResultDto(bool Deleted, bool RemovedFromChains);

public sealed class DeleteProviderKeyCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository)
    : IRequestHandler<DeleteProviderKeyCommand, DeleteProviderKeyResultDto>
{
    public async Task<DeleteProviderKeyResultDto> Handle(DeleteProviderKeyCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot manage provider keys.");
        }

        var key = await userAiSettingsRepository.GetKeyAsync(userId, request.KeyId, cancellationToken)
            ?? throw new NotFoundException("Provider key not found.");

        // Strip any chain override tokens referencing this key so chains never dangle.
        var settings = await userAiSettingsRepository.EnsureSettingsAsync(userId, cancellationToken);
        var removed = ChainOverrideRewriter.StripKeyReferences(settings, key.Id);
        if (removed)
        {
            await userAiSettingsRepository.UpdateAsync(settings, cancellationToken);
        }

        await userAiSettingsRepository.DeleteKeyAsync(userId, key.Id, cancellationToken);

        return new DeleteProviderKeyResultDto(true, removed);
    }
}

/// <summary>Shared helper: removes "#&lt;keyId&gt;:" tokens from a settings entity's overrides JSON.</summary>
internal static class ChainOverrideRewriter
{
    public static bool StripKeyReferences(UserAiSettings settings, long keyId)
    {
        var tokenPrefix = $"#{keyId}:";
        var changed = false;

        Dictionary<string, System.Text.Json.JsonElement>? parsed = null;
        try
        {
            parsed = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, System.Text.Json.JsonElement>>(
                settings.ChainOverridesJson);
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }

        if (parsed is null || parsed.Count == 0)
        {
            return false;
        }

        var rebuilt = new Dictionary<string, IReadOnlyList<string>>();
        foreach (var (chain, element) in parsed)
        {
            if (element.ValueKind != System.Text.Json.JsonValueKind.Array)
            {
                continue;
            }

            var original = element.EnumerateArray()
                .Where(e => e.ValueKind == System.Text.Json.JsonValueKind.String)
                .Select(e => e.GetString()!)
                .ToList();

            var remaining = original
                .Where(s => !s.StartsWith(tokenPrefix, StringComparison.Ordinal))
                .ToList();

            // Nothing was stripped from this chain: preserve it verbatim.
            if (remaining.Count == original.Count)
            {
                if (remaining.Count > 0)
                {
                    rebuilt[chain] = remaining;
                }

                continue;
            }

            // A token was stripped. Keep the chain only if it still has models left.
            changed = true;
            if (remaining.Count > 0)
            {
                rebuilt[chain] = remaining;
            }
        }

        if (changed)
        {
            settings.ReplaceChainOverrides(System.Text.Json.JsonSerializer.Serialize(rebuilt));
        }

        return changed;
    }
}
