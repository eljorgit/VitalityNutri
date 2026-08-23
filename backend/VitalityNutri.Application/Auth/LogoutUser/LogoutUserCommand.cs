using MediatR;
using VitalityNutri.Application.Abstractions.Persistence;

namespace VitalityNutri.Application.Auth.LogoutUser;

public sealed record LogoutUserCommand(string? RefreshToken = null) : IRequest<bool>;

public sealed class LogoutUserCommandHandler(
    IUserRepository userRepository) : IRequestHandler<LogoutUserCommand, bool>
{
    public async Task<bool> Handle(LogoutUserCommand request, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            await userRepository.RevokeRefreshTokenAsync(request.RefreshToken, cancellationToken);
        }
        return true;
    }
}
