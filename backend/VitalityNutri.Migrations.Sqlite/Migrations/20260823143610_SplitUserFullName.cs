using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VitalityNutri.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class SplitUserFullName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "full_name",
                table: "users",
                newName: "first_name");

            migrationBuilder.AddColumn<string>(
                name: "surname",
                table: "users",
                type: "TEXT",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ip_address",
                table: "refresh_tokens",
                type: "TEXT",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_used_at",
                table: "refresh_tokens",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "user_agent",
                table: "refresh_tokens",
                type: "TEXT",
                maxLength: 512,
                nullable: true);

            // Backfill: split legacy full names (first_name holds the entire legacy value at
            // this point) into first_name + surname, and seed session metadata for pre-existing refresh tokens.
            migrationBuilder.Sql(@"
UPDATE users
SET first_name = TRIM(SUBSTR(TRIM(first_name), 1, COALESCE(NULLIF(INSTR(TRIM(first_name), ' '), 0) - 1, LENGTH(TRIM(first_name))))),
    surname = CASE
        WHEN INSTR(TRIM(first_name), ' ') > 0 THEN LTRIM(SUBSTR(TRIM(first_name), INSTR(TRIM(first_name), ' ')))
        ELSE ''
    END;");

            migrationBuilder.Sql(@"
UPDATE refresh_tokens SET last_used_at = created_at WHERE last_used_at < '2000-01-01';");

            migrationBuilder.CreateTable(
                name: "ai_usage_weekly",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<long>(type: "INTEGER", nullable: false),
                    week_start_utc = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    credits_used = table.Column<decimal>(type: "TEXT", precision: 8, scale: 2, nullable: false, defaultValue: 0m),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_usage_weekly", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_ai_provider_keys",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<long>(type: "INTEGER", nullable: false),
                    provider_type = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    alias = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    encrypted_api_key = table.Column<string>(type: "text", nullable: false),
                    key_last4 = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    base_url = table.Column<string>(type: "TEXT", maxLength: 512, nullable: true),
                    is_validated = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    validated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_ai_provider_keys", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_ai_settings",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<long>(type: "INTEGER", nullable: false),
                    mode = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false, defaultValue: "Platform"),
                    chain_overrides_json = table.Column<string>(type: "json", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_ai_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "user_verification_tokens",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<long>(type: "INTEGER", nullable: false),
                    type = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    token_hash = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    pending_email = table.Column<string>(type: "TEXT", maxLength: 255, nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    consumed_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_verification_tokens", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ai_usage_weekly_user_id_week_start_utc",
                table: "ai_usage_weekly",
                columns: new[] { "user_id", "week_start_utc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_ai_provider_keys_user_id",
                table: "user_ai_provider_keys",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_ai_provider_keys_user_id_alias",
                table: "user_ai_provider_keys",
                columns: new[] { "user_id", "alias" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_ai_settings_user_id",
                table: "user_ai_settings",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_verification_tokens_token_hash",
                table: "user_verification_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_verification_tokens_user_id",
                table: "user_verification_tokens",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_usage_weekly");

            migrationBuilder.DropTable(
                name: "user_ai_provider_keys");

            migrationBuilder.DropTable(
                name: "user_ai_settings");

            migrationBuilder.DropTable(
                name: "user_verification_tokens");

            migrationBuilder.DropColumn(
                name: "surname",
                table: "users");

            migrationBuilder.DropColumn(
                name: "ip_address",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "last_used_at",
                table: "refresh_tokens");

            migrationBuilder.DropColumn(
                name: "user_agent",
                table: "refresh_tokens");

            migrationBuilder.RenameColumn(
                name: "first_name",
                table: "users",
                newName: "full_name");
        }
    }
}
