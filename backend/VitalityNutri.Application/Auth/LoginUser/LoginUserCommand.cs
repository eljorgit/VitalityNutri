using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Auth.LoginUser;

public sealed record LoginUserCommand(
    string Email,
    string Password) : IRequest<AuthResultDto>;

public sealed class LoginUserCommandValidator : AbstractValidator<LoginUserCommand>
{
    public LoginUserCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("A valid email address is required.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.");
    }
}

public sealed class LoginUserCommandHandler(
    IUserRepository userRepository,
    IPasswordHasher passwordHasher,
    IJwtTokenGenerator jwtTokenGenerator) : IRequestHandler<LoginUserCommand, AuthResultDto>
{
    public async Task<AuthResultDto> Handle(LoginUserCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);
        if (user is null)
        {
            throw new UnauthorizedException("Invalid email or password.");
        }

        if (!user.IsActive)
        {
            throw new ForbiddenException("This account is currently deactivated.");
        }

        var isPasswordValid = passwordHasher.VerifyPassword(request.Password, user.PasswordHash, user.PasswordSalt);
        if (!isPasswordValid)
        {
            throw new UnauthorizedException("Invalid email or password.");
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

        return new AuthResultDto(token, refreshToken, userDto, "Login successful");
    }
}
