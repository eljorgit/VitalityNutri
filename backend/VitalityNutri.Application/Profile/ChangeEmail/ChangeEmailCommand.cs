using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Notifications;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Application.Common.Security;
using VitalityNutri.Application.Notifications;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Profile.ChangeEmail;

public sealed record ChangeEmailCommand(string NewEmail, string? CurrentPassword) : IRequest<ChangeEmailResultDto>;

public sealed record ChangeEmailResultDto(bool VerificationEmailSent);

public sealed class ChangeEmailCommandValidator : AbstractValidator<ChangeEmailCommand>
{
    public ChangeEmailCommandValidator()
    {
        RuleFor(x => x.NewEmail)
            .NotEmpty().WithMessage("The new email address is required.")
            .EmailAddress().WithMessage("A valid email address is required.")
            .MaximumLength(255).WithMessage("Email cannot exceed 255 characters.");
    }
}

public sealed class ChangeEmailCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserRepository userRepository,
    IUserVerificationTokenRepository verificationTokenRepository,
    IEmailSender emailSender,
    ICurrentLanguageProvider currentLanguageProvider,
    IAppLinksProvider appLinksProvider)
    : IRequestHandler<ChangeEmailCommand, ChangeEmailResultDto>
{
    public async Task<ChangeEmailResultDto> Handle(ChangeEmailCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot change their email address.");
        }

        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("User not found.");

        var normalizedNewEmail = request.NewEmail.Trim().ToLowerInvariant();
        if (string.Equals(normalizedNewEmail, user.Email, StringComparison.Ordinal))
        {
            throw new ConflictException("This is already your current email address.");
        }

        if (await userRepository.EmailExistsAsync(normalizedNewEmail, cancellationToken))
        {
            throw new ConflictException("An account with this email address already exists.");
        }

        var language = currentLanguageProvider.GetCurrentLanguage();
        var rawToken = VerificationTokenFactory.GenerateRawToken();
        var token = new UserVerificationToken(
            user.Id,
            UserVerificationToken.TypeEmailChange,
            VerificationTokenFactory.HashToken(rawToken),
            normalizedNewEmail,
            TimeSpan.FromHours(24));

        await verificationTokenRepository.InvalidateAllAsync(user.Id, UserVerificationToken.TypeEmailChange, cancellationToken);
        await verificationTokenRepository.AddAsync(token, cancellationToken);

        var confirmationUrl = $"{appLinksProvider.GetPublicBaseUrl().TrimEnd('/')}/verify-email?token={Uri.EscapeDataString(rawToken)}";
        await emailSender.SendAsync(
            normalizedNewEmail,
            AccountEmailTemplates.EmailChangeSubject(language),
            AccountEmailTemplates.EmailChangeBody(language, user.FullName, normalizedNewEmail, confirmationUrl),
            cancellationToken);

        return new ChangeEmailResultDto(true);
    }
}
