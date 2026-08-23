using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

public sealed class EfUserVerificationTokenRepository(VitalityNutriDbContext dbContext) : IUserVerificationTokenRepository
{
    public async Task AddAsync(UserVerificationToken token, CancellationToken cancellationToken = default)
    {
        dbContext.UserVerificationTokens.Add(token);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public Task<UserVerificationToken?> FindByHashAsync(string type, string tokenHash, CancellationToken cancellationToken = default)
    {
        return dbContext.UserVerificationTokens.FirstOrDefaultAsync(
            t => t.Type == type && t.TokenHash == tokenHash,
            cancellationToken);
    }

    public async Task UpdateAsync(UserVerificationToken token, CancellationToken cancellationToken = default)
    {
        dbContext.UserVerificationTokens.Update(token);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task InvalidateAllAsync(long userId, string type, CancellationToken cancellationToken = default)
    {
        var outstanding = await dbContext.UserVerificationTokens
            .Where(t => t.UserId == userId && t.Type == type && t.ConsumedAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var token in outstanding)
        {
            token.Consume();
        }

        if (outstanding.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
