using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace VitalityNutri.Migrations.MySql.Migrations
{
    /// <inheritdoc />
    public partial class AddTranslationCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "plan_translations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    plan_id = table.Column<long>(type: "bigint", nullable: false),
                    target_language = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false),
                    plan_json = table.Column<string>(type: "json", nullable: false),
                    is_ai_translated = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_plan_translations", x => x.id);
                    table.ForeignKey(
                        name: "FK_plan_translations_plans_plan_id",
                        column: x => x.plan_id,
                        principalTable: "plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "recipe_translations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    recipe_id = table.Column<long>(type: "bigint", nullable: false),
                    target_language = table.Column<string>(type: "varchar(10)", maxLength: 10, nullable: false),
                    recipe_name = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: false),
                    tips = table.Column<string>(type: "text", nullable: false),
                    nutritionist_tips = table.Column<string>(type: "text", nullable: true),
                    ingredients_json = table.Column<string>(type: "json", nullable: false),
                    steps_json = table.Column<string>(type: "json", nullable: false),
                    is_ai_translated = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recipe_translations", x => x.id);
                    table.ForeignKey(
                        name: "FK_recipe_translations_recipes_recipe_id",
                        column: x => x.recipe_id,
                        principalTable: "recipes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_plan_translations_plan_id_target_language",
                table: "plan_translations",
                columns: new[] { "plan_id", "target_language" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_recipe_translations_recipe_id_target_language",
                table: "recipe_translations",
                columns: new[] { "recipe_id", "target_language" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "plan_translations");

            migrationBuilder.DropTable(
                name: "recipe_translations");
        }
    }
}
