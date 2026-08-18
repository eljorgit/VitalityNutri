using VitalityNutri.Infrastructure.Configuration;
namespace VitalityNutri.Tests.Infrastructure;
public sealed class DatabaseProviderPolicyTests
{
    [Theory]
    [InlineData("SaaS", "MySql", true)]
    [InlineData("SaaS", "Sqlite", false)]
    [InlineData("Oss", "MySql", true)]
    [InlineData("Oss", "Sqlite", true)]
    [InlineData("Unknown", "MySql", false)]
    [InlineData("Oss", "Postgres", false)]
    public void IsAllowed_EnforcesPolicy(string mode, string provider, bool expected) =>
        Assert.Equal(expected, DatabaseProviderPolicy.IsAllowed(mode, provider));
}
