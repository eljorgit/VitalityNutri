using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Abstractions.Security;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.Profile.ProviderKeys;

public sealed record UpdateProviderKeyCommand(
    long KeyId,
    string? Alias,
    string? ApiKey,
    string? BaseUrl,
    bool ValidateImmediately = true) : IRequest<ProviderKeyDto>;

public sealed class UpdateProviderKeyCommandValidator : AbstractValidator<UpdateProviderKeyCommand>
{
    public UpdateProviderKeyCommandValidator()
    {
        RuleFor(x => x.Alias)
            .MaximumLength(100).WithMessage("Alias cannot exceed 100 characters.")
            .When(x => x.Alias is not null);

        RuleFor(x => x.ApiKey)
            .NotEmpty().WithMessage("API key cannot be empty when provided.")
            .MaximumLength(512).WithMessage("API key cannot exceed 512 characters.")
            .When(x => x.ApiKey is not null);

        RuleFor(x => x.BaseUrl)
            .Must(u => u is null || Uri.TryCreate(u, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https")
            .WithMessage("Base URL must be an absolute http(s) URL.")
            .When(x => x.BaseUrl is not null);
    }
}

public sealed class UpdateProviderKeyCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IApiKeyProtector apiKeyProtector,
    IAiProviderCatalog aiProviderCatalog)
    : IRequestHandler<UpdateProviderKeyCommand, ProviderKeyDto>
{
    public async Task<ProviderKeyDto> Handle(UpdateProviderKeyCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot manage provider keys.");
        }

        var key = await userAiSettingsRepository.GetKeyAsync(userId, request.KeyId, cancellationToken)
            ?? throw new NotFoundException("Provider key not found.");

        if (request.Alias is not null)
        {
            var alias = request.Alias.Trim();
            if (alias.Length == 0)
            {
                throw new UnprocessableEntityException("Alias cannot be empty.");
            }

            if (await userAiSettingsRepository.AliasExistsAsync(userId, alias, key.Id, cancellationToken))
            {
                throw new ConflictException($"You already have a key with the alias '{alias}'.");
            }

            key.UpdateAlias(alias);
        }

        if (request.BaseUrl is not null)
        {
            key.UpdateBaseUrl(request.BaseUrl);
        }

        if (!string.IsNullOrWhiteSpace(request.ApiKey))
        {
            if (request.ValidateImmediately)
            {
                var validation = await aiProviderCatalog.ValidateKeyAsync(
                    key.ProviderType, request.ApiKey, key.BaseUrl, cancellationToken);
                if (!validation.IsValid)
                {
                    throw new UnprocessableEntityException(validation.Error ?? "The API key was rejected by the provider.");
                }
            }

            var encrypted = apiKeyProtector.Protect(request.ApiKey);
            var last4 = request.ApiKey.Length <= 4 ? request.ApiKey : request.ApiKey[^4..];
            key.UpdateKey(encrypted, last4);

            if (request.ValidateImmediately)
            {
                key.MarkValidated();
            }
        }
        else
        {
            await userAiSettingsRepository.UpdateKeyAsync(key, cancellationToken);
        }

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
