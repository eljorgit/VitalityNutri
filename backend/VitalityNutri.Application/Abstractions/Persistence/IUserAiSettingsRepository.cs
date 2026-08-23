using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IUserAiSettingsRepository
{
    Task<UserAiSettings?> GetSettingsAsync(long userId, CancellationToken cancellationToken = default);

    Task<UserAiSettings> EnsureSettingsAsync(long userId, CancellationToken cancellationToken = default);

    Task UpdateAsync(UserAiSettings settings, CancellationToken cancellationToken = default);

    Task<UserAiProviderKey?> GetKeyAsync(long userId, long keyId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UserAiProviderKey>> GetKeysAsync(long userId, CancellationToken cancellationToken = default);

    Task AddKeyAsync(long userId, UserAiProviderKey key, CancellationToken cancellationToken = default);

    Task UpdateKeyAsync(UserAiProviderKey key, CancellationToken cancellationToken = default);

    Task DeleteKeyAsync(long userId, long keyId, CancellationToken cancellationToken = default);

    Task<bool> AliasExistsAsync(long userId, string alias, long? excludeKeyId = null, CancellationToken cancellationToken = default);
}
