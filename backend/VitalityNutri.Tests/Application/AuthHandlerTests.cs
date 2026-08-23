using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Auth.AppleLogin;
using VitalityNutri.Application.Auth.DemoLogin;
using VitalityNutri.Application.Auth.GetCurrentUser;
using VitalityNutri.Application.Auth.GoogleLogin;
using VitalityNutri.Application.Auth.LoginUser;
using VitalityNutri.Application.Auth.RegisterUser;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Domain.Entities;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Security;

namespace VitalityNutri.Tests.Application;

public sealed class AuthHandlerTests
{
    private readonly InMemoryUserRepository _userRepo = new();
    private readonly Pbkdf2PasswordHasher _hasher = new();
    private readonly JwtTokenGenerator _jwtGen = new(new ApiConfiguration
    {
        Auth = new AuthConfiguration
        {
            JwtSecret = "Tests_Jwt_Secret_Salt_Key_2026_Minimum_64_Chars_Long_For_AuthHandlers"
        }
    });

    [Fact]
    public async Task RegisterUser_CreatesUser_AndReturnsAuthResult()
    {
        var handler = new RegisterUserCommandHandler(_userRepo, _hasher, _jwtGen);
        var command = new RegisterUserCommand("newuser@vitality.com", "Secret123!", "New", "User");

        var result = await handler.Handle(command, default);

        Assert.NotNull(result);
        Assert.NotEmpty(result.Token);
        Assert.Equal("newuser@vitality.com", result.User.Email);
        Assert.Equal("New User", result.User.FullName);
        Assert.Equal("New", result.User.FirstName);
        Assert.Equal("User", result.User.Surname);
        Assert.False(result.User.IsDemo);
    }

