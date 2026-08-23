using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Domain.Entities;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Persistence;

public sealed class VitalityNutriDbContext(
    DbContextOptions<VitalityNutriDbContext> options,
    ApiConfiguration? apiConfiguration = null,
    ICurrentUserProvider? currentUserProvider = null)
    : DbContext(options)
{
    private readonly bool _isSaaS = string.Equals(apiConfiguration?.App.Mode, "SaaS", StringComparison.OrdinalIgnoreCase);

    public bool IsSaaS => _isSaaS;
    public long? CurrentUserId => currentUserProvider?.GetCurrentUserId();

    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<MealPlan> MealPlans => Set<MealPlan>();
    public DbSet<GroceryListState> GroceryListStates => Set<GroceryListState>();
    public DbSet<CompletedRecipesState> CompletedRecipesStates => Set<CompletedRecipesState>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<SearchHistoryItem> SearchHistoryItems => Set<SearchHistoryItem>();
    public DbSet<BatchCookingState> BatchCookingStates => Set<BatchCookingState>();
    public DbSet<RecipeTranslation> RecipeTranslations => Set<RecipeTranslation>();
    public DbSet<MealPlanTranslation> MealPlanTranslations => Set<MealPlanTranslation>();
    public DbSet<UserAiProviderKey> UserAiProviderKeys => Set<UserAiProviderKey>();
    public DbSet<UserAiSettings> UserAiSettings => Set<UserAiSettings>();
    public DbSet<AiUsageWeekly> AiUsageWeeklies => Set<AiUsageWeekly>();
    public DbSet<UserVerificationToken> UserVerificationTokens => Set<UserVerificationToken>();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        if (_isSaaS && currentUserProvider is not null)
        {
            var currentUserId = currentUserProvider.GetCurrentUserId();
            if (currentUserId.HasValue)
            {
                foreach (var entry in ChangeTracker.Entries())
                {
                    if (entry.State == EntityState.Added)
                    {
                        var prop = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "UserId");
                        if (prop is not null && prop.CurrentValue is null)
                        {
                            prop.CurrentValue = currentUserId.Value;
                        }
                    }
                }
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // --- Users ---
        var user = modelBuilder.Entity<User>();
        user.ToTable("users");
        user.HasKey(u => u.Id);
        user.Property(u => u.Id).HasColumnName("id");
        user.Property(u => u.Email).HasColumnName("email").HasMaxLength(255).IsRequired();
        user.Property(u => u.PasswordHash).HasColumnName("password_hash").HasMaxLength(512).IsRequired();
        user.Property(u => u.PasswordSalt).HasColumnName("password_salt").HasMaxLength(256).IsRequired();
        user.Property(u => u.FirstName).HasColumnName("first_name").HasMaxLength(255).IsRequired();
        user.Property(u => u.Surname).HasColumnName("surname").HasMaxLength(255).HasDefaultValue(string.Empty).IsRequired();
        user.Ignore(u => u.FullName);
        user.Property(u => u.Role).HasColumnName("role").HasMaxLength(64).HasDefaultValue("User").IsRequired();
        user.Property(u => u.AuthProvider).HasColumnName("auth_provider").HasMaxLength(64).HasDefaultValue("local").IsRequired();
        user.Property(u => u.IsActive).HasColumnName("is_active").HasDefaultValue(true).IsRequired();
        user.Property(u => u.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        user.Property(u => u.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        user.HasIndex(u => u.Email).IsUnique();
        user.HasIndex(u => u.Role);

        // --- Refresh Tokens ---
        var refreshToken = modelBuilder.Entity<RefreshToken>();
        refreshToken.ToTable("refresh_tokens");
        refreshToken.HasKey(r => r.Id);
        refreshToken.Property(r => r.Id).HasColumnName("id");
        refreshToken.Property(r => r.UserId).HasColumnName("user_id").IsRequired();
        refreshToken.Property(r => r.Token).HasColumnName("token").HasMaxLength(512).IsRequired();
        refreshToken.Property(r => r.ExpiresAtUtc).HasColumnName("expires_at").IsRequired();
        refreshToken.Property(r => r.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        refreshToken.Property(r => r.IsRevoked).HasColumnName("is_revoked").HasDefaultValue(false).IsRequired();
        refreshToken.Property(r => r.UserAgent).HasColumnName("user_agent").HasMaxLength(512);
        refreshToken.Property(r => r.IpAddress).HasColumnName("ip_address").HasMaxLength(64);
        refreshToken.Property(r => r.LastUsedAtUtc).HasColumnName("last_used_at").IsRequired();
        refreshToken.HasIndex(r => r.UserId);
        refreshToken.HasIndex(r => r.Token).IsUnique();

        // --- Meal Plans ---
        var mealPlan = modelBuilder.Entity<MealPlan>();
        mealPlan.ToTable("plans");
        mealPlan.HasKey(plan => plan.Id);
        mealPlan.Property(plan => plan.Id).HasColumnName("id");
        mealPlan.Property(plan => plan.FileName).HasColumnName("file_name").HasMaxLength(512);
        mealPlan.Property(plan => plan.SavedFileName).HasColumnName("saved_file_name").HasMaxLength(512);
        mealPlan.Property(plan => plan.PlanJson).HasColumnName("plan_json").HasColumnType("json").IsRequired();
        mealPlan.Property(plan => plan.MetadataJson).HasColumnName("metadata_json").HasColumnType("json").IsRequired();
        mealPlan.Property(plan => plan.IsActive).HasColumnName("is_active").IsRequired();
        mealPlan.Property(plan => plan.FileHash).HasColumnName("file_hash").HasMaxLength(64);
        mealPlan.Property(plan => plan.OriginalLanguage).HasColumnName("original_language").HasMaxLength(10).HasDefaultValue("es").IsRequired();
        mealPlan.Property(plan => plan.UserId).HasColumnName("user_id");
        mealPlan.Property(plan => plan.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        mealPlan.Property(plan => plan.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        mealPlan.HasIndex(plan => plan.IsActive);
        mealPlan.HasIndex(plan => plan.FileHash);
        mealPlan.HasIndex(plan => plan.UserId);
        mealPlan.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- Grocery List State ---
        var grocery = modelBuilder.Entity<GroceryListState>();
        grocery.ToTable("grocery_list_state");
        grocery.HasKey(x => x.Id);
        grocery.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        grocery.Property(x => x.CheckedItemsJson).HasColumnName("checked_items_json").HasColumnType("json").IsRequired();
        grocery.Property(x => x.ListType).HasColumnName("list_type").HasMaxLength(32).IsRequired();
        grocery.Property(x => x.SelectedSingleDay).HasColumnName("selected_single_day").HasMaxLength(32).IsRequired();
        grocery.Property(x => x.SelectedThreeDaysStart).HasColumnName("selected_3days_start").HasMaxLength(32).IsRequired();
        grocery.Property(x => x.ExcludedMealsJson).HasColumnName("excluded_meals_json").HasColumnType("json").IsRequired();
        grocery.Property(x => x.MultipliersJson).HasColumnName("multipliers_json").HasColumnType("json").IsRequired();
        grocery.Property(x => x.UserId).HasColumnName("user_id");
        grocery.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        grocery.HasIndex(x => x.UserId);
        grocery.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- Completed Recipes State ---
        var completed = modelBuilder.Entity<CompletedRecipesState>();
        completed.ToTable("completed_recipes_state");
        completed.HasKey(x => x.PlanId);
        completed.Property(x => x.PlanId).HasColumnName("plan_id").ValueGeneratedNever();
        completed.Property(x => x.CompletedJson).HasColumnName("completed_json").HasColumnType("json").IsRequired();
        completed.Property(x => x.UserId).HasColumnName("user_id");
        completed.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        completed.HasIndex(x => x.UserId);
        completed.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- Search History Items ---
        var searchHistory = modelBuilder.Entity<SearchHistoryItem>();
        searchHistory.ToTable("search_history");
        searchHistory.HasKey(x => x.Id);
        searchHistory.Property(x => x.Id).HasColumnName("id");
        searchHistory.Property(x => x.PlanId).HasColumnName("plan_id").IsRequired();
        searchHistory.Property(x => x.PlanName).HasColumnName("plan_name").HasMaxLength(512).IsRequired();
        searchHistory.Property(x => x.Day).HasColumnName("day").HasMaxLength(32).IsRequired();
        searchHistory.Property(x => x.Meal).HasColumnName("meal").HasMaxLength(32).IsRequired();
        searchHistory.Property(x => x.RecipeName).HasColumnName("recipe_name").HasMaxLength(512).IsRequired();
        searchHistory.Property(x => x.Image).HasColumnName("image").HasMaxLength(2048).IsRequired();
        searchHistory.Property(x => x.IsActive).HasColumnName("is_active").HasDefaultValue(false).IsRequired();
        searchHistory.Property(x => x.UserId).HasColumnName("user_id");
        searchHistory.Property(x => x.ClickedAtUtc).HasColumnName("clicked_at").IsRequired();
        searchHistory.HasIndex(x => x.ClickedAtUtc);
        searchHistory.HasIndex(x => x.PlanId);
        searchHistory.HasIndex(x => x.UserId);
        searchHistory.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- Batch Cooking State ---
        var batchCooking = modelBuilder.Entity<BatchCookingState>();
        batchCooking.ToTable("batch_cooking_state");
        batchCooking.HasKey(x => x.PlanId);
        batchCooking.Property(x => x.PlanId).HasColumnName("plan_id").ValueGeneratedNever();
        batchCooking.Property(x => x.GuideJson).HasColumnName("guide_json").HasColumnType("json").IsRequired();
        batchCooking.Property(x => x.ParamsJson).HasColumnName("params_json").HasColumnType("json").IsRequired();
        batchCooking.Property(x => x.UserId).HasColumnName("user_id");
        batchCooking.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        batchCooking.HasIndex(x => x.UserId);
        batchCooking.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- Ingredients ---
        var ingredient = modelBuilder.Entity<Ingredient>();
        ingredient.ToTable("ingredients");
        ingredient.HasKey(x => x.Id);
        ingredient.Property(x => x.Id).HasColumnName("id");
        ingredient.Property(x => x.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        ingredient.Property(x => x.Category).HasColumnName("category").HasMaxLength(128).IsRequired();
        ingredient.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        ingredient.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        ingredient.HasIndex(x => x.Name).IsUnique();

        // --- Recipes ---
        var recipe = modelBuilder.Entity<Recipe>();
        recipe.ToTable("recipes");
        recipe.HasKey(x => x.Id);
        recipe.Property(x => x.Id).HasColumnName("id");
        recipe.Property(x => x.RecipeName).HasColumnName("recipe_name").HasMaxLength(512).IsRequired();
        recipe.Property(x => x.Calories).HasColumnName("calories").IsRequired();
        recipe.Property(x => x.Time).HasColumnName("time").HasMaxLength(64).IsRequired();
        recipe.Property(x => x.Tag).HasColumnName("tag").HasMaxLength(255);
        recipe.Property(x => x.Image).HasColumnName("image").HasMaxLength(2048);
        recipe.Property(x => x.IngredientsJson).HasColumnName("ingredients_json").HasColumnType("json").IsRequired();
        recipe.Property(x => x.Tips).HasColumnName("tips").HasColumnType("text").IsRequired();
        recipe.Property(x => x.StepsJson).HasColumnName("steps_json").HasColumnType("json").IsRequired();
        recipe.Property(x => x.NutritionistTips).HasColumnName("nutritionist_tips").HasColumnType("text");
        recipe.Property(x => x.NutritionJson).HasColumnName("nutrition_json").HasColumnType("json");
        recipe.Property(x => x.Servings).HasColumnName("servings").HasDefaultValue(1).IsRequired();
        recipe.Property(x => x.Source).HasColumnName("source").HasMaxLength(32).HasDefaultValue("manual").IsRequired();
        recipe.Property(x => x.SourcePlanId).HasColumnName("source_plan_id");
        recipe.Property(x => x.IsAiGenerated).HasColumnName("is_ai_generated").HasDefaultValue(false).IsRequired();
        recipe.Property(x => x.IsFavorite).HasColumnName("is_favorite").HasDefaultValue(false).IsRequired();
        recipe.Property(x => x.Season).HasColumnName("season").HasMaxLength(64).HasDefaultValue("Todas").IsRequired();
        recipe.Property(x => x.OriginalLanguage).HasColumnName("original_language").HasMaxLength(10).HasDefaultValue("es").IsRequired();
        recipe.Property(x => x.UserId).HasColumnName("user_id");
        recipe.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        recipe.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        recipe.HasIndex(x => x.RecipeName);
        recipe.HasIndex(x => x.UserId);
        recipe.HasIndex(x => x.CreatedAtUtc);
        recipe.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- Recipe Translations ---
        var recipeTranslation = modelBuilder.Entity<RecipeTranslation>();
        recipeTranslation.ToTable("recipe_translations");
        recipeTranslation.HasKey(x => x.Id);
        recipeTranslation.Property(x => x.Id).HasColumnName("id");
        recipeTranslation.Property(x => x.RecipeId).HasColumnName("recipe_id").IsRequired();
        recipeTranslation.Property(x => x.TargetLanguage).HasColumnName("target_language").HasMaxLength(10).IsRequired();
        recipeTranslation.Property(x => x.RecipeName).HasColumnName("recipe_name").HasMaxLength(512).IsRequired();
        recipeTranslation.Property(x => x.Tips).HasColumnName("tips").HasColumnType("text").IsRequired();
        recipeTranslation.Property(x => x.NutritionistTips).HasColumnName("nutritionist_tips").HasColumnType("text");
        recipeTranslation.Property(x => x.IngredientsJson).HasColumnName("ingredients_json").HasColumnType("json").IsRequired();
        recipeTranslation.Property(x => x.StepsJson).HasColumnName("steps_json").HasColumnType("json").IsRequired();
        recipeTranslation.Property(x => x.IsAiTranslated).HasColumnName("is_ai_translated").HasDefaultValue(false).IsRequired();
        recipeTranslation.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        recipeTranslation.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        recipeTranslation.HasOne<Recipe>()
            .WithMany()
            .HasForeignKey(x => x.RecipeId)
            .OnDelete(DeleteBehavior.Cascade);
        recipeTranslation.HasIndex(x => new { x.RecipeId, x.TargetLanguage }).IsUnique();

        // --- Plan Translations ---
        var planTranslation = modelBuilder.Entity<MealPlanTranslation>();
        planTranslation.ToTable("plan_translations");
        planTranslation.HasKey(x => x.Id);
        planTranslation.Property(x => x.Id).HasColumnName("id");
        planTranslation.Property(x => x.PlanId).HasColumnName("plan_id").IsRequired();
        planTranslation.Property(x => x.TargetLanguage).HasColumnName("target_language").HasMaxLength(10).IsRequired();
        planTranslation.Property(x => x.PlanJson).HasColumnName("plan_json").HasColumnType("json").IsRequired();
        planTranslation.Property(x => x.IsAiTranslated).HasColumnName("is_ai_translated").HasDefaultValue(false).IsRequired();
        planTranslation.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        planTranslation.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        planTranslation.HasOne<MealPlan>()
            .WithMany()
            .HasForeignKey(x => x.PlanId)
            .OnDelete(DeleteBehavior.Cascade);
        planTranslation.HasIndex(x => new { x.PlanId, x.TargetLanguage }).IsUnique();

        // --- User AI Provider Keys (BYOK) ---
        var userAiProviderKey = modelBuilder.Entity<UserAiProviderKey>();
        userAiProviderKey.ToTable("user_ai_provider_keys");
        userAiProviderKey.HasKey(x => x.Id);
        userAiProviderKey.Property(x => x.Id).HasColumnName("id");
        userAiProviderKey.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        userAiProviderKey.Property(x => x.ProviderType).HasColumnName("provider_type").HasMaxLength(64).IsRequired();
        userAiProviderKey.Property(x => x.Alias).HasColumnName("alias").HasMaxLength(128).IsRequired();
        userAiProviderKey.Property(x => x.EncryptedApiKey).HasColumnName("encrypted_api_key").HasColumnType("text").IsRequired();
        userAiProviderKey.Property(x => x.KeyLast4).HasColumnName("key_last4").HasMaxLength(8).IsRequired();
        userAiProviderKey.Property(x => x.BaseUrl).HasColumnName("base_url").HasMaxLength(512);
        userAiProviderKey.Property(x => x.IsValidated).HasColumnName("is_validated").HasDefaultValue(false).IsRequired();
        userAiProviderKey.Property(x => x.ValidatedAtUtc).HasColumnName("validated_at");
        userAiProviderKey.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        userAiProviderKey.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        userAiProviderKey.HasIndex(x => x.UserId);
        userAiProviderKey.HasIndex(x => new { x.UserId, x.Alias }).IsUnique();
        userAiProviderKey.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- User AI Settings ---
        var userAiSettings = modelBuilder.Entity<UserAiSettings>();
        userAiSettings.ToTable("user_ai_settings");
        userAiSettings.HasKey(x => x.Id);
        userAiSettings.Property(x => x.Id).HasColumnName("id");
        userAiSettings.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        userAiSettings.Property(x => x.Mode).HasColumnName("mode").HasMaxLength(32).HasDefaultValue(VitalityNutri.Domain.Entities.UserAiSettings.ModePlatform).IsRequired();
        userAiSettings.Property(x => x.ChainOverridesJson).HasColumnName("chain_overrides_json").HasColumnType("json").IsRequired();
        userAiSettings.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        userAiSettings.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        userAiSettings.HasIndex(x => x.UserId).IsUnique();
        userAiSettings.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- AI Usage (weekly credits) ---
        var aiUsageWeekly = modelBuilder.Entity<AiUsageWeekly>();
        aiUsageWeekly.ToTable("ai_usage_weekly");
        aiUsageWeekly.HasKey(x => x.Id);
        aiUsageWeekly.Property(x => x.Id).HasColumnName("id");
        aiUsageWeekly.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        aiUsageWeekly.Property(x => x.WeekStartUtc).HasColumnName("week_start_utc").IsRequired();
        aiUsageWeekly.Property(x => x.CreditsUsed).HasColumnName("credits_used").HasPrecision(8, 2).HasDefaultValue(0m).IsRequired();
        aiUsageWeekly.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        aiUsageWeekly.HasIndex(x => new { x.UserId, x.WeekStartUtc }).IsUnique();
        aiUsageWeekly.HasQueryFilter(x => !IsSaaS || x.UserId == CurrentUserId);

        // --- User Verification Tokens (pre-auth lookup, no tenant filter) ---
        var verificationToken = modelBuilder.Entity<UserVerificationToken>();
        verificationToken.ToTable("user_verification_tokens");
        verificationToken.HasKey(x => x.Id);
        verificationToken.Property(x => x.Id).HasColumnName("id");
        verificationToken.Property(x => x.UserId).HasColumnName("user_id").IsRequired();
        verificationToken.Property(x => x.Type).HasColumnName("type").HasMaxLength(64).IsRequired();
        verificationToken.Property(x => x.TokenHash).HasColumnName("token_hash").HasMaxLength(128).IsRequired();
        verificationToken.Property(x => x.PendingEmail).HasColumnName("pending_email").HasMaxLength(255);
        verificationToken.Property(x => x.ExpiresAtUtc).HasColumnName("expires_at").IsRequired();
        verificationToken.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        verificationToken.Property(x => x.ConsumedAtUtc).HasColumnName("consumed_at");
        verificationToken.HasIndex(x => x.TokenHash).IsUnique();
        verificationToken.HasIndex(x => x.UserId);
    }
}
