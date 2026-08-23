namespace VitalityNutri.Application.Common.Exceptions;

/// <summary>
/// Thrown when an unauthenticated user attempts to access a protected resource, or authentication credentials are invalid.
/// Maps to HTTP 401 Unauthorized.
/// </summary>
public class UnauthorizedException : Exception
{
    public UnauthorizedException(string message) : base(message) { }
    public UnauthorizedException(string message, Exception innerException) : base(message, innerException) { }
}

/// <summary>
/// Thrown when an authenticated user does not have permission to access or mutate a resource, or an account is deactivated.
/// Maps to HTTP 403 Forbidden.
/// </summary>
public class ForbiddenException : Exception
{
    public ForbiddenException(string message) : base(message) { }
    public ForbiddenException(string message, Exception innerException) : base(message, innerException) { }
}

/// <summary>
/// Thrown when a requested entity or file does not exist.
/// Maps to HTTP 404 Not Found.
/// </summary>
public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
    public NotFoundException(string message, Exception innerException) : base(message, innerException) { }
}

/// <summary>
/// Thrown when an operation conflicts with current system state (e.g. unique constraint violation, duplicate email).
/// Maps to HTTP 409 Conflict.
/// </summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
    public ConflictException(string message, Exception innerException) : base(message, innerException) { }
}

/// <summary>
/// Thrown when business rules or processing cannot be fulfilled on valid syntax input.
/// Maps to HTTP 422 Unprocessable Entity.
/// </summary>
public class UnprocessableEntityException : Exception
{
    public UnprocessableEntityException(string message) : base(message) { }
    public UnprocessableEntityException(string message, Exception innerException) : base(message, innerException) { }
}
