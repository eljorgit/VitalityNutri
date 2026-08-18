using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VitalityNutri.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class InitialSqlite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "completed_recipes_state",
                columns: table => new
                {
                    plan_id = table.Column<long>(type: "INTEGER", nullable: false),
                    completed_json = table.Column<string>(type: "json", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_completed_recipes_state", x => x.plan_id);
                });

            migrationBuilder.CreateTable(
                name: "grocery_list_state",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false),
                    checked_items_json = table.Column<string>(type: "json", nullable: false),
                    list_type = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    selected_single_day = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    selected_3days_start = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    excluded_meals_json = table.Column<string>(type: "json", nullable: false),
                    multipliers_json = table.Column<string>(type: "json", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_grocery_list_state", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ingredients",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    category = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ingredients", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "plans",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    file_name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    saved_file_name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    plan_json = table.Column<string>(type: "json", nullable: false),
                    metadata_json = table.Column<string>(type: "json", nullable: false),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false),
                    file_hash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_plans", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ingredients_name",
                table: "ingredients",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_plans_file_hash",
                table: "plans",
                column: "file_hash");

            migrationBuilder.CreateIndex(
                name: "IX_plans_is_active",
                table: "plans",
                column: "is_active");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "completed_recipes_state");

            migrationBuilder.DropTable(
                name: "grocery_list_state");

            migrationBuilder.DropTable(
                name: "ingredients");

            migrationBuilder.DropTable(
                name: "plans");
        }
    }
}
