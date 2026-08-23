using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Tests.Infrastructure;

public sealed class AiFallbackChainFormatTests
{
    [Theory]
    [InlineData("gemini:gemini-3.5-flash", true)]
    [InlineData("groq:openai/gpt-oss-120b", true)]
    [InlineData("omniroute:vision-multimodal", true)]
    [InlineData("OmniRoute:strict-json", true)]
    [InlineData("anthropic:claude-sonnet-4-5", true)]
    [InlineData("openai:gpt-5-mini", true)]
    [InlineData("openrouter:anthropic/claude-sonnet-4.5", true)]
    [InlineData("anthropic:claude-sonnet-4-5,openai:gpt-5-mini,omniroute:strict-json", true)]
    [InlineData("omniroute:strict-json,gemini:gemini-3.6-flash", true)]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("gemini-3.5-flash", false)]
    [InlineData("strict-json", false)]
    [InlineData("unknown-provider:some-model", false)]
    [InlineData(":missing-model", false)]
    [InlineData("gemini:", false)]
    public void IsValidChain_EnforcesProviderModelPattern(string? chain, bool expected)
    {
        Assert.Equal(expected, AiFallbackChainFormat.IsValidChain(chain));
    }

    [Fact]
    public void GetInvalidEntries_ReturnsOnlyOffendingEntries()
    {
        var chain = "omniroute:vision-multimodal,gemini-3.5-flash,gemini:gemini-3.1-flash-lite,bogus-provider:x";

        var invalid = AiFallbackChainFormat.GetInvalidEntries(chain);

        Assert.Equal(["gemini-3.5-flash", "bogus-provider:x"], invalid);
    }
}
