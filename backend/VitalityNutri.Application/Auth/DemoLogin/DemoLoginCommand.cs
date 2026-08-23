using MediatR;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Auth.DemoLogin;

public sealed record DemoLoginCommand : IRequest<AuthResultDto>;

public sealed class DemoLoginCommandHandler(
    IDemoSeeder demoSeeder,
    IUserRepository userRepository,
    IJwtTokenGenerator jwtTokenGenerator) : IRequestHandler<DemoLoginCommand, AuthResultDto>
{
    public async Task<AuthResultDto> Handle(DemoLoginCommand request, CancellationToken cancellationToken)
    {
        var user = await demoSeeder.EnsureDemoUserAndDataAsync(cancellationToken);

        var token = jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role, user.FullName);
        var refreshToken = jwtTokenGenerator.GenerateRefreshToken();

        await userRepository.SaveRefreshTokenAsync(
            new RefreshToken(user.Id, refreshToken, DateTimeOffset.UtcNow.AddDays(30)),
            cancellationToken);

        var userDto = new UserDto(
            user.Id,
            user.Email,
            user.FirstName,
            user.Surname,
            user.FullName,
            user.Role,
            user.AuthProvider,
            IsDemo: true,
            user.CreatedAtUtc);

        return new AuthResultDto(token, refreshToken, userDto, "Demo Access Granted");
    }
}
