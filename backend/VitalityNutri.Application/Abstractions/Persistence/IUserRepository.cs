using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(long id, CancellationToken cancellationToken = default);
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<User> AddAsync(User user, CancellationToken cancellationToken = default);
    Task UpdateAsync(User user, CancellationToken cancellationToken = default);
    Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default);
    Task SaveRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);
    Task<RefreshToken?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken = default);
    Task RevokeRefreshTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RefreshToken>> GetActiveSessionsAsync(long userId, CancellationToken cancellationToken = default);
    Task<RefreshToken?> GetSessionByIdAsync(long userId, long sessionId, CancellationToken cancellationToken = default);
    Task UpdateRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);
    Task RevokeOtherSessionsAsync(long userId, string keepToken, CancellationToken cancellationToken = default);
}
