using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.Auth.GetCurrentUser;

public sealed record GetCurrentUserQuery : IRequest<UserDto?>;

public sealed class GetCurrentUserQueryHandler(
    ICurrentUserProvider currentUserProvider,
    IUserRepository userRepository) : IRequestHandler<GetCurrentUserQuery, UserDto?>
{
    public async Task<UserDto?> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId();
        if (userId is null)
        {
            return null;
        }

        var user = await userRepository.GetByIdAsync(userId.Value, cancellationToken);
        if (user is null)
        {
            return null;
        }

        if (!user.IsActive)
        {
            throw new ForbiddenException("User account is currently deactivated.");
        }

        var isDemo = string.Equals(user.Role, "Demo", StringComparison.OrdinalIgnoreCase) || currentUserProvider.IsDemo();

        return new UserDto(
            user.Id,
            user.Email,
            user.FirstName,
            user.Surname,
            user.FullName,
            user.Role,
            user.AuthProvider,
            isDemo,
            user.CreatedAtUtc);
    }
}
