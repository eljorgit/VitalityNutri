using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Tests.Domain;

public sealed class MealPlanTests
{
    [Fact]
    public void Deactivate_MarksPlanInactiveAndUpdatesTimestamp()
    {
        var plan = new MealPlan("{}", "{}");
        var previousUpdate = plan.UpdatedAtUtc;

        plan.Deactivate();

        Assert.False(plan.IsActive);
        Assert.True(plan.UpdatedAtUtc >= previousUpdate);
    }
}
