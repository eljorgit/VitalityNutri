using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace VitalityNutri.Migrations.MySql.Migrations
{
    /// <inheritdoc />
    public partial class AddAiUsageEventsLog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_usage_events",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    week_start_utc = table.Column<DateTime>(type: "date", nullable: false),
                    operation = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    chain_name = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: false),
                    credits_delta = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    balance_after = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false, defaultValue: 0m),
                    created_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_usage_events", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ai_usage_events_created_at",
                table: "ai_usage_events",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_ai_usage_events_user_id_week_start_utc",
                table: "ai_usage_events",
                columns: new[] { "user_id", "week_start_utc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_usage_events");
        }
    }
}
