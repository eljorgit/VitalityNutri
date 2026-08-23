using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Persistence;

public interface IUserVerificationTokenRepository
{
    Task AddAsync(UserVerificationToken token, CancellationToken cancellationToken = default);

    /// <summary>Unfiltered lookup by hash: usable both pre- and post-authentication.</summary>
    Task<UserVerificationToken?> FindByHashAsync(string type, string tokenHash, CancellationToken cancellationToken = default);

    Task UpdateAsync(UserVerificationToken token, CancellationToken cancellationToken = default);

    /// <summary>Invalidate all outstanding tokens of a type for a user (e.g., before issuing a fresh one).</summary>
    Task InvalidateAllAsync(long userId, string type, CancellationToken cancellationToken = default);
}
