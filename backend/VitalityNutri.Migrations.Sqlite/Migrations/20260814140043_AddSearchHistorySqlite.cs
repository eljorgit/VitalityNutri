using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VitalityNutri.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class AddSearchHistorySqlite : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "search_history",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    plan_id = table.Column<long>(type: "INTEGER", nullable: false),
                    plan_name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    day = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    meal = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    recipe_name = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    image = table.Column<string>(type: "TEXT", maxLength: 2048, nullable: false),
                    is_active = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    clicked_at = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_search_history", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_search_history_clicked_at",
                table: "search_history",
                column: "clicked_at");

            migrationBuilder.CreateIndex(
                name: "IX_search_history_plan_id",
                table: "search_history",
                column: "plan_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "search_history");
        }
    }
}
