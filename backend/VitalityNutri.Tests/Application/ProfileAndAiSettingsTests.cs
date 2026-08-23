using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Application.Abstractions.Notifications;
using VitalityNutri.Application.Abstractions.Persistence;
using VitalityNutri.Application.Abstractions.Processing;
using VitalityNutri.Application.Abstractions.Security;
using VitalityNutri.Application.AiSettings;
using VitalityNutri.Application.Auth.ManageSessions;
using VitalityNutri.Application.Common.Exceptions;
using VitalityNutri.Application.Common.Security;
using VitalityNutri.Application.Profile.ChangeEmail;
using VitalityNutri.Application.Profile.ChangePassword;
using VitalityNutri.Application.Profile.GetAiSettings;
using VitalityNutri.Application.Profile.ProviderKeys;
using VitalityNutri.Application.Profile.SaveChainOverrides;
using VitalityNutri.Application.Profile.SetAiMode;
using VitalityNutri.Application.Profile.UpdateProfile;
using VitalityNutri.Application.Profile.VerifyEmailChange;
using VitalityNutri.Domain.Entities;
using VitalityNutri.Infrastructure.Configuration;
using VitalityNutri.Infrastructure.Security;

namespace VitalityNutri.Tests.Application;

public sealed class ProfileAndAiSettingsTests
{
    private readonly InMemoryUserRepository _userRepo = new();
    private readonly InMemoryUserAiSettingsRepository _aiSettingsRepo = new();
    private readonly InMemoryUserVerificationTokenRepository _tokenRepo = new();
    private readonly Pbkdf2PasswordHasher _hasher = new();
    private readonly JwtTokenGenerator _jwtGen = new(new ApiConfiguration());
    private readonly MockApiKeyProtector _protector = new();
    private readonly MockAiCreditLimits _limits = new();
    private readonly MockAppLinksProvider _links = new();
    private readonly MockCurrentLanguageProvider _language = new();

    private static User MakeUser(string email = "user@vitality.com", string role = "User", string authProvider = "local")
    {
        var (hash, salt) = new Pbkdf2PasswordHasher().HashPassword("Secret123!");
        return new User(email, hash, salt, firstName: "Test", surname: "User", role: role, authProvider: authProvider);
    }

    private MockCurrentUserProvider UserProvider(long? userId, string? role = "User", string? refreshToken = null)
        => new(userId, userId.HasValue ? "user@vitality.com" : null, role, role is "Demo" or "Evaluator", refreshToken);

    // ---------- UpdateProfile ----------

