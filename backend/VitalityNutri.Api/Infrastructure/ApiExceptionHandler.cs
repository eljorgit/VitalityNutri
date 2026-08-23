using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Application.Resources;

namespace VitalityNutri.Api.Infrastructure;

/// <summary>
/// Converts application exceptions into standard RFC 7807 ProblemDetails HTTP responses.
/// </summary>
public sealed class ApiExceptionHandler(
    IProblemDetailsService details,
    ILogger<ApiExceptionHandler> logger,
    IStringLocalizer<Messages> localizer) : IExceptionHandler
{
    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        // 1. FluentValidation / Request Input Errors (400 Bad Request)
        if (exception is ValidationException validation)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return await details.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new ValidationProblemDetails(validation.Errors
                    .GroupBy(x => x.PropertyName)
                    .ToDictionary(x => x.Key, x => x.Select(e => e.ErrorMessage).ToArray()))
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = localizer[Messages.CommonValidationFailed],
                    Detail = validation.Message
                },
                Exception = exception
            });
        }

        // 2. Authentication Failures (401 Unauthorized)
        if (exception is UnauthorizedException or UnauthorizedAccessException)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return await details.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = "Unauthorized",
                    Detail = exception.Message
                },
                Exception = exception
            });
        }

        // 3. Authorization / Account Access Restrictions (403 Forbidden)
        if (exception is ForbiddenException)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return await details.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = exception.Message
                },
                Exception = exception
            });
        }

        // 4. Missing Resource or File (404 Not Found)
        if (exception is NotFoundException or KeyNotFoundException or FileNotFoundException)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return await details.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "Not Found",
                    Detail = exception.Message
                },
                Exception = exception
            });
        }

        // 5. State Conflicts (e.g. Duplicate Resource / Email) (409 Conflict)
        if (exception is ConflictException)
        {
            context.Response.StatusCode = StatusCodes.Status409Conflict;
            return await details.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Conflict",
                    Detail = exception.Message
                },
                Exception = exception
            });
        }

        // 6. Unprocessable Business Entity / Plan Extraction (422 Unprocessable Entity)
        if (exception is UnprocessableEntityException)
        {
            context.Response.StatusCode = StatusCodes.Status422UnprocessableEntity;
            return await details.TryWriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status422UnprocessableEntity,
                    Title = "Unprocessable Entity",
                    Detail = exception.Message
                },
                Exception = exception
            });
        }

        // 7. Request Aborted by Client (499 Client Closed Request)
        if (exception is OperationCanceledException || context.RequestAborted.IsCancellationRequested)
        {
            logger.LogInformation("Request was canceled by the client.");
            context.Response.StatusCode = 499;
            return true;
        }

        // 8. Unexpected Server Errors (500 Internal Server Error)
        logger.LogError(exception, "Unhandled API exception: {Message}", exception.Message);
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        return await details.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = localizer[Messages.CommonUnexpectedError],
                Detail = "An unexpected error occurred processing your request."
            },
            Exception = exception
        });
    }
}