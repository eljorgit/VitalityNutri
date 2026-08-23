using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Auth;
using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.Profile.UpdateProfile;

public sealed record UpdateProfileCommand(string FirstName, string? Surname) : IRequest<UserDto>;

public sealed class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
{
    public UpdateProfileCommandValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(255).WithMessage("First name cannot exceed 255 characters.");

        RuleFor(x => x.Surname)
            .MaximumLength(255).WithMessage("Surname cannot exceed 255 characters.");
    }
}

public sealed class UpdateProfileCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserRepository userRepository)
    : IRequestHandler<UpdateProfileCommand, UserDto>
{
    public async Task<UserDto> Handle(UpdateProfileCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot edit their profile.");
        }

        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException("User not found.");

        user.UpdateProfile(request.FirstName, request.Surname ?? string.Empty);
        await userRepository.UpdateAsync(user, cancellationToken);

        return new UserDto(
            user.Id,
            user.Email,
            user.FirstName,
            user.Surname,
            user.FullName,
            user.Role,
            user.AuthProvider,
            IsDemo: false,
            user.CreatedAtUtc);
    }
}
