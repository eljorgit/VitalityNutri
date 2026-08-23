using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VitalityNutri.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAuthenticationAndMultiTenancy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_recipes_recipe_name",
                table: "recipes");

            migrationBuilder.AddColumn<long>(
                name: "user_id",
                table: "search_history",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "user_id",
                table: "recipes",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "user_id",
                table: "plans",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "user_id",
                table: "grocery_list_state",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "user_id",
                table: "completed_recipes_state",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "user_id",
                table: "batch_cooking_state",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<long>(type: "INTEGER", nullable: false),
                    token = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    is_revoked = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    email = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    password_salt = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    full_name = table.Column<string>(type: "TEXT", maxLength: 255, nullable: false),
                    role = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false, defaultValue: "User"),
                    auth_provider = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false, defaultValue: "local"),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_search_history_user_id",
                table: "search_history",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_recipes_recipe_name",
                table: "recipes",
                column: "recipe_name");

            migrationBuilder.CreateIndex(
                name: "IX_recipes_user_id",
                table: "recipes",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_plans_user_id",
                table: "plans",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_grocery_list_state_user_id",
                table: "grocery_list_state",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_completed_recipes_state_user_id",
                table: "completed_recipes_state",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_batch_cooking_state_user_id",
                table: "batch_cooking_state",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_token",
                table: "refresh_tokens",
                column: "token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_user_id",
                table: "refresh_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                table: "users",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_role",
                table: "users",
                column: "role");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropIndex(
                name: "IX_search_history_user_id",
                table: "search_history");

            migrationBuilder.DropIndex(
                name: "IX_recipes_recipe_name",
                table: "recipes");

            migrationBuilder.DropIndex(
                name: "IX_recipes_user_id",
                table: "recipes");

            migrationBuilder.DropIndex(
                name: "IX_plans_user_id",
                table: "plans");

            migrationBuilder.DropIndex(
                name: "IX_grocery_list_state_user_id",
                table: "grocery_list_state");

            migrationBuilder.DropIndex(
                name: "IX_completed_recipes_state_user_id",
                table: "completed_recipes_state");

            migrationBuilder.DropIndex(
                name: "IX_batch_cooking_state_user_id",
                table: "batch_cooking_state");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "search_history");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "recipes");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "plans");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "grocery_list_state");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "completed_recipes_state");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "batch_cooking_state");

            migrationBuilder.CreateIndex(
                name: "IX_recipes_recipe_name",
                table: "recipes",
                column: "recipe_name",
                unique: true);
        }
    }
}
