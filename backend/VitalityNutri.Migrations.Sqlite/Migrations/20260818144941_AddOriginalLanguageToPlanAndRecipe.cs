using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VitalityNutri.Migrations.Sqlite.Migrations
{
    /// <inheritdoc />
    public partial class AddOriginalLanguageToPlanAndRecipe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "original_language",
                table: "recipes",
                type: "TEXT",
                maxLength: 10,
                nullable: false,
                defaultValue: "es");

            migrationBuilder.AddColumn<string>(
                name: "original_language",
                table: "plans",
                type: "TEXT",
                maxLength: 10,
                nullable: false,
                defaultValue: "es");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "original_language",
                table: "recipes");

            migrationBuilder.DropColumn(
                name: "original_language",
                table: "plans");
        }
    }
}
