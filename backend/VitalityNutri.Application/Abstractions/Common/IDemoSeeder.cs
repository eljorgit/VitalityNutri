using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Application.Abstractions.Common;

public interface IDemoSeeder
{
    Task<User> EnsureDemoUserAndDataAsync(CancellationToken cancellationToken = default);
}
