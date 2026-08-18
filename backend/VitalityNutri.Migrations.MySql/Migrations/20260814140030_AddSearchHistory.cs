using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace VitalityNutri.Migrations.MySql.Migrations
{
    /// <inheritdoc />
    public partial class AddSearchHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "search_history",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    plan_id = table.Column<long>(type: "bigint", nullable: false),
                    plan_name = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: false),
                    day = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false),
                    meal = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false),
                    recipe_name = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: false),
                    image = table.Column<string>(type: "varchar(2048)", maxLength: 2048, nullable: false),
                    is_active = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    clicked_at = table.Column<DateTimeOffset>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_search_history", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

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
