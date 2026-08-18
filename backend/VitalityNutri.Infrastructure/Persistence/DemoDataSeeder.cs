using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using VitalityNutri.Domain.Entities;
using VitalityNutri.Infrastructure.Configuration;

namespace VitalityNutri.Infrastructure.Persistence;

public static class DemoDataSeeder
{
    public static async Task SeedDemoDataAsync(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VitalityNutriDbContext>();
        var config = scope.ServiceProvider.GetRequiredService<ApiConfiguration>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DemoDataSeeder");

        if (!config.Database.ApplyMigrations)
        {
            return;
        }

        // Only seed when there are no meal plans
        if (await db.MealPlans.AnyAsync())
        {
            return;
        }

        logger.LogInformation("[DemoDataSeeder] No meal plans found. Seeding initial demo meal plan and recipe book...");

        var now = DateTimeOffset.UtcNow;
        var metadataJson = JsonSerializer.Serialize(new
        {
            fileName = "Plan Demo (sin IA)",
            processedAt = now.ToString("o"),
            isDemo = true,
            title = "Plan Demo (sin IA)",
            description = "Plan semanal saludable de demostración preconfigurado."
        });

        var demoPlanJson = BuildDemoPlanJson();
        var demoPlan = new MealPlan(demoPlanJson, metadataJson, "Plan Demo (sin IA)");

        db.MealPlans.Add(demoPlan);

        // Seed default grocery list state
        db.GroceryListStates.Add(new GroceryListState(
            "{}",
            "semanal",
            string.Empty,
            string.Empty,
            "[]",
            "{}"
        ));

        // Seed initial ingredients if empty
        if (!await db.Ingredients.AnyAsync())
        {
            db.Ingredients.AddRange(
                new Ingredient("Avena integral", "Granos, harinas y semillas"),
                new Ingredient("Plátano maduro", "Frutas"),
                new Ingredient("Huevo campero", "Carnes, huevos y tofu"),
                new Ingredient("Pechuga de pollo", "Carnes, huevos y tofu"),
                new Ingredient("Arroz integral", "Granos, harinas y semillas"),
                new Ingredient("Salmón fresco", "Pescados y mariscos"),
                new Ingredient("Brócoli fresco", "Verduras y hortalizas"),
                new Ingredient("Aceite de oliva virgen extra", "Grasas y aceites"),
                new Ingredient("Yogur natural griego", "Lácteos y bebidas")
            );
        }

        // Seed initial recipes if empty
        if (!await db.Recipes.AnyAsync())
        {
            db.Recipes.AddRange(
                new Recipe("Bowl de avena y frutos rojos", 320, "10 min", "breakfast",
                    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop",
                    """[{"name":"Avena","originalAmount":50,"unit":"g","category":"granos"},{"name":"Frutos rojos","originalAmount":80,"unit":"g","category":"frutas"}]""",
                    "Mezcla con canela al gusto.",
                    """["Cocinar la avena con agua o leche.","Decorar con frutos rojos y canela."]""",
                    "Aporte de fibra y antioxidantes.", null, 1, "manual", null, false, true, "Todas"),
                new Recipe("Salmón al horno con verduras", 480, "25 min", "meal",
                    "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop",
                    """[{"name":"Lomo de salmón","originalAmount":150,"unit":"g","category":"pescados"},{"name":"Brócoli y zanahoria","originalAmount":200,"unit":"g","category":"verduras"}]""",
                    "Hornea a 180°C durante 15-20 minutos.",
                    """["Cortar las verduras.","Colocar el salmón y verduras en bandeja para horno.","Hornear 18 min."]""",
                    "Rico en ácidos grasos Omega-3.", null, 1, "manual", null, false, true, "Todas")
            );
        }

        await db.SaveChangesAsync();
        logger.LogInformation("[DemoDataSeeder] Demo meal plan and sample recipes seeded successfully.");
    }