    [Fact]
    public async Task UpdateProfile_UpdatesName_AndReturnsUserDto()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);

        var handler = new UpdateProfileCommandHandler(UserProvider(user.Id), _userRepo);
        var result = await handler.Handle(new UpdateProfileCommand("Ana", "López"), default);

        Assert.Equal("Ana", result.FirstName);
        Assert.Equal("López", result.Surname);
        Assert.Equal("Ana López", result.FullName);
        Assert.Equal(user.Id, result.Id);
    }

    [Fact]
    public async Task UpdateProfile_ThrowsForbidden_ForDemoUser()
    {
        var user = MakeUser(role: "Demo", authProvider: "demo");
        await _userRepo.AddAsync(user, default);

        var handler = new UpdateProfileCommandHandler(UserProvider(user.Id, "Demo"), _userRepo);
        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(new UpdateProfileCommand("X", "Y"), default));
    }

    // ---------- ChangeEmail ----------

    [Fact]
    public async Task ChangeEmail_SendsVerification_ToNewAddress()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var sender = new RecordingEmailSender();

        var handler = new ChangeEmailCommandHandler(
            UserProvider(user.Id), _userRepo, _tokenRepo, sender, _language, _links);

        var result = await handler.Handle(new ChangeEmailCommand("new@vitality.com", null), default);

        Assert.True(result.VerificationEmailSent);
        var email = Assert.Single(sender.Sent);
        Assert.Equal("new@vitality.com", email.To);
        Assert.Contains("verify-email?token=", email.Body);
        Assert.Contains(_links.GetPublicBaseUrl(), email.Body);
    }

    [Fact]
    public async Task ChangeEmail_ThrowsConflict_WhenEmailExists()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        await _userRepo.AddAsync(MakeUser("taken@vitality.com"), default);
        var sender = new RecordingEmailSender();

        var handler = new ChangeEmailCommandHandler(
            UserProvider(user.Id), _userRepo, _tokenRepo, sender, _language, _links);

        await Assert.ThrowsAsync<ConflictException>(
            () => handler.Handle(new ChangeEmailCommand("taken@vitality.com", null), default));
    }

    // ---------- VerifyEmailChange ----------

    [Fact]
    public async Task VerifyEmailChange_UpdatesEmail_WhenTokenValid()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);

        var raw = "test-token";
        var token = new UserVerificationToken(
            user.Id, UserVerificationToken.TypeEmailChange,
            VerificationTokenFactory.HashToken(raw), "new@vitality.com", TimeSpan.FromHours(24));
        await _tokenRepo.AddAsync(token, default);

        var handler = new VerifyEmailChangeCommandHandler(_tokenRepo, _userRepo, _jwtGen);
        var result = await handler.Handle(new VerifyEmailChangeCommand(raw), default);

        Assert.Equal("new@vitality.com", result.User.Email);
        Assert.NotEmpty(result.Token);
        Assert.NotNull(result.RefreshToken);
        Assert.NotEmpty(result.RefreshToken!);
    }

    [Fact]
    public async Task VerifyEmailChange_ThrowsUnprocessable_WhenTokenUnknown()
    {
        var handler = new VerifyEmailChangeCommandHandler(_tokenRepo, _userRepo, _jwtGen);
        await Assert.ThrowsAsync<UnprocessableEntityException>(
            () => handler.Handle(new VerifyEmailChangeCommand("does-not-exist"), default));
    }

    [Fact]
    public async Task VerifyEmailChange_ThrowsUnprocessable_WhenTokenConsumed()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var raw = "consumed-token";
        var token = new UserVerificationToken(
            user.Id, UserVerificationToken.TypeEmailChange,
            VerificationTokenFactory.HashToken(raw), "new@vitality.com", TimeSpan.FromHours(24));
        token.Consume();
        await _tokenRepo.AddAsync(token, default);

        var handler = new VerifyEmailChangeCommandHandler(_tokenRepo, _userRepo, _jwtGen);
        await Assert.ThrowsAsync<UnprocessableEntityException>(
            () => handler.Handle(new VerifyEmailChangeCommand(raw), default));
    }

    // ---------- ChangePassword ----------

    [Fact]
    public async Task ChangePassword_UpdatesPassword_AndNotifiesOldAddress()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var sender = new RecordingEmailSender();

        var handler = new ChangePasswordCommandHandler(
            UserProvider(user.Id), _userRepo, _hasher, sender, _language);

        var result = await handler.Handle(new ChangePasswordCommand("Secret123!", "NewSecret123!"), default);

        Assert.True(result.PasswordChanged);
        Assert.True(_hasher.VerifyPassword("NewSecret123!", user.PasswordHash, user.PasswordSalt));
        var email = Assert.Single(sender.Sent);
        Assert.Equal("user@vitality.com", email.To);
    }

    [Fact]
    public async Task ChangePassword_ThrowsUnprocessable_WhenCurrentPasswordWrong()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var sender = new RecordingEmailSender();

        var handler = new ChangePasswordCommandHandler(
            UserProvider(user.Id), _userRepo, _hasher, sender, _language);

        await Assert.ThrowsAsync<UnprocessableEntityException>(
            () => handler.Handle(new ChangePasswordCommand("WrongPass", "NewSecret123!"), default));
    }

    [Fact]
    public async Task ChangePassword_ThrowsUnprocessable_ForSocialAccount()
    {
        var user = MakeUser(authProvider: "google");
        await _userRepo.AddAsync(user, default);
        var sender = new RecordingEmailSender();

        var handler = new ChangePasswordCommandHandler(
            UserProvider(user.Id), _userRepo, _hasher, sender, _language);

        await Assert.ThrowsAsync<UnprocessableEntityException>(
            () => handler.Handle(new ChangePasswordCommand("Secret123!", "NewSecret123!"), default));
    }

    // ---------- AiSettings ----------

    [Fact]
    public async Task GetAiSettings_ReturnsDefaults_WithCreditLimit()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var usage = new AiUsageWeekly(user.Id, AiWeek.WeekStartUtc());
        usage.AddCredits(5m);
        var ledger = new InMemoryAiUsageLedgerRepository(usage);

        var handler = new GetAiSettingsQueryHandler(UserProvider(user.Id), _aiSettingsRepo, ledger, _limits);
        var result = await handler.Handle(new GetAiSettingsQuery(), default);

        Assert.Equal("Platform", result.Mode);
        Assert.Equal(10m, result.WeeklyPlatformLimit);
        Assert.Equal(5m, result.CreditsUsedThisWeek);
        Assert.Equal(NamedAiChains.All, result.AvailableChains);
        Assert.NotEmpty(result.UsageMetrics);
        Assert.Empty(result.UsageInteractions);
        Assert.Empty(result.ProviderKeys);
    }

    [Fact]
    public async Task SetAiMode_SwitchesMode()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var ledger = new InMemoryAiUsageLedgerRepository(new AiUsageWeekly(user.Id, AiWeek.WeekStartUtc()));

        var handler = new SetAiModeCommandHandler(UserProvider(user.Id), _aiSettingsRepo, ledger, _limits);
        var result = await handler.Handle(new SetAiModeCommand(UserAiSettings.ModeByok), default);

        Assert.Equal("Byok", result.Mode);
    }

    [Fact]
    public async Task SaveChainOverrides_ThrowsNotFound_ForUnknownKeyId()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var ledger = new InMemoryAiUsageLedgerRepository(new AiUsageWeekly(user.Id, AiWeek.WeekStartUtc()));

        var handler = new SaveChainOverridesCommandHandler(UserProvider(user.Id), _aiSettingsRepo, ledger, _limits);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new SaveChainOverridesCommand([new ChainOverrideInput("PlanText", ["#999:model-x"])]), default));
    }

    [Fact]
    public async Task SaveChainOverrides_PersistsValidOverrides()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var ledger = new InMemoryAiUsageLedgerRepository(new AiUsageWeekly(user.Id, AiWeek.WeekStartUtc()));
        var key = new UserAiProviderKey(user.Id, "gemini", "my-key", "enc:abc", "abc1");
        await _aiSettingsRepo.AddKeyAsync(user.Id, key, default);

        var handler = new SaveChainOverridesCommandHandler(UserProvider(user.Id), _aiSettingsRepo, ledger, _limits);
        var result = await handler.Handle(new SaveChainOverridesCommand(
            [new ChainOverrideInput("PlanText", [$"#{key.Id}:gemini-2.5-flash", "groq:llama-3"])]), default);

        var overrideEntry = Assert.Single(result.ChainOverrides);
        Assert.Equal("PlanText", overrideEntry.ChainName);
        Assert.Equal(2, overrideEntry.Tokens.Count);
    }

    // ---------- Provider keys ----------

    [Fact]
    public async Task AddProviderKey_AddsValidatedKey_WhenValidationSucceeds()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var catalog = new MockAiProviderCatalog(valid: true);

        var handler = new AddProviderKeyCommandHandler(
            UserProvider(user.Id), _aiSettingsRepo, _protector, catalog);

        var result = await handler.Handle(
            new AddProviderKeyCommand("gemini", "work-key", "sk-1234abcd", null, ValidateImmediately: true), default);

        Assert.True(result.IsValidated);
        Assert.Equal("gemini", result.ProviderType);
        Assert.Contains("abcd", result.MaskedKey);
    }

    [Fact]
    public async Task AddProviderKey_ThrowsUnprocessable_WhenProviderRejectsKey()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var catalog = new MockAiProviderCatalog(valid: false);

        var handler = new AddProviderKeyCommandHandler(
            UserProvider(user.Id), _aiSettingsRepo, _protector, catalog);

        await Assert.ThrowsAsync<UnprocessableEntityException>(() => handler.Handle(
            new AddProviderKeyCommand("gemini", "bad-key", "sk-invalid", null, ValidateImmediately: true), default));
    }

    [Fact]
    public async Task AddProviderKey_ThrowsConflict_WhenAliasExists()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var catalog = new MockAiProviderCatalog(valid: false);
        await _aiSettingsRepo.AddKeyAsync(user.Id, new UserAiProviderKey(user.Id, "gemini", "work-key", "enc:a", "a"), default);

        var handler = new AddProviderKeyCommandHandler(
            UserProvider(user.Id), _aiSettingsRepo, _protector, catalog);

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(
            new AddProviderKeyCommand("gemini", "work-key", "sk-other", null, ValidateImmediately: false), default));
    }

    [Fact]
    public async Task DeleteProviderKey_RemovesKey_AndStripsChainReferences()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        var ledger = new InMemoryAiUsageLedgerRepository(new AiUsageWeekly(user.Id, AiWeek.WeekStartUtc()));
        var key = new UserAiProviderKey(user.Id, "gemini", "work-key", "enc:a", "a");
        await _aiSettingsRepo.AddKeyAsync(user.Id, key, default);

        var saveHandler = new SaveChainOverridesCommandHandler(UserProvider(user.Id), _aiSettingsRepo, ledger, _limits);
        await saveHandler.Handle(new SaveChainOverridesCommand(
            [new ChainOverrideInput("PlanText", [$"#{key.Id}:model-x"])]), default);

        var deleteHandler = new DeleteProviderKeyCommandHandler(UserProvider(user.Id), _aiSettingsRepo);
        var result = await deleteHandler.Handle(new DeleteProviderKeyCommand(key.Id), default);

        Assert.True(result.Deleted);
        Assert.True(result.RemovedFromChains);
        Assert.Null(await _aiSettingsRepo.GetKeyAsync(user.Id, key.Id, default));
    }

    // ---------- Sessions & refresh ----------

    [Fact]
    public async Task ListSessions_FlagsCurrentSession()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        await _userRepo.SaveRefreshTokenAsync(new RefreshToken(user.Id, "token-1", DateTimeOffset.UtcNow.AddDays(30)), default);
        await _userRepo.SaveRefreshTokenAsync(new RefreshToken(user.Id, "token-2", DateTimeOffset.UtcNow.AddDays(30)), default);

        var handler = new ListSessionsQueryHandler(UserProvider(user.Id, refreshToken: "token-1"), _userRepo);
        var result = await handler.Handle(new ListSessionsQuery(), default);

        Assert.Equal(2, result.Count);
        Assert.True(result.Single(s => s.Id == 1).IsCurrent);
        Assert.False(result.Single(s => s.Id == 2).IsCurrent);
    }

    [Fact]
    public async Task RevokeSession_RevokesOwnedSession()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        await _userRepo.SaveRefreshTokenAsync(new RefreshToken(user.Id, "token-1", DateTimeOffset.UtcNow.AddDays(30)), default);

        var handler = new RevokeSessionCommandHandler(UserProvider(user.Id), _userRepo);
        var result = await handler.Handle(new RevokeSessionCommand(1), default);

        Assert.True(result);
        Assert.Empty(await _userRepo.GetActiveSessionsAsync(user.Id, default));
    }

    [Fact]
    public async Task RevokeSession_ThrowsNotFound_ForOtherUsersSession()
    {
        var owner = MakeUser("owner@vitality.com");
        var other = MakeUser("other@vitality.com");
        await _userRepo.AddAsync(owner, default);
        await _userRepo.AddAsync(other, default);
        await _userRepo.SaveRefreshTokenAsync(new RefreshToken(owner.Id, "owner-token", DateTimeOffset.UtcNow.AddDays(30)), default);

        var handler = new RevokeSessionCommandHandler(UserProvider(other.Id), _userRepo);
        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(new RevokeSessionCommand(1), default));
    }

    [Fact]
    public async Task RefreshTokens_RotatesTokenInPlace()
    {
        var user = MakeUser();
        await _userRepo.AddAsync(user, default);
        await _userRepo.SaveRefreshTokenAsync(new RefreshToken(user.Id, "old-refresh", DateTimeOffset.UtcNow.AddDays(30)), default);

        var handler = new RefreshTokensCommandHandler(_userRepo, _jwtGen);
        var result = await handler.Handle(new RefreshTokensCommand("old-refresh"), default);

        Assert.NotEmpty(result.Token);
        Assert.NotEqual("old-refresh", result.RefreshToken);
        // In-place rotation: the stored session row now holds the new token.
        Assert.Equal(result.RefreshToken, (await _userRepo.GetRefreshTokenAsync(result.RefreshToken!, default))?.Token);
        Assert.Null(await _userRepo.GetRefreshTokenAsync("old-refresh", default));
    }

    [Fact]
    public async Task RefreshTokens_ThrowsUnauthorized_WhenTokenUnknown()
    {
        var handler = new RefreshTokensCommandHandler(_userRepo, _jwtGen);
        await Assert.ThrowsAsync<UnauthorizedException>(() => handler.Handle(new RefreshTokensCommand("nope"), default));
    }

    // ---------- Mocks ----------

    private sealed class MockCurrentUserProvider(long? userId, string? email, string? role, bool isDemo, string? refreshToken) : ICurrentUserProvider
    {
        public long? GetCurrentUserId() => userId;
        public string? GetCurrentUserEmail() => email;
        public string? GetCurrentUserRole() => role;
        public bool IsAuthenticated() => userId.HasValue;
        public bool IsDemo() => isDemo;
        public string? GetCurrentRefreshToken() => refreshToken;
    }

    private sealed class RecordingEmailSender : IEmailSender
    {
        public List<(string To, string Subject, string Body)> Sent { get; } = [];
        public Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            Sent.Add((toEmail, subject, htmlBody));
            return Task.CompletedTask;
        }
    }

    private sealed class MockApiKeyProtector : IApiKeyProtector
    {
        public string Protect(string plainTextApiKey) => $"enc:{plainTextApiKey}";
        public string? Unprotect(string protectedApiKey) => protectedApiKey.StartsWith("enc:") ? protectedApiKey[4..] : null;
        public string Mask(string protectedApiKey) => "••••" + (protectedApiKey.Length > 4 ? protectedApiKey[^4..] : protectedApiKey);
    }

    private sealed class MockAiProviderCatalog(bool valid) : IAiProviderCatalog
    {
        public Task<(bool IsValid, string? Error)> ValidateKeyAsync(string providerType, string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
            => Task.FromResult((valid, valid ? null : "rejected"));

        public Task<IReadOnlyList<string>> ListModelsAsync(string providerType, string apiKey, string? baseUrl, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<string>>(["model-a", "model-b"]);
    }

    private sealed class MockAiCreditLimits : IAiCreditLimits
    {
        public decimal GetWeeklyPlatformLimit() => 10m;
    }

    private sealed class MockAppLinksProvider : IAppLinksProvider
    {
        public string GetPublicBaseUrl() => "https://app.example.com";
    }

    private sealed class MockCurrentLanguageProvider : ICurrentLanguageProvider
    {
        public string GetCurrentLanguage() => "en";
    }

    private sealed class InMemoryAiUsageLedgerRepository(AiUsageWeekly usage) : IAiUsageLedgerRepository
    {
        public Task<AiUsageWeekly> GetOrCreateAsync(long userId, DateOnly weekStartUtc, CancellationToken cancellationToken = default)
            => Task.FromResult(usage);

        public Task UpdateAsync(AiUsageWeekly usage, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task AddEventAsync(AiUsageEvent usageEvent, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<IReadOnlyList<AiUsageEvent>> GetRecentEventsAsync(
            long userId,
            DateOnly weekStartUtc,
            int limit = 50,
            CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<AiUsageEvent>>([]);
    }

    private sealed class InMemoryUserVerificationTokenRepository : IUserVerificationTokenRepository
    {
        private readonly List<UserVerificationToken> _tokens = [];
        public Task AddAsync(UserVerificationToken token, CancellationToken cancellationToken = default)
        { _tokens.Add(token); return Task.CompletedTask; }
        public Task<UserVerificationToken?> FindByHashAsync(string type, string tokenHash, CancellationToken cancellationToken = default)
            => Task.FromResult(_tokens.FirstOrDefault(t => t.Type == type && t.TokenHash == tokenHash));
        public Task UpdateAsync(UserVerificationToken token, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task InvalidateAllAsync(long userId, string type, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class InMemoryUserAiSettingsRepository : IUserAiSettingsRepository
    {
        private readonly Dictionary<long, UserAiSettings> _settings = [];
        private readonly List<UserAiProviderKey> _keys = [];
        private long _keyIdCounter = 1;

        public Task<UserAiSettings?> GetSettingsAsync(long userId, CancellationToken cancellationToken = default)
            => Task.FromResult(_settings.TryGetValue(userId, out var s) ? s : null);

        public Task<UserAiSettings> EnsureSettingsAsync(long userId, CancellationToken cancellationToken = default)
        {
            if (!_settings.TryGetValue(userId, out var s))
            {
                s = new UserAiSettings(userId);
                _settings[userId] = s;
            }
            return Task.FromResult(s);
        }

        public Task UpdateAsync(UserAiSettings settings, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<UserAiProviderKey?> GetKeyAsync(long userId, long keyId, CancellationToken cancellationToken = default)
            => Task.FromResult(_keys.FirstOrDefault(k => k.UserId == userId && k.Id == keyId));

        public Task<IReadOnlyList<UserAiProviderKey>> GetKeysAsync(long userId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<UserAiProviderKey>>(_keys.Where(k => k.UserId == userId).ToList());

        public Task AddKeyAsync(long userId, UserAiProviderKey key, CancellationToken cancellationToken = default)
        {
            typeof(UserAiProviderKey).GetProperty("Id")?.SetValue(key, _keyIdCounter++);
            _keys.Add(key);
            return Task.CompletedTask;
        }

        public Task UpdateKeyAsync(UserAiProviderKey key, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task DeleteKeyAsync(long userId, long keyId, CancellationToken cancellationToken = default)
        {
            _keys.RemoveAll(k => k.UserId == userId && k.Id == keyId);
            return Task.CompletedTask;
        }

        public Task<bool> AliasExistsAsync(long userId, string alias, long? excludeKeyId = null, CancellationToken cancellationToken = default)
            => Task.FromResult(_keys.Any(k =>
                k.UserId == userId &&
                string.Equals(k.Alias, alias, StringComparison.OrdinalIgnoreCase) &&
                (excludeKeyId == null || k.Id != excludeKeyId.Value)));
    }

    private sealed class InMemoryUserRepository : IUserRepository
    {
        private readonly List<User> _users = [];
        private readonly List<RefreshToken> _tokens = [];
        private long _userIdCounter = 1;
        private long _tokenIdCounter = 1;

        public Task<User?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
            => Task.FromResult(_users.FirstOrDefault(u => u.Id == id));

        public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
            => Task.FromResult(_users.FirstOrDefault(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)));

        public Task<User> AddAsync(User user, CancellationToken cancellationToken = default)
        {
            typeof(User).GetProperty("Id")?.SetValue(user, _userIdCounter++);
            _users.Add(user);
            return Task.FromResult(user);
        }

        public Task UpdateAsync(User user, CancellationToken cancellationToken = default) => Task.CompletedTask;

        public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default)
            => Task.FromResult(_users.Any(u => string.Equals(u.Email, email, StringComparison.OrdinalIgnoreCase)));

        public Task SaveRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
        {
            typeof(RefreshToken).GetProperty("Id")?.SetValue(refreshToken, _tokenIdCounter++);
            _tokens.Add(refreshToken);
            return Task.CompletedTask;
        }

        public Task<RefreshToken?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
            => Task.FromResult(_tokens.FirstOrDefault(t => t.Token == token));

        public Task RevokeRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
        {
            _tokens.FirstOrDefault(t => t.Token == token)?.Revoke();
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<RefreshToken>> GetActiveSessionsAsync(long userId, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<RefreshToken>>(
                _tokens.Where(t => t.UserId == userId && t.IsActive).OrderByDescending(t => t.LastUsedAtUtc).ToList());

        public Task<RefreshToken?> GetSessionByIdAsync(long userId, long sessionId, CancellationToken cancellationToken = default)
            => Task.FromResult(_tokens.FirstOrDefault(t => t.UserId == userId && t.Id == sessionId));

        public Task UpdateRefreshTokenAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default) => Task.CompletedTask;

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
