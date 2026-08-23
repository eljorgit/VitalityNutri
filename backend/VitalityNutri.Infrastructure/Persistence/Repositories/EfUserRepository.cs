using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

public sealed class EfUserRepository(VitalityNutriDbContext dbContext) : IUserRepository
{
    public async Task<User?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
    {
        return await dbContext.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await dbContext.Users.FirstOrDefaultAsync(u => u.Email == normalized, cancellationToken);
    }

    public async Task<User> AddAsync(User user, CancellationToken cancellationToken = default)
    {
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        dbContext.Users.Update(user);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await dbContext.Users.AnyAsync(u => u.Email == normalized, cancellationToken);
    }

    public async Task SaveRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
    {
        dbContext.RefreshTokens.Add(refreshToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<RefreshToken?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        return await dbContext.RefreshTokens.FirstOrDefaultAsync(r => r.Token == token, cancellationToken);
    }

    public async Task RevokeRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        var rt = await dbContext.RefreshTokens.FirstOrDefaultAsync(r => r.Token == token, cancellationToken);
        if (rt is not null)
        {
            rt.Revoke();
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<IReadOnlyList<RefreshToken>> GetActiveSessionsAsync(long userId, CancellationToken cancellationToken = default)
    {
        return await dbContext.RefreshTokens
            .Where(r => r.UserId == userId && !r.IsRevoked && r.ExpiresAtUtc > DateTimeOffset.UtcNow)
            .OrderByDescending(r => r.LastUsedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<RefreshToken?> GetSessionByIdAsync(long userId, long sessionId, CancellationToken cancellationToken = default)
    {
        return await dbContext.RefreshTokens.FirstOrDefaultAsync(
            r => r.UserId == userId && r.Id == sessionId, cancellationToken);
    }

    public async Task UpdateRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
    {
        dbContext.RefreshTokens.Update(refreshToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task RevokeOtherSessionsAsync(long userId, string keepToken, CancellationToken cancellationToken = default)
    {
        var others = await dbContext.RefreshTokens
            .Where(r => r.UserId == userId && r.Token != keepToken && !r.IsRevoked && r.ExpiresAtUtc > DateTimeOffset.UtcNow)
            .ToListAsync(cancellationToken);

        foreach (var session in others)
        {
            session.Revoke();
        }

        if (others.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
