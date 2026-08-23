using System.Reflection;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using VitalityNutri.Application.Abstractions.Common;
using VitalityNutri.Domain.Entities;

namespace VitalityNutri.Infrastructure.Persistence;

public sealed class DemoSeeder(
    VitalityNutriDbContext dbContext,
    IPasswordHasher passwordHasher) : IDemoSeeder
{
    private const string DemoEmail = "demo@vitalitynutri.com";

    public async Task<User> EnsureDemoUserAndDataAsync(CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Email == DemoEmail, cancellationToken);
        if (user is null)
        {
            var (hash, salt) = passwordHasher.HashPassword("DemoMode2026!");
            var (demoFirstName, demoSurname) = User.SplitDisplayName("Usuario Demostración");
            user = new User(
                email: DemoEmail,
                passwordHash: hash,
                passwordSalt: salt,
                firstName: demoFirstName,
                surname: demoSurname,
                role: "Demo",
                authProvider: "demo");

            dbContext.Users.Add(user);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Same replace-all approach as backup import: entering demo mode starts from a
        // clean workspace, so the history contains exactly one PDF (the demo plan).
        await ResetWorkspaceForDemoAsync(user.Id, cancellationToken);

        // Check if sample plan already exists for this demo user (ignoring multi-tenant query filter)
        var hasPlan = await dbContext.MealPlans.IgnoreQueryFilters().AnyAsync(p => p.UserId == user.Id, cancellationToken);
        if (!hasPlan)
        {
            await SeedDemoDataAsync(user.Id, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return user;
    }

    private async Task ResetWorkspaceForDemoAsync(long demoUserId, CancellationToken cancellationToken)
    {
        if (!dbContext.IsSaaS)
        {
            // OSS mode shares a single dataset: mirror backup-import semantics and clear
            // every plan-derived table before seeding the demo content.
            dbContext.SearchHistoryItems.RemoveRange(await dbContext.SearchHistoryItems.IgnoreQueryFilters().ToArrayAsync(cancellationToken));
            dbContext.BatchCookingStates.RemoveRange(await dbContext.BatchCookingStates.IgnoreQueryFilters().ToArrayAsync(cancellationToken));
            dbContext.CompletedRecipesStates.RemoveRange(await dbContext.CompletedRecipesStates.IgnoreQueryFilters().ToArrayAsync(cancellationToken));
            dbContext.GroceryListStates.RemoveRange(await dbContext.GroceryListStates.IgnoreQueryFilters().ToArrayAsync(cancellationToken));
            dbContext.MealPlans.RemoveRange(await dbContext.MealPlans.IgnoreQueryFilters().ToArrayAsync(cancellationToken));
        }
        else
        {
            // SaaS mode is tenant-isolated: only reset the disposable demo account's rows.
            var ownPlans = await dbContext.MealPlans.IgnoreQueryFilters()
                .Where(p => p.UserId == demoUserId)
                .ToListAsync(cancellationToken);

            if (ownPlans.Count > 0)
            {
                var ownPlanIds = ownPlans.Select(p => p.Id).ToList();

                var ownBatchStates = await dbContext.BatchCookingStates.IgnoreQueryFilters()
                    .Where(b => b.UserId == demoUserId || ownPlanIds.Contains(b.PlanId))
                    .ToListAsync(cancellationToken);
                var ownSearchHistory = await dbContext.SearchHistoryItems.IgnoreQueryFilters()
                    .Where(h => h.UserId == demoUserId || ownPlanIds.Contains(h.PlanId))
                    .ToListAsync(cancellationToken);
                var ownCompletedState = await dbContext.CompletedRecipesStates.IgnoreQueryFilters()
                    .Where(c => c.UserId == demoUserId || ownPlanIds.Contains(c.PlanId))
                    .ToListAsync(cancellationToken);
                var ownGroceryState = await dbContext.GroceryListStates.IgnoreQueryFilters()
                    .Where(g => g.UserId == demoUserId)
                    .ToListAsync(cancellationToken);

                dbContext.BatchCookingStates.RemoveRange(ownBatchStates);
                dbContext.SearchHistoryItems.RemoveRange(ownSearchHistory);
                dbContext.CompletedRecipesStates.RemoveRange(ownCompletedState);
                dbContext.GroceryListStates.RemoveRange(ownGroceryState);
                dbContext.MealPlans.RemoveRange(ownPlans);
            }

            // Heal legacy duplicates for the signed-in user without deleting their data:
            // only the most recently updated active plan may stay active.
            var currentUserId = dbContext.CurrentUserId;
            if (currentUserId.HasValue)
            {
                var activePlans = await dbContext.MealPlans.IgnoreQueryFilters()
                    .Where(p => p.UserId == currentUserId.Value && p.IsActive)
                    .OrderByDescending(p => p.UpdatedAtUtc)
                    .ToListAsync(cancellationToken);

                foreach (var staleActive in activePlans.Skip(1))
                {
                    staleActive.Deactivate();
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task SeedDemoDataAsync(long userId, CancellationToken cancellationToken)
    {
        try
        {
            // 1. Load 7-Day Mediterranean Meal Plan
            var planJson = await LoadDemoPlanJsonAsync(cancellationToken);

            var processedAtUtc = DateTimeOffset.UtcNow;
            var metadataJson = $$"""
            {
              "title": "Plan Nutricional Mediterráneo - Modo Demostración",
              "week": "Semana 1",
              "targetCalories": 2100,
              "dietType": "Mediterránea Equilibrada",
              "originalLanguage": "es",
              "daysCount": 7,
              "generatedBy": "VitalityNutri Demo Engine",
              "processedAt": "{{processedAtUtc:O}}"
            }
            """;

            var plan = new MealPlan(
                planJson: planJson,
                metadataJson: metadataJson,
                fileName: "plan-demostracion.pdf",
                savedFileName: "demo-sample.pdf",
                originalLanguage: "es",
                userId: userId);

            dbContext.MealPlans.Add(plan);
            await dbContext.SaveChangesAsync(cancellationToken);

            // 2. Pre-mocked Full Week Batch Cooking Strategy
            // Schema must match the AI-generated guide contract expected by the frontend:
            // { introduction, prepTime, steps[], storageTips[] }.
            var batchCookingGuide = """
            {
              "introduction": "Estrategia integral de Batch Cooking para la semana completa (7 días). Cocina en una sola sesión de 2 horas y ahorra 6 horas durante la semana.",
              "prepTime": "120 min",
              "steps": [
                {
                  "stepNumber": 1,
                  "title": "Fase 1: Horno y Asados Simultáneos",
                  "description": "Precalentar el horno a 190°C. Bandeja superior: colocar verduras mixtas (calabacín, pimientos, cebolla morada y brócoli) con aceite de oliva, sal y romero. Bandeja inferior: asar pechugas de pollo marinadas con limón y hierbas provenzales y salmón fresco en papillote.",
                  "duration": "45 min",
                  "utensils": ["horno", "2 bandejas", "papel de horno", "cuchillo", "tabla"],
                  "recipesAffected": [
                    { "id": null, "name": "Salmón al horno con quinoa y verduras asadas" },
                    { "id": null, "name": "Crema de calabacín con picatostes y tortilla francesa" }
                  ],
                  "ingredients": ["Calabacín", "Pimiento rojo", "Cebolla morada", "Brócoli", "Lomo de salmón fresco"]
                },
                {
                  "stepNumber": 2,
                  "title": "Fase 2: Cocción de Granos y Bases en Fogones",
                  "description": "Olla 1: cocer 300g de quinoa con caldo vegetal durante 15 minutos. Olla 2: cocer 300g de arroz integral con laurel y un diente de ajo durante 25 minutos. Olla 3: preparar la crema de calabacín dorando puerro y calabacín antes de añadir caldo y triturar.",
                  "duration": "45 min",
                  "utensils": ["3 fogones", "3 ollas", "batidora de mano"],
                  "recipesAffected": [
                    { "id": null, "name": "Salmón al horno con quinoa y verduras asadas" },
                    { "id": null, "name": "Crema de calabacín con picatostes y tortilla francesa" }
                  ],
                  "ingredients": ["Quinoa real", "Arroz integral", "Calabacines verdes", "Puerro"]
                },
                {
                  "stepNumber": 3,
                  "title": "Fase 3: Legumbres y Salteados Rápidos",
                  "description": "En sartén grande o wok: saltear champiñones con ajo y perejil para cenas rápidas. Escurrir y enjuagar garbanzos y lentejas cocidas de bote para ensaladas y guisos exprés. Lavar, secar y almacenar hojas verdes (espinacas, rúcula) en recipientes con papel absorbente.",
                  "duration": "15 min",
                  "utensils": ["sartén grande", "escurridor"],
                  "recipesAffected": [],
                  "ingredients": []
                },
                {
                  "stepNumber": 4,
                  "title": "Fase 4: Porcionado y Conservación Hermética",
                  "description": "Dejar enfriar todos los alimentos a temperatura ambiente antes de tapar. Etiquetar recipientes herméticos de vidrio con nombre y fecha. Almacenar comidas de Lunes a Miércoles en la zona media del frigorífico (4°C). Congelar porciones de Jueves y Viernes (pescados y caldos) para máxima frescura.",
                  "duration": "15 min",
                  "utensils": ["recipientes de vidrio herméticos", "etiquetas"],
                  "recipesAffected": [
                    { "id": null, "name": "Salmón al horno con quinoa y verduras asadas" },
                    { "id": null, "name": "Crema de calabacín con picatostes y tortilla francesa" }
                  ]
                }
              ],
              "storageTips": [
                {
                  "preparation": "Enfriar por completo antes de envasar para evitar condensación.",
                  "container": "Recipientes de vidrio herméticos",
                  "duration": "3-4 días en nevera",
                  "freezable": true,
                  "reheatingAndTips": "Recalentar en sartén tapada o microondas añadiendo una cucharada de agua."
                },
                {
                  "preparation": "Mantener los aliños y salsas separados hasta el momento de consumir.",
                  "container": "Tarros pequeños de cristal",
                  "duration": "5-7 días en nevera",
                  "freezable": false,
                  "reheatingAndTips": "Agitar bien antes de usar."
                },
                {
                  "preparation": "Consumir los platos de pescado dentro de los primeros 2 días tras la preparación.",
                  "container": "Papillote o recipiente poco profundo",
                  "duration": "2 días en nevera",
                  "freezable": false,
                  "reheatingAndTips": "Recalentar suavemente al horno a 150°C para conservar textura."
                }
              ]
            }
            """;

            var batchCookingParams = """
            {
              "burnersCount": 4,
              "hasOven": true,
              "hasMicrowave": true,
              "hasAirfryer": false,
              "hasRobot": false,
              "customTools": ""
            }
            """;

            var batchExists = await dbContext.BatchCookingStates.IgnoreQueryFilters().AnyAsync(b => b.PlanId == plan.Id, cancellationToken);
            if (!batchExists)
            {
                var batchState = new BatchCookingState(
                    planId: plan.Id,
                    guideJson: batchCookingGuide,
                    paramsJson: batchCookingParams,
                    userId: userId);

                dbContext.BatchCookingStates.Add(batchState);
            }

            // 3. Pre-seed sample recipes in Recipe Book for the demo user
            var recipesExist = await dbContext.Recipes.IgnoreQueryFilters().AnyAsync(r => r.UserId == userId, cancellationToken);
            if (!recipesExist)
            {
                var recipe1 = new Recipe(
                    recipeName: "Salmón al horno con quinoa y verduras asadas",
                    calories: 650,
                    time: "30 min",
                    tag: "Alto en Proteína",
                    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop",
                    ingredientsJson: """[{"name":"Lomo de salmón fresco","originalAmount":200,"unit":"g","category":"Pescados"},{"name":"Quinoa real","originalAmount":60,"unit":"g","category":"Cereales"},{"name":"Calabacín","originalAmount":1,"unit":"unidad","category":"Frutas y Verduras"},{"name":"Pimiento rojo","originalAmount":1,"unit":"unidad","category":"Frutas y Verduras"},{"name":"Aceite de oliva virgen extra","originalAmount":15,"unit":"ml","category":"Aceites"}]""",
                    tips: "Añade un chorrito de zumo de limón y eneldo fresco al retirar del horno para realzar aroma.",
                    stepsJson: """["Precalentar el horno a 190°C.","Cortar el calabacín y el pimiento en dados medianos y disponer en bandeja de horno con AOVE y romero.","Hornear las verduras durante 15 minutos.","Cocer la quinoa en agua o caldo vegetal durante 12 minutos hasta que absorba el líquido.","Incorporar el lomo de salmón a la bandeja de verduras y hornear 12 minutos más.","Emplatar la quinoa de base coronada con el salmón y las verduras asadas."]""",
                    nutritionistTips: "Excelente aporte de ácidos grasos Omega-3 de cadena larga (EPA/DHA) y proteína completa.",
                    nutritionJson: """{"calories":650,"protein":45,"carbs":48,"fat":28,"fiber":8,"sodium":390}""",
                    servings: 1,
                    source: "demo-plan",
                    sourcePlanId: plan.Id,
                    isAiGenerated: false,
                    isFavorite: true,
                    season: "Todas",
                    originalLanguage: "es",
                    userId: userId);

                var recipe2 = new Recipe(
                    recipeName: "Crema de calabacín con picatostes y tortilla francesa",
                    calories: 380,
                    time: "25 min",
                    tag: "Ligero",
                    image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop",
                    ingredientsJson: """[{"name":"Calabacines verdes","originalAmount":2,"unit":"unidades","category":"Frutas y Verduras"},{"name":"Puerro","originalAmount":1,"unit":"unidad","category":"Frutas y Verduras"},{"name":"Huevos camperos","originalAmount":2,"unit":"unidades","category":"Huevos y Lácteos"},{"name":"Aceite de oliva virgen extra","originalAmount":10,"unit":"ml","category":"Aceites"},{"name":"Picatostes integrales","originalAmount":15,"unit":"g","category":"Panadería"}]""",
                    tips: "No peles del todo los calabacines para conservar clorofila, fibra y antioxidantes.",
                    stepsJson: """["Sofreír el puerro en una cazuela con AOVE hasta dorar suavemente.","Añadir el calabacín en dados, cubrir con agua o caldo ligero y cocer 15 minutos.","Triturar intensamente con batidora hasta lograr una crema homogénea y sedosa.","Batir los huevos y cuajar una tortilla francesa jugosa en sartén antiadherente.","Servir la crema con los picatostes y acompañar de la tortilla."]""",
                    nutritionistTips: "Cena de digestión fácil y alta densidad de micronutrientes como potasio y vitamina C.",
                    nutritionJson: """{"calories":380,"protein":22,"carbs":18,"fat":24,"fiber":6,"sodium":310}""",
                    servings: 1,
                    source: "demo-plan",
                    sourcePlanId: plan.Id,
                    isAiGenerated: false,
                    isFavorite: false,
                    season: "Todas",
                    originalLanguage: "es",
                    userId: userId);

                dbContext.Recipes.AddRange(recipe1, recipe2);
            }

            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Fail gracefully if seed data already exists partially
        }
    }

    private static async Task<string> LoadDemoPlanJsonAsync(CancellationToken cancellationToken)
    {
        var assembly = typeof(DemoSeeder).Assembly;
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(name => name.EndsWith("demo-plan.json", StringComparison.OrdinalIgnoreCase));

        if (resourceName is not null)
        {
            await using var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream is not null)
            {
                using var reader = new StreamReader(stream);
                return await reader.ReadToEndAsync(cancellationToken);
            }
        }

        // Fallback to disk search
        var possiblePaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "Persistence", "demo-plan.json"),
            Path.Combine(AppContext.BaseDirectory, "demo-plan.json"),
            Path.Combine(Directory.GetCurrentDirectory(), "VitalityNutri.Infrastructure", "Persistence", "demo-plan.json")
        };

        foreach (var path in possiblePaths)
        {
            if (File.Exists(path))
            {
                return await File.ReadAllTextAsync(path, cancellationToken);
            }
        }

        return "{}";
    }
}
