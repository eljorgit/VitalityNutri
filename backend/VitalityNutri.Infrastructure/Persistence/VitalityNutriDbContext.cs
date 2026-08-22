using Microsoft.EntityFrameworkCore;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence;

public sealed class VitalityNutriDbContext(DbContextOptions<VitalityNutriDbContext> options)
    : DbContext(options)
{
    public DbSet<MealPlan> MealPlans => Set<MealPlan>();
    public DbSet<GroceryListState> GroceryListStates => Set<GroceryListState>();
    public DbSet<CompletedRecipesState> CompletedRecipesStates => Set<CompletedRecipesState>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<Recipe> Recipes => Set<Recipe>();
    public DbSet<SearchHistoryItem> SearchHistoryItems => Set<SearchHistoryItem>();
    public DbSet<BatchCookingState> BatchCookingStates => Set<BatchCookingState>();
    public DbSet<RecipeTranslation> RecipeTranslations => Set<RecipeTranslation>();
    public DbSet<MealPlanTranslation> MealPlanTranslations => Set<MealPlanTranslation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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
        mealPlan.Property(plan => plan.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        mealPlan.Property(plan => plan.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        mealPlan.HasIndex(plan => plan.IsActive);
        mealPlan.HasIndex(plan => plan.FileHash);

        var grocery = modelBuilder.Entity<GroceryListState>();
        grocery.ToTable("grocery_list_state"); grocery.HasKey(x => x.Id);
        grocery.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        grocery.Property(x => x.CheckedItemsJson).HasColumnName("checked_items_json").HasColumnType("json").IsRequired();
        grocery.Property(x => x.ListType).HasColumnName("list_type").HasMaxLength(32).IsRequired();
        grocery.Property(x => x.SelectedSingleDay).HasColumnName("selected_single_day").HasMaxLength(32).IsRequired();
        grocery.Property(x => x.SelectedThreeDaysStart).HasColumnName("selected_3days_start").HasMaxLength(32).IsRequired();
        grocery.Property(x => x.ExcludedMealsJson).HasColumnName("excluded_meals_json").HasColumnType("json").IsRequired();
        grocery.Property(x => x.MultipliersJson).HasColumnName("multipliers_json").HasColumnType("json").IsRequired();
        grocery.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();

        var completed = modelBuilder.Entity<CompletedRecipesState>();
        completed.ToTable("completed_recipes_state"); completed.HasKey(x => x.PlanId);
        completed.Property(x => x.PlanId).HasColumnName("plan_id").ValueGeneratedNever();
        completed.Property(x => x.CompletedJson).HasColumnName("completed_json").HasColumnType("json").IsRequired();
        completed.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();

        var ingredient = modelBuilder.Entity<Ingredient>();
        ingredient.ToTable("ingredients"); ingredient.HasKey(x => x.Id);
        ingredient.Property(x => x.Id).HasColumnName("id");
        ingredient.Property(x => x.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
        ingredient.Property(x => x.Category).HasColumnName("category").HasMaxLength(128).IsRequired();
        ingredient.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        ingredient.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        ingredient.HasIndex(x => x.Name).IsUnique();

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
        searchHistory.Property(x => x.ClickedAtUtc).HasColumnName("clicked_at").IsRequired();
        searchHistory.HasIndex(x => x.PlanId);
        searchHistory.HasIndex(x => x.ClickedAtUtc);

        var batchCooking = modelBuilder.Entity<BatchCookingState>();
        batchCooking.ToTable("batch_cooking_state");
        batchCooking.HasKey(x => x.PlanId);
        batchCooking.Property(x => x.PlanId).HasColumnName("plan_id");
        batchCooking.Property(x => x.GuideJson).HasColumnName("guide_json").HasColumnType("json").IsRequired();
        batchCooking.Property(x => x.ParamsJson).HasColumnName("params_json").HasColumnType("json").IsRequired();
        batchCooking.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();

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
        recipe.Property(x => x.CreatedAtUtc).HasColumnName("created_at").IsRequired();
        recipe.Property(x => x.UpdatedAtUtc).HasColumnName("updated_at").IsRequired();
        recipe.HasIndex(x => x.RecipeName).IsUnique();
        recipe.HasIndex(x => x.CreatedAtUtc);

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
    }
}
