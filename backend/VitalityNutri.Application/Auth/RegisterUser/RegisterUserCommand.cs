using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Auth.RegisterUser;

public sealed record RegisterUserCommand(
    string Email,
    string Password,
    string FirstName,
    string? Surname) : IRequest<AuthResultDto>;

public sealed class RegisterUserCommandValidator : AbstractValidator<RegisterUserCommand>
{
    public RegisterUserCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("A valid email address is required.")
            .MaximumLength(255).WithMessage("Email cannot exceed 255 characters.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(6).WithMessage("Password must be at least 6 characters long.")
            .MaximumLength(128).WithMessage("Password cannot exceed 128 characters.");

        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(255).WithMessage("First name cannot exceed 255 characters.");

        RuleFor(x => x.Surname)
            .MaximumLength(255).WithMessage("Surname cannot exceed 255 characters.");
    }
}

public sealed class RegisterUserCommandHandler(
    IUserRepository userRepository,
    IPasswordHasher passwordHasher,
    IJwtTokenGenerator jwtTokenGenerator) : IRequestHandler<RegisterUserCommand, AuthResultDto>
{
    public async Task<AuthResultDto> Handle(RegisterUserCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var exists = await userRepository.EmailExistsAsync(normalizedEmail, cancellationToken);
        if (exists)
        {
            throw new ConflictException("An account with this email address already exists.");
        }

        var (hash, salt) = passwordHasher.HashPassword(request.Password);
        var user = new User(
            email: normalizedEmail,
            passwordHash: hash,
            passwordSalt: salt,
            firstName: request.FirstName,
            surname: request.Surname ?? string.Empty,
            role: "User",
            authProvider: "local");

        var createdUser = await userRepository.AddAsync(user, cancellationToken);

        var token = jwtTokenGenerator.GenerateToken(createdUser.Id, createdUser.Email, createdUser.Role, createdUser.FullName);
        var refreshToken = jwtTokenGenerator.GenerateRefreshToken();

        await userRepository.SaveRefreshTokenAsync(
            new RefreshToken(createdUser.Id, refreshToken, DateTimeOffset.UtcNow.AddDays(30)),
            cancellationToken);

        var userDto = new UserDto(
            createdUser.Id,
            createdUser.Email,
            createdUser.FirstName,
            createdUser.Surname,
            createdUser.FullName,
            createdUser.Role,
            createdUser.AuthProvider,
            IsDemo: false,
            createdUser.CreatedAtUtc);

        return new AuthResultDto(token, refreshToken, userDto, "Registration successful");
    }
}
