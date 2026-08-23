using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Auth.AppleLogin;

public sealed record AppleLoginCommand(string IdToken, string? FullName = null) : IRequest<AuthResultDto>;

public sealed class AppleLoginCommandValidator : AbstractValidator<AppleLoginCommand>
{
    public AppleLoginCommandValidator()
    {
        RuleFor(x => x.IdToken)
            .NotEmpty().WithMessage("Apple ID Token is required.");
    }
}

public sealed class AppleLoginCommandHandler(
    IAppleAuthValidator appleAuthValidator,
    IUserRepository userRepository,
    IJwtTokenGenerator jwtTokenGenerator) : IRequestHandler<AppleLoginCommand, AuthResultDto>
{
    public async Task<AuthResultDto> Handle(AppleLoginCommand request, CancellationToken cancellationToken)
    {
        var profile = await appleAuthValidator.ValidateIdTokenAsync(request.IdToken, cancellationToken);
        if (profile is null || string.IsNullOrWhiteSpace(profile.Email))
        {
            throw new UnauthorizedException("Invalid or expired Apple authentication token.");
        }

        var normalizedEmail = profile.Email.Trim().ToLowerInvariant();
        var user = await userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);

        var resolvedFullName = !string.IsNullOrWhiteSpace(request.FullName)
            ? request.FullName.Trim()
            : (!string.IsNullOrWhiteSpace(profile.FullName)
                ? profile.FullName.Trim()
                : normalizedEmail.Split('@')[0]);

        if (user is null)
        {
            var (firstName, surname) = User.SplitDisplayName(resolvedFullName);
            user = new User(
                email: normalizedEmail,
                passwordHash: string.Empty,
                passwordSalt: string.Empty,
                firstName: firstName,
                surname: surname,
                role: "User",
                authProvider: "apple");

            user = await userRepository.AddAsync(user, cancellationToken);
        }
        else if (!user.IsActive)
        {
            throw new ForbiddenException("This account is currently deactivated.");
        }

        var token = jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role, user.FullName);
        var refreshToken = jwtTokenGenerator.GenerateRefreshToken();

        await userRepository.SaveRefreshTokenAsync(
            new RefreshToken(user.Id, refreshToken, DateTimeOffset.UtcNow.AddDays(30)),
            cancellationToken);

        var isDemo = string.Equals(user.Role, "Demo", StringComparison.OrdinalIgnoreCase);

        var userDto = new UserDto(
            user.Id,
            user.Email,
            user.FirstName,
            user.Surname,
            user.FullName,
            user.Role,
            user.AuthProvider,
            isDemo,
            user.CreatedAtUtc);

        return new AuthResultDto(token, refreshToken, userDto, "Apple login successful");
    }
}
