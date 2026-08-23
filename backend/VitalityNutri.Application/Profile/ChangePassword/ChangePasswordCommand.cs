using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Notifications;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Application.Common.Security;
using VitalityNutri.Application.Notifications;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Profile.ChangePassword;

public sealed record ChangePasswordCommand(string CurrentPassword, string NewPassword) : IRequest<ChangePasswordResultDto>;

public sealed record ChangePasswordResultDto(bool PasswordChanged);

public sealed class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Your current password is required.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("The new password is required.")
            .MinimumLength(6).WithMessage("Password must be at least 6 characters long.")
            .MaximumLength(128).WithMessage("Password cannot exceed 128 characters.");
    }
}

public sealed class ChangePasswordCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserRepository userRepository,
    IPasswordHasher passwordHasher,
    IEmailSender emailSender,
    ICurrentLanguageProvider currentLanguageProvider)
    : IRequestHandler<ChangePasswordCommand, ChangePasswordResultDto>
{
    public async Task<ChangePasswordResultDto> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot change their password.");
        }

        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("User not found.");

        if (!string.Equals(user.AuthProvider, "local", StringComparison.OrdinalIgnoreCase))
        {
            throw new UnprocessableEntityException("This account uses social sign-in and has no local password.");
        }

        if (!passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash, user.PasswordSalt))
        {
            throw new UnprocessableEntityException("Your current password is incorrect.");
        }

        var (hash, salt) = passwordHasher.HashPassword(request.NewPassword);
        user.UpdatePassword(hash, salt);
        await userRepository.UpdateAsync(user, cancellationToken);

        // Security: revoke every other session so stolen refresh tokens die with the old password.
        var currentRefreshToken = currentUserProvider.GetCurrentRefreshToken();
        if (!string.IsNullOrWhiteSpace(currentRefreshToken))
        {
            await userRepository.RevokeOtherSessionsAsync(user.Id, currentRefreshToken, cancellationToken);
        }

        var language = currentLanguageProvider.GetCurrentLanguage();
        await emailSender.SendAsync(
            user.Email,
            AccountEmailTemplates.PasswordChangedSubject(language),
            AccountEmailTemplates.PasswordChangedBody(language, user.FullName, DateTimeOffset.UtcNow.ToString("yyyy-MM-dd HH:mm")),
            cancellationToken);

        return new ChangePasswordResultDto(true);
    }
}
