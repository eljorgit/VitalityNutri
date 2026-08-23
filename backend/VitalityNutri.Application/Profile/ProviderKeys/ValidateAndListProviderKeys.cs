using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Abstractions.Security;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.Profile.ProviderKeys;

public sealed record ValidateProviderKeyCommand(long KeyId) : IRequest<ProviderKeyDto>;

public sealed class ValidateProviderKeyCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IApiKeyProtector apiKeyProtector,
    IAiProviderCatalog aiProviderCatalog)
    : IRequestHandler<ValidateProviderKeyCommand, ProviderKeyDto>
{
    public async Task<ProviderKeyDto> Handle(ValidateProviderKeyCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot manage provider keys.");
        }

        var key = await userAiSettingsRepository.GetKeyAsync(userId, request.KeyId, cancellationToken)
            ?? throw new NotFoundException("Provider key not found.");

        var apiKey = apiKeyProtector.Unprotect(key.EncryptedApiKey) ?? string.Empty;
        var validation = await aiProviderCatalog.ValidateKeyAsync(
            key.ProviderType, apiKey, key.BaseUrl, cancellationToken);

        if (!validation.IsValid)
        {
            throw new UnprocessableEntityException(validation.Error ?? "The API key was rejected by the provider.");
        }

        key.MarkValidated();
        await userAiSettingsRepository.UpdateKeyAsync(key, cancellationToken);

        return new ProviderKeyDto(
            key.Id,
            key.ProviderType,
            key.Alias,
            $"••••{key.KeyLast4}",
            key.BaseUrl,
            key.IsValidated,
            key.ValidatedAtUtc,
            key.CreatedAtUtc);
    }
}

public sealed record ListProviderModelsQuery(long KeyId) : IRequest<IReadOnlyList<string>>;

public sealed class ListProviderModelsQueryHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IApiKeyProtector apiKeyProtector,
    IAiProviderCatalog aiProviderCatalog)
    : IRequestHandler<ListProviderModelsQuery, IReadOnlyList<string>>
{
    public async Task<IReadOnlyList<string>> Handle(ListProviderModelsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot use provider keys.");
        }

        var key = await userAiSettingsRepository.GetKeyAsync(userId, request.KeyId, cancellationToken)
            ?? throw new NotFoundException("Provider key not found.");

        try
        {
            return await aiProviderCatalog.ListModelsAsync(
                key.ProviderType,
                apiKeyProtector.Unprotect(key.EncryptedApiKey) ?? string.Empty,
                key.BaseUrl,
                cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            throw new UnprocessableEntityException(ex.Message);
        }
    }
}
