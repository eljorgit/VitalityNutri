using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Abstractions.Security;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Profile.ProviderKeys;

public sealed record AddProviderKeyCommand(
    string ProviderType,
    string Alias,
    string ApiKey,
    string? BaseUrl,
    bool ValidateImmediately = true) : IRequest<ProviderKeyDto>;

public sealed class AddProviderKeyCommandValidator : AbstractValidator<AddProviderKeyCommand>
{
    public AddProviderKeyCommandValidator()
    {
        RuleFor(x => x.ProviderType)
            .NotEmpty().WithMessage("Provider type is required.")
            .MaximumLength(50).WithMessage("Provider type cannot exceed 50 characters.");

        RuleFor(x => x.Alias)
            .NotEmpty().WithMessage("An alias is required to identify this key.")
            .MaximumLength(100).WithMessage("Alias cannot exceed 100 characters.");

        RuleFor(x => x.ApiKey)
            .NotEmpty().WithMessage("The API key is required.")
            .MaximumLength(512).WithMessage("API key cannot exceed 512 characters.");

        RuleFor(x => x.BaseUrl)
            .Must(u => u is null || Uri.TryCreate(u, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https")
            .WithMessage("Base URL must be an absolute http(s) URL.");
    }
}

public sealed class AddProviderKeyCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserAiSettingsRepository userAiSettingsRepository,
    IApiKeyProtector apiKeyProtector,
    IAiProviderCatalog aiProviderCatalog)
    : IRequestHandler<AddProviderKeyCommand, ProviderKeyDto>
{
    public async Task<ProviderKeyDto> Handle(AddProviderKeyCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot manage provider keys.");
        }

        var alias = request.Alias.Trim();
        if (await userAiSettingsRepository.AliasExistsAsync(userId, alias, null, cancellationToken))
        {
            throw new ConflictException($"You already have a key with the alias '{alias}'.");
        }

        if (request.ValidateImmediately)
        {
            var validation = await aiProviderCatalog.ValidateKeyAsync(
                request.ProviderType, request.ApiKey, request.BaseUrl, cancellationToken);
            if (!validation.IsValid)
            {
                throw new UnprocessableEntityException(validation.Error ?? "The API key was rejected by the provider.");
            }
        }

        var encrypted = apiKeyProtector.Protect(request.ApiKey);
        var last4 = request.ApiKey.Length <= 4 ? request.ApiKey : request.ApiKey[^4..];
        var key = new UserAiProviderKey(userId, request.ProviderType, alias, encrypted, last4, request.BaseUrl);

        if (request.ValidateImmediately)
        {
            key.MarkValidated();
        }

        await userAiSettingsRepository.AddKeyAsync(userId, key, cancellationToken);

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
