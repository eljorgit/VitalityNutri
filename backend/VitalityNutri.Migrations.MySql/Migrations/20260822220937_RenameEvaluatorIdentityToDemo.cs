using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VitalityNutri.Migrations.MySql.Migrations
{
    /// <inheritdoc />
    public partial class RenameEvaluatorIdentityToDemo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE users
                SET email = 'demo@vitalitynutri.com',
                    full_name = 'Usuario Demostración',
                    role = 'Demo'
                WHERE email = 'evaluator@vitalitynutri.com';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE users
                SET email = 'evaluator@vitalitynutri.com',
                    full_name = 'Academic Evaluator',
                    role = 'Evaluator'
                WHERE email = 'demo@vitalitynutri.com';
                """);
        }
    }
}
