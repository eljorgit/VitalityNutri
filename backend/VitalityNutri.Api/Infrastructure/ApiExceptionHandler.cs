using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
namespace VitalityNutri.Api.Infrastructure;
/// <summary>Converts application exceptions into RFC 7807 responses.</summary>
public sealed class ApiExceptionHandler(IProblemDetailsService details, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is ValidationException validation)
        {
            context.Response.StatusCode = 400;
            return await details.TryWriteAsync(new ProblemDetailsContext { HttpContext = context,
                ProblemDetails = new ValidationProblemDetails(validation.Errors.GroupBy(x => x.PropertyName).ToDictionary(x => x.Key, x => x.Select(e => e.ErrorMessage).ToArray())) { Status = 400, Title = "Validation failed" }, Exception = exception });
        }
        logger.LogError(exception, "Unhandled API exception"); context.Response.StatusCode = 500;
        return await details.TryWriteAsync(new ProblemDetailsContext { HttpContext = context, ProblemDetails = new ProblemDetails { Status = 500, Title = "An unexpected error occurred" }, Exception = exception });
    }
}