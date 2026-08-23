using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace VitalityNutri.Migrations.MySql.Migrations
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
                type: "varchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ip_address",
                table: "refresh_tokens",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true);

            // Raw SQL: the official MySQL provider serializes a DateTimeOffset default with an
            // offset suffix that MySQL's `datetime` type rejects. Emit a plain literal instead.
            migrationBuilder.Sql(
                "ALTER TABLE refresh_tokens ADD COLUMN last_used_at datetime NOT NULL DEFAULT '1000-01-01 00:00:00';");

            migrationBuilder.AddColumn<string>(
                name: "user_agent",
                table: "refresh_tokens",
                type: "varchar(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ai_usage_weekly",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    week_start_utc = table.Column<DateOnly>(type: "date", nullable: false),
                    credits_used = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false, defaultValue: 0m),
                    updated_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_usage_weekly", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "user_ai_provider_keys",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    provider_type = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    alias = table.Column<string>(type: "varchar(128)", maxLength: 128, nullable: false),
                    encrypted_api_key = table.Column<string>(type: "text", nullable: false),
                    key_last4 = table.Column<string>(type: "varchar(8)", maxLength: 8, nullable: false),
                    base_url = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: true),
                    is_validated = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    validated_at = table.Column<DateTimeOffset>(type: "datetime", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_ai_provider_keys", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "user_ai_settings",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    mode = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, defaultValue: "Platform"),
                    chain_overrides_json = table.Column<string>(type: "json", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_ai_settings", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "user_verification_tokens",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    token_hash = table.Column<string>(type: "varchar(128)", maxLength: 128, nullable: false),
                    pending_email = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false),
                    consumed_at = table.Column<DateTimeOffset>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_verification_tokens", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

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

            // Backfill: split legacy full names (first_name holds the entire legacy value at
            // this point) into first_name + surname, and seed session metadata for pre-existing refresh tokens.
            migrationBuilder.Sql(@"
UPDATE users
SET surname = CASE
        WHEN LOCATE(' ', TRIM(first_name)) > 0 THEN TRIM(SUBSTRING(TRIM(first_name), LOCATE(' ', TRIM(first_name)) + 1))
        ELSE ''
    END,
    first_name = SUBSTRING_INDEX(TRIM(first_name), ' ', 1);");

            migrationBuilder.Sql(@"
UPDATE refresh_tokens SET last_used_at = created_at WHERE last_used_at < '2000-01-01';");
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
