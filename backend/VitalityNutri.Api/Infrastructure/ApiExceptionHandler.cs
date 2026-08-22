using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using VitalityNutri.Application.Resources;

namespace VitalityNutri.Api.Infrastructure;

/// <summary>Converts application exceptions into RFC 7807 responses.</summary>
public sealed class ApiExceptionHandler(
    IProblemDetailsService details,
    ILogger<ApiExceptionHandler> logger,
    IStringLocalizer<Messages> localizer) : IExceptionHandler
{
    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is ValidationException validation)
        {
            context.Response.StatusCode = 400;
            return await details.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new ValidationProblemDetails(validation.Errors
                    .GroupBy(x => x.PropertyName)
                    .ToDictionary(x => x.Key, x => x.Select(e => e.ErrorMessage).ToArray()))
                {
                    Status = 400,
                    Title = localizer[Messages.CommonValidationFailed]
                },
                Exception = exception
            });
        }

        if (exception is OperationCanceledException || context.RequestAborted.IsCancellationRequested)
        {
            logger.LogInformation("Request was canceled by the client.");
            context.Response.StatusCode = 499;
            return true;
        }

        logger.LogError(exception, "Unhandled API exception");
        context.Response.StatusCode = 500;
        return await details.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails
            {
                Status = 500,
                Title = localizer[Messages.CommonUnexpectedError]
            },
            Exception = exception
        });
    }
}