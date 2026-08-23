using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence.Repositories;

public sealed class EfUserAiSettingsRepository(VitalityNutriDbContext dbContext) : IUserAiSettingsRepository
{
    public Task<UserAiSettings?> GetSettingsAsync(long userId, CancellationToken cancellationToken = default)
    {
        return dbContext.UserAiSettings.FirstOrDefaultAsync(s => s.UserId == userId, cancellationToken);
    }

    public async Task<UserAiSettings> EnsureSettingsAsync(long userId, CancellationToken cancellationToken = default)
    {
        var settings = await GetSettingsAsync(userId, cancellationToken);
        if (settings is not null)
        {
            return settings;
        }

        settings = new UserAiSettings(userId);
        dbContext.UserAiSettings.Add(settings);
        await dbContext.SaveChangesAsync(cancellationToken);
        return settings;
    }

    public async Task UpdateAsync(UserAiSettings settings, CancellationToken cancellationToken = default)
    {
        dbContext.UserAiSettings.Update(settings);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public Task<UserAiProviderKey?> GetKeyAsync(long userId, long keyId, CancellationToken cancellationToken = default)
    {
        return dbContext.UserAiProviderKeys.FirstOrDefaultAsync(k => k.UserId == userId && k.Id == keyId, cancellationToken);
    }

    public async Task<IReadOnlyList<UserAiProviderKey>> GetKeysAsync(long userId, CancellationToken cancellationToken = default)
    {
        return await dbContext.UserAiProviderKeys
            .Where(k => k.UserId == userId)
            .OrderBy(k => k.Alias)
            .ToListAsync(cancellationToken);
    }

    public async Task AddKeyAsync(long userId, UserAiProviderKey key, CancellationToken cancellationToken = default)
    {
        dbContext.UserAiProviderKeys.Add(key);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateKeyAsync(UserAiProviderKey key, CancellationToken cancellationToken = default)
    {
        dbContext.UserAiProviderKeys.Update(key);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteKeyAsync(long userId, long keyId, CancellationToken cancellationToken = default)
    {
        var key = await GetKeyAsync(userId, keyId, cancellationToken);
        if (key is not null)
        {
            dbContext.UserAiProviderKeys.Remove(key);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public Task<bool> AliasExistsAsync(long userId, string alias, long? excludeKeyId = null, CancellationToken cancellationToken = default)
    {
        var normalized = alias.Trim().ToLowerInvariant();
        return dbContext.UserAiProviderKeys.AnyAsync(
            k => k.UserId == userId
                && k.Alias.ToLower() == normalized
                && (excludeKeyId == null || k.Id != excludeKeyId.Value),
            cancellationToken);
    }
}