    private static string BuildDemoPlanJson()
    {
        var plan = new
        {
            days = new Dictionary<string, object>
            {
                ["monday"] = new
                {
                    breakfast = new
                    {
                        recipeName = "Tostadas integrales con aguacate y huevo",
                        calories = 340,
                        time = "10 min",
                        tag = "breakfast",
                        image = "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Pan integral 100%", originalAmount = 2, unit = "rebanadas", category = "granos" },
                            new { name = "Aguacate maduro", originalAmount = 50, unit = "g", category = "grasas" },
                            new { name = "Huevo poché", originalAmount = 1, unit = "unidad", category = "proteinas" }
                        },
                        tips = "Espolvorea semillas de chía o sésamo por encima para un toque crujiente."
                    },
                    lunch = new
                    {
                        recipeName = "Pechuga de pollo a la plancha con quinoa y verduras",
                        calories = 450,
                        time = "20 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Pechuga de pollo", originalAmount = 150, unit = "g", category = "proteinas" },
                            new { name = "Quinoa cocida", originalAmount = 120, unit = "g", category = "granos" },
                            new { name = "Calabacín y pimiento", originalAmount = 150, unit = "g", category = "verduras" }
                        },
                        tips = "Cocina la pechuga a fuego medio-alto para sellar los jugos."
                    },
                    snack = new
                    {
                        recipeName = "Yogur griego con nueces y miel",
                        calories = 190,
                        time = "3 min",
                        tag = "snack",
                        image = "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Yogur natural griego", originalAmount = 125, unit = "g", category = "lacteos" },
                            new { name = "Nueces peladas", originalAmount = 15, unit = "g", category = "frutos secos" }
                        },
                        tips = "Añade canela de Ceilán en polvo."
                    },
                    dinner = new
                    {
                        recipeName = "Crema de calabaza asada y semillas",
                        calories = 290,
                        time = "25 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Calabaza cacahuete", originalAmount = 250, unit = "g", category = "verduras" },
                            new { name = "Puerro y cebolla", originalAmount = 100, unit = "g", category = "verduras" },
                            new { name = "Semillas de calabaza", originalAmount = 10, unit = "g", category = "semillas" }
                        },
                        tips = "Asar la calabaza en vez de hervirla concentra mucho más sus azúcares naturales."
                    }
                },
                ["tuesday"] = new
                {
                    breakfast = new
                    {
                        recipeName = "Porridge de avena con manzana y canela",
                        calories = 310,
                        time = "8 min",
                        tag = "breakfast",
                        image = "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Copos de avena", originalAmount = 45, unit = "g", category = "granos" },
                            new { name = "Manzana rallada", originalAmount = 1, unit = "unidad", category = "frutas" },
                            new { name = "Leche o bebida vegetal", originalAmount = 150, unit = "ml", category = "lacteos" }
                        },
                        tips = "Cocina la manzana junto con la avena para que se ablande."
                    },
                    lunch = new
                    {
                        recipeName = "Lentejas estofadas con verduras de temporada",
                        calories = 430,
                        time = "30 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Lentejas pardinas", originalAmount = 80, unit = "g", category = "legumbres" },
                            new { name = "Zanahoria y puerro", originalAmount = 100, unit = "g", category = "verduras" },
                            new { name = "Laurel y pimentón dulce", originalAmount = 1, unit = "pizca", category = "especias" }
                        },
                        tips = "Añade un chorrito de vinagre de manzana al final de la cocción para mejorar la absorción del hierro."
                    },
                    snack = new
                    {
                        recipeName = "Manzana cortada con crema de cacahuete",
                        calories = 170,
                        time = "2 min",
                        tag = "snack",
                        image = "https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Manzana roja", originalAmount = 1, unit = "unidad", category = "frutas" },
                            new { name = "Crema de cacahuete 100%", originalAmount = 15, unit = "g", category = "grasas" }
                        },
                        tips = "Usa manzana crujiente tipo Fuji o Pink Lady."
                    },
                    dinner = new
                    {
                        recipeName = "Tortilla francesa de espinacas y queso feta",
                        calories = 310,
                        time = "10 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1510693206972-df098062cb71?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Huevos camperos", originalAmount = 2, unit = "unidades", category = "proteinas" },
                            new { name = "Espinacas baby frescas", originalAmount = 80, unit = "g", category = "verduras" },
                            new { name = "Queso feta desmenuzado", originalAmount = 30, unit = "g", category = "lacteos" }
                        },
                        tips = "Saltea las espinacas 1 minuto antes de verter el huevo batido."
                    }
                },
                ["wednesday"] = new
                {
                    breakfast = new
                    {
                        recipeName = "Pancakes saludables de plátano y avena",
                        calories = 330,
                        time = "12 min",
                        tag = "breakfast",
                        image = "https://images.unsplash.com/photo-1528207776546-365bb710ee93?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Plátano maduro", originalAmount = 1, unit = "unidad", category = "frutas" },
                            new { name = "Huevo", originalAmount = 1, unit = "unidad", category = "proteinas" },
                            new { name = "Harina de avena", originalAmount = 35, unit = "g", category = "granos" }
                        },
                        tips = "Cocina en sartén antiadherente a fuego bajo tapado."
                    },
                    lunch = new
                    {
                        recipeName = "Salmón al papillote con espárragos y patata vapor",
                        calories = 490,
                        time = "25 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Lomo de salmón", originalAmount = 150, unit = "g", category = "pescados" },
                            new { name = "Espárragos verdes", originalAmount = 100, unit = "g", category = "verduras" },
                            new { name = "Patata pequeña", originalAmount = 120, unit = "g", category = "tuberculos" }
                        },
                        tips = "Envuelve en papel de horno sellando bien los bordes para retener todo el vapor."
                    },
                    snack = new
                    {
                        recipeName = "Kéfir con semillas de chía y arándanos",
                        calories = 160,
                        time = "3 min",
                        tag = "snack",
                        image = "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Kéfir natural", originalAmount = 150, unit = "ml", category = "lacteos" },
                            new { name = "Arándanos frescos", originalAmount = 40, unit = "g", category = "frutas" }
                        },
                        tips = "Excelente para la microbiota intestinal."
                    },
                    dinner = new
                    {
                        recipeName = "Wok de tofu con verduras variadas y salsa de soja",
                        calories = 320,
                        time = "15 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Tofu firme marinado", originalAmount = 150, unit = "g", category = "proteinas" },
                            new { name = "Brócoli, zanahoria y champiñones", originalAmount = 180, unit = "g", category = "verduras" }
                        },
                        tips = "Prensa bien el tofu con papel absorbente antes de dorarlo en la sartén."
                    }
                },
                ["thursday"] = new
                {
                    breakfast = new
                    {
                        recipeName = "Tostada de centeno con requesón y frutos secos",
                        calories = 290,
                        time = "5 min",
                        tag = "breakfast",
                        image = "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Pan de centeno 100%", originalAmount = 1, unit = "rebanada", category = "granos" },
                            new { name = "Requesón bajo en grasa", originalAmount = 60, unit = "g", category = "lacteos" }
                        },
                        tips = "Un toque de miel cruda combina a la perfección con el requesón."
                    },
                    lunch = new
                    {
                        recipeName = "Arroz integral salteado con pavo y champiñones",
                        calories = 440,
                        time = "20 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Arroz integral cocido", originalAmount = 130, unit = "g", category = "granos" },
                            new { name = "Solomillo de pavo en dados", originalAmount = 140, unit = "g", category = "proteinas" }
                        },
                        tips = "Saltea a fuego vivo para dar sabor tostado."
                    },
                    snack = new
                    {
                        recipeName = "Puñado de almendras crudas y chocolate negro 85%",
                        calories = 180,
                        time = "1 min",
                        tag = "snack",
                        image = "https://images.unsplash.com/photo-1596701062351-df5f8a42f3c5?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Almendras crudas con piel", originalAmount = 15, unit = "g", category = "frutos secos" },
                            new { name = "Chocolate negro 85%", originalAmount = 10, unit = "g", category = "otros" }
                        },
                        tips = "Saciante y rico en magnesio."
                    },
                    dinner = new
                    {
                        recipeName = "Merluza al horno con base de tomate y calabacín",
                        calories = 280,
                        time = "20 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1534939561126-855b8675edd7?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Filete de merluza fresca", originalAmount = 160, unit = "g", category = "pescados" },
                            new { name = "Calabacín y tomate en rodajas", originalAmount = 150, unit = "g", category = "verduras" }
                        },
                        tips = "Añade orégano y un chorrito de limón sobre el pescado."
                    }
                },
                ["friday"] = new
                {
                    breakfast = new
                    {
                        recipeName = "Batido verde energizante con espinacas y fruta",
                        calories = 260,
                        time = "5 min",
                        tag = "breakfast",
                        image = "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Espinacas frescas", originalAmount = 50, unit = "g", category = "verduras" },
                            new { name = "Plátano maduro", originalAmount = 1, unit = "unidad", category = "frutas" },
                            new { name = "Bebida de almendras sin azúcar", originalAmount = 200, unit = "ml", category = "bebidas" }
                        },
                        tips = "Bate a máxima potencia para una textura suave y homogénea."
                    },
                    lunch = new
                    {
                        recipeName = "Ensalada templada de garbanzos con atún y huevo duro",
                        calories = 460,
                        time = "10 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Garbanzos cocidos", originalAmount = 150, unit = "g", category = "legumbres" },
                            new { name = "Lata de atún al natural", originalAmount = 80, unit = "g", category = "pescados" },
                            new { name = "Huevo duro", originalAmount = 1, unit = "unidad", category = "proteinas" }
                        },
                        tips = "Aliña con aceite de oliva virgen extra y vinagre de Jerez."
                    },
                    snack = new
                    {
                        recipeName = "Yogur natural con semillas de lino molidas",
                        calories = 140,
                        time = "2 min",
                        tag = "snack",
                        image = "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Yogur natural sin azúcar", originalAmount = 125, unit = "g", category = "lacteos" }
                        },
                        tips = "Moler las semillas de lino permite asimilar mejor sus nutrientes."
                    },
                    dinner = new
                    {
                        recipeName = "Pizza fit con base de coliflor y jamón serrano",
                        calories = 380,
                        time = "25 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Base de coliflor horneada", originalAmount = 1, unit = "unidad", category = "verduras" },
                            new { name = "Queso mozzarella light", originalAmount = 40, unit = "g", category = "lacteos" },
                            new { name = "Jamón serrano en lonchas", originalAmount = 30, unit = "g", category = "carnes" }
                        },
                        tips = "Hornea bien la base antes de añadir los ingredientes húmedos."
                    }
                },
                ["saturday"] = new
                {
                    breakfast = new
                    {
                        recipeName = "Desayuno completo mediterráneo con pavo y queso",
                        calories = 340,
                        time = "10 min",
                        tag = "breakfast",
                        image = "https://images.unsplash.com/photo-1496042399014-dc73c4f2bde1?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Pan de masa madre", originalAmount = 1, unit = "rebanada", category = "granos" },
                            new { name = "Pechuga de pavo braseada", originalAmount = 50, unit = "g", category = "carnes" },
                            new { name = "Tomate rallado", originalAmount = 40, unit = "g", category = "verduras" }
                        },
                        tips = "Acompaña con café solo o té verde."
                    },
                    lunch = new
                    {
                        recipeName = "Risotto ligero de setas y parmesano",
                        calories = 440,
                        time = "30 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1476124369491-e7addf5db371?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Arroz arborio", originalAmount = 75, unit = "g", category = "granos" },
                            new { name = "Surtido de setas y champiñones", originalAmount = 120, unit = "g", category = "verduras" },
                            new { name = "Queso parmesano rallado", originalAmount = 15, unit = "g", category = "lacteos" }
                        },
                        tips = "Añade el caldo caliente gradualmente mientras remueves constantemente."
                    },
                    snack = new
                    {
                        recipeName = "Batido cremoso de fresas naturales",
                        calories = 150,
                        time = "5 min",
                        tag = "snack",
                        image = "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Fresas frescas", originalAmount = 120, unit = "g", category = "frutas" },
                            new { name = "Leche o yogur natural", originalAmount = 150, unit = "ml", category = "lacteos" }
                        },
                        tips = "Usa fresas congeladas para conseguir textura de frappé."
                    },
                    dinner = new
                    {
                        recipeName = "Cena libre saludable y consciente",
                        calories = 550,
                        time = "15 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Tu plato preferido saludable", originalAmount = 1, unit = "porcion", category = "otros" }
                        },
                        tips = "Disfruta de la comida conscientemente y sin distracciones."
                    }
                },
                ["sunday"] = new
                {
                    breakfast = new
                    {
                        recipeName = "Brunch dominical con huevos revueltos y aguacate",
                        calories = 360,
                        time = "15 min",
                        tag = "breakfast",
                        image = "https://images.unsplash.com/photo-1533089860891-a7c6f061fd91?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Huevos camperos", originalAmount = 2, unit = "unidades", category = "proteinas" },
                            new { name = "Aguacate en rodajas", originalAmount = 40, unit = "g", category = "grasas" },
                            new { name = "Pan tostado integral", originalAmount = 1, unit = "rebanada", category = "granos" }
                        },
                        tips = "Cocina los huevos a fuego muy lento con espátula para máxima cremosidad."
                    },
                    lunch = new
                    {
                        recipeName = "Paella de verduras y alcachofas",
                        calories = 410,
                        time = "35 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1534080564583-6be75777b70a?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Arroz bomba", originalAmount = 80, unit = "g", category = "granos" },
                            new { name = "Alcachofas y judías verdes", originalAmount = 120, unit = "g", category = "verduras" },
                            new { name = "Azafrán en hebra", originalAmount = 1, unit = "pizca", category = "especias" }
                        },
                        tips = "Deja reposar 5 minutos tapada con un paño limpio antes de servir."
                    },
                    snack = new
                    {
                        recipeName = "Mix de frutos secos naturales",
                        calories = 190,
                        time = "1 min",
                        tag = "snack",
                        image = "https://images.unsplash.com/photo-1596701062351-df5f8a42f3c5?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Nueces, avellanas y almendras", originalAmount = 25, unit = "g", category = "frutos secos" }
                        },
                        tips = "Elige siempre variedades sin sal añadida ni fritas."
                    },
                    dinner = new
                    {
                        recipeName = "Tortilla de patatas fit cocinada al vapor/microondas",
                        calories = 360,
                        time = "20 min",
                        tag = "meal",
                        image = "https://images.unsplash.com/photo-1518047601542-79f18c655718?q=80&w=1000&auto=format&fit=crop",
                        ingredients = new[]
                        {
                            new { name = "Patatas cocidas al vapor", originalAmount = 150, unit = "g", category = "tuberculos" },
                            new { name = "Cebolla pochada con spray de AOVE", originalAmount = 50, unit = "g", category = "verduras" },
                            new { name = "Huevos camperos", originalAmount = 2, unit = "unidades", category = "proteinas" }
                        },
                        tips = "Cocer previamente la patata reduce drásticamente las calorías sin perder sabor tradicional."
                    }
                }
            }
        };

        return JsonSerializer.Serialize(plan);
    }
}
