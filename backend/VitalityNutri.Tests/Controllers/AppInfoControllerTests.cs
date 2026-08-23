using Microsoft.AspNetCore.Mvc;
using VitalityNutri.Api.Controllers.AppInfo;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Tests.Controllers;

public sealed class AppInfoControllerTests
{
    [Fact]
    public void GetAppInfo_ReturnsSaaSMode_WhenConfiguredAsSaaS()
    {
        var config = new ApiConfiguration
        {
            App = new AppConfiguration { Mode = "SaaS" },
            Auth = new AuthConfiguration
            {
                Google = new GoogleAuthConfiguration { Enabled = true }
            }
        };

        var controller = new AppInfoController(config);
        var actionResult = controller.GetAppInfo();

        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        var appInfo = Assert.IsType<AppInfoDto>(okResult.Value);

        Assert.Equal("SaaS", appInfo.Mode);
        Assert.Equal("0.2.0", appInfo.Version);
        Assert.True(appInfo.Auth.GoogleEnabled);
        Assert.True(appInfo.Auth.DemoEnabled);
    }

    [Fact]
    public void GetAppInfo_ReturnsOssMode_WhenConfiguredAsOss()
    {
        var config = new ApiConfiguration
        {
            App = new AppConfiguration { Mode = "Oss" },
            Auth = new AuthConfiguration
            {
                Google = new GoogleAuthConfiguration { Enabled = false }
            }
        };

        var controller = new AppInfoController(config);
        var actionResult = controller.GetAppInfo();

        var okResult = Assert.IsType<OkObjectResult>(actionResult);
        var appInfo = Assert.IsType<AppInfoDto>(okResult.Value);

        Assert.Equal("Oss", appInfo.Mode);
        Assert.False(appInfo.Auth.GoogleEnabled);
        Assert.False(appInfo.Auth.DemoEnabled);
    }
}