    [Fact]
    public async Task RegisterUser_ThrowsConflictException_WhenEmailAlreadyExists()
    {
        var existing = new User("duplicate@vitality.com", "hash", "salt", firstName: "Duplicate", surname: "");
        await _userRepo.AddAsync(existing, default);

        var handler = new RegisterUserCommandHandler(_userRepo, _hasher, _jwtGen);
        var command = new RegisterUserCommand("duplicate@vitality.com", "Secret123!", "Another", "Name");

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, default));
    }

    [Fact]
    public async Task LoginUser_Succeeds_WithCorrectCredentials()
    {
        var (hash, salt) = _hasher.HashPassword("MySecretPass");
        var user = new User("login@vitality.com", hash, salt, firstName: "Login", surname: "User");
        await _userRepo.AddAsync(user, default);

        var handler = new LoginUserCommandHandler(_userRepo, _hasher, _jwtGen);
        var command = new LoginUserCommand("login@vitality.com", "MySecretPass");

        var result = await handler.Handle(command, default);

        Assert.NotNull(result);
        Assert.NotEmpty(result.Token);
        Assert.Equal("login@vitality.com", result.User.Email);
    }

    [Fact]
    public async Task LoginUser_ThrowsUnauthorizedException_WithWrongPassword()
    {
        var (hash, salt) = _hasher.HashPassword("RightPassword");
        var user = new User("wrongpass@vitality.com", hash, salt, firstName: "User", surname: "");
        await _userRepo.AddAsync(user, default);

        var handler = new LoginUserCommandHandler(_userRepo, _hasher, _jwtGen);
        var command = new LoginUserCommand("wrongpass@vitality.com", "WrongPassword");

        await Assert.ThrowsAsync<UnauthorizedException>(() => handler.Handle(command, default));
    }

    [Fact]
    public async Task DemoLogin_GrantsDemoAccess()
    {
        var seeder = new MockDemoSeeder();
        var handler = new DemoLoginCommandHandler(seeder, _userRepo, _jwtGen);

        var result = await handler.Handle(new DemoLoginCommand(), default);

        Assert.NotNull(result);
        Assert.NotEmpty(result.Token);
        Assert.Equal("demo@vitalitynutri.com", result.User.Email);
        Assert.True(result.User.IsDemo);
        Assert.Equal("Demo", result.User.Role);
    }

    [Fact]
    public async Task GetCurrentUser_ReturnsProfile_ForAuthenticatedUser()
    {
        var user = new User("me@vitality.com", "hash", "salt", firstName: "Me", surname: "User", role: "User");
        await _userRepo.AddAsync(user, default);

        var userProvider = new MockCurrentUserProvider(user.Id, user.Email, user.Role);
        var handler = new GetCurrentUserQueryHandler(userProvider, _userRepo);

        var result = await handler.Handle(new GetCurrentUserQuery(), default);

        Assert.NotNull(result);
        Assert.Equal(user.Id, result.Id);
        Assert.Equal("me@vitality.com", result.Email);
    }

    [Fact]
    public async Task GetCurrentUser_ReturnsNull_WhenUnauthenticated()
    {
        var userProvider = new MockCurrentUserProvider(null, null, null);
        var handler = new GetCurrentUserQueryHandler(userProvider, _userRepo);

        var result = await handler.Handle(new GetCurrentUserQuery(), default);
        Assert.Null(result);
    }

    [Fact]
    public async Task GetCurrentUser_ReturnsNull_WhenUserDoesNotExist()
    {
        var userProvider = new MockCurrentUserProvider(999L, "missing@vitality.com", "User");
        var handler = new GetCurrentUserQueryHandler(userProvider, _userRepo);

        var result = await handler.Handle(new GetCurrentUserQuery(), default);
        Assert.Null(result);
    }

    [Fact]
    public async Task GoogleLogin_CreatesUser_WhenNotExists()
    {
        var mockValidator = new MockGoogleAuthValidator(new GoogleUserProfile("googleuser@vitality.com", "Google User", "sub-123"));
        var handler = new GoogleLoginCommandHandler(mockValidator, _userRepo, _jwtGen);

        var result = await handler.Handle(new GoogleLoginCommand("valid_token"), default);

        Assert.NotNull(result);
        Assert.Equal("googleuser@vitality.com", result.User.Email);
        Assert.Equal("Google User", result.User.FullName);
        Assert.Equal("google", result.User.AuthProvider);
    }

    [Fact]
    public async Task GoogleLogin_ThrowsUnauthorizedException_WhenTokenInvalid()
    {
        var mockValidator = new MockGoogleAuthValidator(null);
        var handler = new GoogleLoginCommandHandler(mockValidator, _userRepo, _jwtGen);

        await Assert.ThrowsAsync<UnauthorizedException>(() => handler.Handle(new GoogleLoginCommand("invalid_token"), default));
    }

    [Fact]
    public async Task AppleLogin_CreatesUser_WhenNotExists()
    {
        var mockValidator = new MockAppleAuthValidator(new AppleUserProfile("appleuser@vitality.com", null, "apple-sub-456"));
        var handler = new AppleLoginCommandHandler(mockValidator, _userRepo, _jwtGen);

        var result = await handler.Handle(new AppleLoginCommand("valid_apple_token", "Apple User"), default);

        Assert.NotNull(result);
        Assert.Equal("appleuser@vitality.com", result.User.Email);
        Assert.Equal("Apple User", result.User.FullName);
        Assert.Equal("apple", result.User.AuthProvider);
    }

    [Fact]
    public async Task AppleLogin_ThrowsUnauthorizedException_WhenTokenInvalid()
    {
        var mockValidator = new MockAppleAuthValidator(null);
        var handler = new AppleLoginCommandHandler(mockValidator, _userRepo, _jwtGen);

        await Assert.ThrowsAsync<UnauthorizedException>(() => handler.Handle(new AppleLoginCommand("invalid_apple_token"), default));
    }

    private sealed class MockGoogleAuthValidator(GoogleUserProfile? profile) : IGoogleAuthValidator
    {
        public Task<GoogleUserProfile?> ValidateIdTokenAsync(string idToken, CancellationToken cancellationToken = default)
            => Task.FromResult(profile);
    }

    private sealed class MockAppleAuthValidator(AppleUserProfile? profile) : IAppleAuthValidator
    {
        public Task<AppleUserProfile?> ValidateIdTokenAsync(string idToken, CancellationToken cancellationToken = default)
            => Task.FromResult(profile);
    }

    private sealed class MockDemoSeeder : IDemoSeeder
    {
        public Task<User> EnsureDemoUserAndDataAsync(CancellationToken cancellationToken = default)
        {
            var user = new User("demo@vitalitynutri.com", "hash", "salt", firstName: "Usuario", surname: "Demostración", role: "Demo", authProvider: "demo");
            return Task.FromResult(user);
        }
    }

    private sealed class MockCurrentUserProvider(long? userId, string? email, string? role) : ICurrentUserProvider
    {
        public long? GetCurrentUserId() => userId;
        public string? GetCurrentUserEmail() => email;
        public string? GetCurrentUserRole() => role;
        public bool IsAuthenticated() => userId.HasValue;
        public bool IsDemo() => string.Equals(role, "Demo", StringComparison.OrdinalIgnoreCase);
        public string? GetCurrentRefreshToken() => null;
    }

    private sealed class InMemoryUserRepository : IUserRepository
    {
        private readonly List<User> _users = [];
        private readonly List<RefreshToken> _tokens = [];
        private long _idCounter = 1;

        public Task<User?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_users.FirstOrDefault(u => u.Id == id));
        }

        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_users.FirstOrDefault(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)));
        }

        public Task<User> AddAsync(User user, CancellationToken cancellationToken = default)
        {
            typeof(User).GetProperty("Id")?.SetValue(user, _idCounter++);
            _users.Add(user);
            return Task.FromResult(user);
        }

        public Task UpdateAsync(User user, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_users.Any(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)));
        }

        public Task SaveRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
        {
            _tokens.Add(refreshToken);
            return Task.CompletedTask;
        }

        public Task<RefreshToken?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_tokens.FirstOrDefault(t => t.Token == token));
        }

        public Task RevokeRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
        {
            var rt = _tokens.FirstOrDefault(t => t.Token == token);
            rt?.Revoke();
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<RefreshToken>> GetActiveSessionsAsync(long userId, CancellationToken cancellationToken = default)
        {
            IReadOnlyList<RefreshToken> sessions = _tokens
                .Where(t => t.UserId == userId && t.IsActive)
                .OrderByDescending(t => t.LastUsedAtUtc)
                .ToList();
            return Task.FromResult(sessions);
        }

        public Task<RefreshToken?> GetSessionByIdAsync(long userId, long sessionId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(_tokens.FirstOrDefault(t => t.UserId == userId && t.Id == sessionId));
        }

        public Task UpdateRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task RevokeOtherSessionsAsync(long userId, string keepToken, CancellationToken cancellationToken = default)
        {
            foreach (var rt in _tokens.Where(t => t.UserId == userId && t.Token != keepToken))
            {
                rt.Revoke();
            }

            return Task.CompletedTask;
        }
    }
}
