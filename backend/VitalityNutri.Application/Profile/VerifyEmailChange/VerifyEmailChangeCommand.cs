using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Auth;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Application.Common.Security;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Profile.VerifyEmailChange;

public sealed record VerifyEmailChangeCommand(string Token) : IRequest<AuthResultDto>;

public sealed class VerifyEmailChangeCommandHandler(
    IUserVerificationTokenRepository verificationTokenRepository,
    IUserRepository userRepository,
    IJwtTokenGenerator jwtTokenGenerator)
    : IRequestHandler<VerifyEmailChangeCommand, AuthResultDto>
{
    public async Task<AuthResultDto> Handle(VerifyEmailChangeCommand request, CancellationToken cancellationToken)
    {
        var token = await verificationTokenRepository.FindByHashAsync(
            UserVerificationToken.TypeEmailChange,
            VerificationTokenFactory.HashToken(request.Token),
            cancellationToken);

        if (token is null || !token.IsUsable || string.IsNullOrWhiteSpace(token.PendingEmail))
        {
            throw new UnprocessableEntityException("This verification link is invalid or has expired. Please request a new email change.");
        }

        if (await userRepository.EmailExistsAsync(token.PendingEmail, cancellationToken))
        {
            throw new ConflictException("An account with this email address already exists.");
        }

        var user = await userRepository.GetByIdAsync(token.UserId, cancellationToken)
            ?? throw new NotFoundException("User not found.");

        token.Consume();
        user.UpdateEmail(token.PendingEmail);
        await verificationTokenRepository.UpdateAsync(token, cancellationToken);
        await userRepository.UpdateAsync(user, cancellationToken);

        // The verified new address becomes the identity: kill every other session.
        var freshJwt = jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role, user.FullName);
        var freshRefresh = jwtTokenGenerator.GenerateRefreshToken();

        await userRepository.RevokeOtherSessionsAsync(user.Id, string.Empty, cancellationToken);
        var rotated = new RefreshToken(user.Id, freshRefresh, DateTimeOffset.UtcNow.AddDays(30));
        await userRepository.SaveRefreshTokenAsync(rotated, cancellationToken);

        var userDto = new UserDto(
            user.Id,
            user.Email,
            user.FirstName,
            user.Surname,
            user.FullName,
            user.Role,
            user.AuthProvider,
            IsDemo: false,
            user.CreatedAtUtc);

        return new AuthResultDto(freshJwt, freshRefresh, userDto, "Email updated successfully");
    }
}
