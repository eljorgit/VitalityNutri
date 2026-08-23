using FluentValidation;
using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Auth;
using VitalityNutri.Application.Common.Exceptions;

namespace VitalityNutri.Application.Auth.ManageSessions;

public sealed record SessionDto(
    long Id,
    string? UserAgent,
    string? IpAddress,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset LastUsedAtUtc,
    DateTimeOffset ExpiresAtUtc,
    bool IsCurrent);

public sealed record ListSessionsQuery : IRequest<IReadOnlyList<SessionDto>>;

public sealed class ListSessionsQueryHandler(
    ICurrentUserProvider currentUserProvider,
    IUserRepository userRepository)
    : IRequestHandler<ListSessionsQuery, IReadOnlyList<SessionDto>>
{
    public async Task<IReadOnlyList<SessionDto>> Handle(ListSessionsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        var currentToken = currentUserProvider.GetCurrentRefreshToken();
        var sessions = await userRepository.GetActiveSessionsAsync(userId, cancellationToken);

        return [.. sessions.Select(s => new SessionDto(
            s.Id,
            s.UserAgent,
            s.IpAddress,
            s.CreatedAtUtc,
            s.LastUsedAtUtc,
            s.ExpiresAtUtc,
            !string.IsNullOrWhiteSpace(currentToken) && string.Equals(s.Token, currentToken, StringComparison.Ordinal)))];
    }
}

public sealed record RevokeSessionCommand(long SessionId) : IRequest<bool>;

public sealed class RevokeSessionCommandHandler(
    ICurrentUserProvider currentUserProvider,
    IUserRepository userRepository)
    : IRequestHandler<RevokeSessionCommand, bool>
{
    public async Task<bool> Handle(RevokeSessionCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUserProvider.GetCurrentUserId()
            ?? throw new UnauthorizedException("Authentication is required.");

        if (currentUserProvider.IsDemo())
        {
            throw new ForbiddenException("Demo accounts cannot manage sessions.");
        }

        var session = await userRepository.GetSessionByIdAsync(userId, request.SessionId, cancellationToken)
            ?? throw new NotFoundException("Session not found.");

        session.Revoke();
        await userRepository.UpdateRefreshTokenAsync(session, cancellationToken);
        return true;
    }
}

/// <summary>
/// Refreshes the JWT and rotates the refresh token IN PLACE so the session row
/// (and therefore its identity on the sessions screen) survives rotation.
/// </summary>
public sealed record RefreshTokensCommand(string RawRefreshToken) : IRequest<AuthResultDto>;

public sealed class RefreshTokensCommandValidator : AbstractValidator<RefreshTokensCommand>
{
    public RefreshTokensCommandValidator()
    {
        RuleFor(x => x.RawRefreshToken).NotEmpty().WithMessage("A refresh token is required.");
    }
}

public sealed class RefreshTokensCommandHandler(
    IUserRepository userRepository,
    IJwtTokenGenerator jwtTokenGenerator)
    : IRequestHandler<RefreshTokensCommand, AuthResultDto>
{
    public async Task<AuthResultDto> Handle(RefreshTokensCommand request, CancellationToken cancellationToken)
    {
        var storedToken = await userRepository.GetRefreshTokenAsync(request.RawRefreshToken, cancellationToken);
        if (storedToken is null || !storedToken.IsActive)
        {
            throw new UnauthorizedException("Your session has expired. Please sign in again.");
        }

        var user = await userRepository.GetByIdAsync(storedToken.UserId, cancellationToken)
            ?? throw new UnauthorizedException("Your account no longer exists.");

        var newJwt = jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role, user.FullName);
        var newRefresh = jwtTokenGenerator.GenerateRefreshToken();

        // In-place rotation preserves the session identity for the sessions screen.
        storedToken.RotateTo(newRefresh, DateTimeOffset.UtcNow.AddDays(30));
        await userRepository.UpdateRefreshTokenAsync(storedToken, cancellationToken);

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

        return new AuthResultDto(newJwt, newRefresh, userDto, "Session refreshed");
    }
}
