using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VitalityNutri.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class AddRecipesSqlite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "recipes",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    recipe_name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    calories = table.Column<int>(type: "INTEGER", nullable: false),
                    time = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    tag = table.Column<string>(type: "TEXT", maxLength: 255, nullable: true),
                    image = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: true),
                    ingredients_json = table.Column<string>(type: "json", nullable: false),
                    tips = table.Column<string>(type: "text", nullable: false),
                    steps_json = table.Column<string>(type: "json", nullable: false),
                    nutritionist_tips = table.Column<string>(type: "text", nullable: true),
                    nutrition_json = table.Column<string>(type: "json", nullable: true),
                    servings = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 1),
                    source = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false, defaultValue: "manual"),
                    source_plan_id = table.Column<long>(type: "INTEGER", nullable: true),
                    is_ai_generated = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    is_favorite = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    season = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false, defaultValue: "Todas"),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recipes", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_recipes_created_at",
                table: "recipes",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_recipes_recipe_name",
                table: "recipes",
                column: "recipe_name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "recipes");
        }
    }
}
