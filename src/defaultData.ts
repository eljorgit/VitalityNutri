import { MealPlan, PlanMetadata } from "./types";

export const DEFAULT_PLAN_METADATA: PlanMetadata = {
  fileName: "Plan_Nutricional_Estándar_Vitality.pdf",
  processedAt: "2026-05-31T20:38:55Z"
};

export const DEFAULT_MEAL_PLAN: MealPlan = {
  days: {
    lunes: {
      desayuno: {
        recipeName: "Avena con bayas y chía",
        calories: 350,
        time: "10 min",
        tag: "Alto en Fibra",
        image: "https://images.unsplash.com/photo-1517881917430-e70dfb3610aa?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Copos de avena integral", originalAmount: 50, unit: "g" },
          { name: "Bayas silvestres mix", originalAmount: 80, unit: "g" },
          { name: "Semillas de chía", originalAmount: 10, unit: "g" },
          { name: "Leche de almendras sin azúcar", originalAmount: 200, unit: "ml" }
        ],
        tips: "Deja remojar la chía y la avena desde la noche anterior en la nevera para obtener una textura increíblemente cremosa."
      },
      almuerzo: {
        recipeName: "Pollo a la plancha con quinoa",
        calories: 450,
        time: "25 min",
        tag: "Alto en Proteína",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDZT3uW0tHLKVAQnze_i4KWKZ_o-Is2YmsOc9lMxT2ec1HpdSYHh1MaF5XJf982QgOQO0v3tUVCxC9Fbcgb6xaur_NF5go170RkcSYeD3bZVqrVHQx5I7zdtgUxSJdSsXb7hL3kxvyAlz7E0ezDfCLmmOZl14ChwYKbsIO2725O1AdOt82m6T-myY4xDZVBNbPWMDeGgGUQTP1va2ER0SMX-s6WCeMQAOQw8SKP-eXoFtv5uoo5DA4qftu34Igh7eEiMKkf4X7l1Lc",
        ingredients: [
          { name: "Pechuga de Pollo", originalAmount: 200, unit: "g" },
          { name: "Quinoa Blanca", originalAmount: 100, unit: "g" },
          { name: "Espinacas Frescas", originalAmount: 50, unit: "g" },
          { name: "Aceite de Oliva VE", originalAmount: 10, unit: "ml" }
        ],
        tips: "Tuesta la quinoa en seco durante 2 minutos antes de hervirla para intensificar su sabor a nuez y mejorar la textura final del plato."
      },
      merienda: null,
      cena: {
        recipeName: "Salmón al horno con espárragos",
        calories: 410,
        time: "20 min",
        tag: "Rico en Omega 3",
        image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Filete de Salmón fresco", originalAmount: 180, unit: "g" },
          { name: "Espárragos trigueros", originalAmount: 150, unit: "g" },
          { name: "Limón maduro", originalAmount: 0.5, unit: "unidad(es)" },
          { name: "Aceite de Oliva Virgen Extra", originalAmount: 5, unit: "ml" }
        ],
        tips: "Coloca rodajas de limón y eneldo fresco sobre el salmón mientras se hornea para mantener su sabor silvestre y jugoso."
      }
    },
    martes: {
      desayuno: {
        recipeName: "Tostada de aguacate",
        calories: 380,
        time: "10 min",
        tag: "Grasas Saludables",
        image: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Pan integral de masa madre", originalAmount: 2, unit: "rebanada(s)" },
          { name: "Aguacate maduro", originalAmount: 1, unit: "unidad(es)" },
          { name: "Huevo campero poché", originalAmount: 1, unit: "unidad(es)" },
          { name: "Sal de escamas y pimienta negra", originalAmount: 1, unit: "g" }
        ],
        tips: "Rocía unas gotas de jugo de lima sobre el aguacate triturado para evitar la oxidación y potenciar los contrastes lípidos."
      },
      almuerzo: {
        recipeName: "Ensalada César con Garbanzos",
        calories: 390,
        time: "15 min",
        tag: "Fibra Vegetal",
        image: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Lechuga romana fresca", originalAmount: 150, unit: "g" },
          { name: "Garbanzos tostados al horno", originalAmount: 100, unit: "g" },
          { name: "Yogur griego desnatado (aderezo)", originalAmount: 50, unit: "g" },
          { name: "Queso parmesano rallado fino", originalAmount: 15, unit: "g" }
        ],
        tips: "Tuesta los garbanzos en horno con pimentón dulce, comino y ajo en polvo para darles un toque extra crujiente y sustituir los costrones clásicos."
      },
      merienda: {
        recipeName: "Yogur griego con nueces",
        calories: 290,
        time: "5 min",
        tag: "Snack Completo",
        image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Yogur griego natural sin azúcar", originalAmount: 200, unit: "g" },
          { name: "Nueces peladas nacionales", originalAmount: 30, unit: "g" },
          { name: "Miel de flores orgánica", originalAmount: 5, unit: "ml" }
        ],
        tips: "Usa nueces ligeramente rotas y tostadas en sartén limpia para liberar sus aceites esenciales aromáticos."
      },
      cena: {
        recipeName: "Tacos de pavo en hoja de lechuga",
        calories: 320,
        time: "15 min",
        tag: "Keto Friendly",
        image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Carne picada pechuga pavo magro", originalAmount: 150, unit: "g" },
          { name: "Hojas grandes de lechuga iceberg", originalAmount: 4, unit: "unidad(es)" },
          { name: "Cebolla morada en brunoise", originalAmount: 30, unit: "g" },
          { name: "Tomate pera en dados", originalAmount: 50, unit: "g" }
        ],
        tips: "Sazona el pavo picado con pimentón dulce, comino molido y un toque de chile en polvo para maximizar su potencia sápida."
      }
    },
    miercoles: {
      desayuno: {
        recipeName: "Batido Verde Proteico",
        calories: 310,
        time: "5 min",
        tag: "Post-Entrenamiento",
        image: "https://images.unsplash.com/photo-1610970881699-44a5587caaec?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Espinacas baby frescas", originalAmount: 50, unit: "g" },
          { name: "Plátano canario maduro", originalAmount: 1, unit: "unidad(es)" },
          { name: "Proteína de suero (vainilla o neutra)", originalAmount: 30, unit: "g" },
          { name: "Bebida de avena ecológica", originalAmount: 250, unit: "ml" }
        ],
        tips: "Añade hielo picado o congela previamente el plátano para un resultado refrescante estilo 'smoothie cremoso'."
      },
      almuerzo: {
        recipeName: "Bowl de Lentejas",
        calories: 360,
        time: "30 min",
        tag: "Fácil de Hacer",
        image: "https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Lentejas verdinas cocidas", originalAmount: 150, unit: "g" },
          { name: "Zanahoria picada fina", originalAmount: 50, unit: "g" },
          { name: "Calabacín con piel", originalAmount: 80, unit: "g" },
          { name: "Cebolla blanca rallada", originalAmount: 40, unit: "g" }
        ],
        tips: "Un chorrito de vinagre de manzana o limón justo al servirlo ayuda a potenciar la asimilación del hierro no hemo presente en la legumbre."
      },
      merienda: null,
      cena: {
        recipeName: "Pescado blanco al vapor",
        calories: 280,
        time: "15 min",
        tag: "Fácil Digestión",
        image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Filete de Merluza austral", originalAmount: 150, unit: "g" },
          { name: "Ramilletes de Brócoli", originalAmount: 150, unit: "g" },
          { name: "Zanahoria baby", originalAmount: 100, unit: "g" },
          { name: "Aceite de Oliva Virgen Extra", originalAmount: 10, unit: "ml" }
        ],
        tips: "Coloca hojas de laurel, pimienta jamaicana y rodajas finas de jengibre en la vaporera para aromatizar el vapor de cocción."
      }
    },
    jueves: {
      desayuno: {
        recipeName: "Huevos revueltos con espinaca",
        calories: 310,
        time: "8 min",
        tag: "Proteína Limpia",
        image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Huevos camperos orgánicos", originalAmount: 2, unit: "unidad(es)" },
          { name: "Espinacas tiernas frescas", originalAmount: 80, unit: "g" },
          { name: "Pan multicereal integral tostado", originalAmount: 1, unit: "rebanada(s)" },
          { name: "Aceite de Oliva", originalAmount: 5, unit: "ml" }
        ],
        tips: "Cocina a fuego lento, removiendo constantemente desde fuera hacia dentro para que los huevos mantengan su humedad interna perfecta."
      },
      almuerzo: {
        recipeName: "Pasta integral boloñesa ligera",
        calories: 480,
        time: "20 min",
        tag: "Alto en Carbohidratos",
        image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Espaguetis de trigo integral", originalAmount: 80, unit: "g" },
          { name: "Salsa de tomate triturado natural", originalAmount: 100, unit: "g" },
          { name: "Carne picada de ternera magra", originalAmount: 100, unit: "g" },
          { name: "Orégano silvestre seco", originalAmount: 2, unit: "g" }
        ],
        tips: "Mézclala con una parte de los espaguetis cocinados 'al dente' en la misma sartén de la salsa con dos cucharadas de agua de cocción."
      },
      merienda: {
        recipeName: "Manzana con crema de cacahuete",
        calories: 220,
        time: "3 min",
        tag: "Saciante Rápido",
        image: "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Manzana nacional (Fuji o Royal)", originalAmount: 1, unit: "unidad(es)" },
          { name: "Crema de cacahuete silvestre 100%", originalAmount: 20, unit: "g" }
        ],
        tips: "Corta la manzana en gajos finos y decora con canela en polvo por encima para endulzar el contraste amargo-ácido."
      },
      cena: {
        recipeName: "Sopa de verduras depurativa",
        calories: 210,
        time: "25 min",
        tag: "Cena Ligera",
        image: "https://images.unsplash.com/photo-1547592165-e1d17fed6005?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Puerro y apio picado", originalAmount: 50, unit: "g" },
          { name: "Dados de tofu natural firme", originalAmount: 100, unit: "g" },
          { name: "Caldo depurativo casero", originalAmount: 300, unit: "ml" },
          { name: "Zanahoria picada", originalAmount: 50, unit: "g" }
        ],
        tips: "Añade una cucharadita de pasta de miso blanco al final de la ebullición para añadir probióticos naturales sanadores."
      }
    },
    viernes: {
      desayuno: {
        recipeName: "Tortitas fitness de avena",
        calories: 280,
        time: "12 min",
        tag: "Comida Sana",
        image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Harina de avena integral fina", originalAmount: 40, unit: "g" },
          { name: "Claras de huevo frescas", originalAmount: 3, unit: "unidad(es)" },
          { name: "Plátano triturado maduro", originalAmount: 0.5, unit: "unidad(es)" },
          { name: "Levadura orgánica seca", originalAmount: 2, unit: "g" }
        ],
        tips: "Cocina a temperatura media tapado en sartén de teflón para potenciar que las tortitas doblen su esponjosidad."
      },
      almuerzo: {
        recipeName: "Wrap integral de Atún",
        calories: 340,
        time: "10 min",
        tag: "Estudio Rapidez",
        image: "https://images.unsplash.com/photo-1626700051175-6518c4793f73?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Tortilla de trigo integral wrap", originalAmount: 1, unit: "unidad(es)" },
          { name: "Atún claro en aceite oliva escurrido", originalAmount: 80, unit: "g" },
          { name: "Lechuga troceada", originalAmount: 30, unit: "g" },
          { name: "Cebollas dulces picadas", originalAmount: 15, unit: "g" }
        ],
        tips: "Sustituye la mayonesa industrial por yogur natural mezclado con ajo en polvo para reducir drásticamente las calorías del wrap."
      },
      merienda: {
        recipeName: "Hummus con bastones de zanahorias",
        calories: 190,
        time: "5 min",
        tag: "Rico en Nutrientes",
        image: "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Hummus de garbanzos tradicional", originalAmount: 80, unit: "g" },
          { name: "Bastoncitos de zanahoria fresca", originalAmount: 120, unit: "g" }
        ],
        tips: "Añade un chorrito de limón exprimido y pimentón ahumado de la Vera justo encima del hummus para potenciar el sabor a pimiento."
      },
      cena: {
        recipeName: "Pizza fit con base de coliflor",
        calories: 390,
        time: "25 min",
        tag: "Guilt-Free Cheat",
        image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Base precocinada de coliflor", originalAmount: 1, unit: "unidad(es)" },
          { name: "Tomate natural triturado frito", originalAmount: 50, unit: "g" },
          { name: "Queso mozzarella rallado light", originalAmount: 40, unit: "g" },
          { name: "Champiñones portobello frescos", originalAmount: 50, unit: "g" }
        ],
        tips: "Si elaboras la masa tú mismo de forma casera, escurre muy bien toda el agua de la coliflor rallada con un paño limpio antes de hornearla."
      }
    },
    sabado: {
      desayuno: {
        recipeName: "Completo Desayuno Continental",
        calories: 330,
        time: "10 min",
        tag: "Gran Variedad",
        image: "https://images.unsplash.com/photo-1496042399014-dc73c4f2bde1?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Huevo campero cocido duro", originalAmount: 1, unit: "unidad(es)" },
          { name: "Jamón pechuga pavo magro", originalAmount: 50, unit: "g" },
          { name: "Queso fresco de Burgos light", originalAmount: 60, unit: "g" },
          { name: "Pan de molde integral con semillas", originalAmount: 1, unit: "rebanada(s)" }
        ],
        tips: "Combina este plato con té verde estilo sencha caliente para acelerar de forma natural el metabolismo lípido."
      },
      almuerzo: {
        recipeName: "Risotto gourmet de champiñones",
        calories: 420,
        time: "30 min",
        tag: "Disfruta Cocinar",
        image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Arroz arborio para risotto", originalAmount: 70, unit: "g" },
          { name: "Champiñones portobello frescos", originalAmount: 100, unit: "g" },
          { name: "Caldo concentrado setas casero", originalAmount: 250, unit: "ml" },
          { name: "Queso parmesano curado", originalAmount: 15, unit: "g" }
        ],
        tips: "Remueve continuamente el arroz añadiendo caldo poco a poco: esto desprende el almidón logrando una excelente cremosidad natural."
      },
      merienda: {
        recipeName: "Batido cremoso de fresas",
        calories: 160,
        time: "5 min",
        tag: "Refrescante",
        image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Fresones de Huelva limpios", originalAmount: 150, unit: "g" },
          { name: "Yogur natural cremoso light", originalAmount: 125, unit: "g" },
          { name: "Leche semidesnatada de vaca", originalAmount: 100, unit: "ml" }
        ],
        tips: "Congela las fresas de antemano el día anterior y bátelas directamente para un resultado estilo granizado lácteo."
      },
      cena: {
        recipeName: "Cena Libre Saludable",
        calories: 600,
        time: "5 min",
        tag: "Cena Placer",
        image: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Porción de tu plato libre preferido", originalAmount: 1, unit: "ración(es)" }
        ],
        tips: "Disfruta de esta ración sin remordimientos; un cheat meal bien pautado ayuda a desestresar la mente de la dieta."
      }
    },
    domingo: {
      desayuno: {
        recipeName: "Brunch Dominical Familiar",
        calories: 350,
        time: "15 min",
        tag: "Placer Fin de Semana",
        image: "https://images.unsplash.com/photo-1533089860891-a7c6f061fd91?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Tortitas ligeras de maíz inflado", originalAmount: 3, unit: "unidad(es)" },
          { name: "Huevo frito con spray de aceite", originalAmount: 1, unit: "unidad(es)" },
          { name: "Rodajas de tomates maduros", originalAmount: 50, unit: "g" },
          { name: "Queso cottage alto en proteína", originalAmount: 60, unit: "g" }
        ],
        tips: "Disfruta de este fantástico desayuno pausadamente en compañía de tus seres queridos."
      },
      almuerzo: {
        recipeName: "Paella valenciana de verduras",
        calories: 390,
        time: "35 min",
        tag: "Sabor Tradicional",
        image: "https://images.unsplash.com/photo-1534080564583-6be75777b70a?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Arroz bomba de la Albufera", originalAmount: 80, unit: "g" },
          { name: "Judías verdes tipo ferradura", originalAmount: 50, unit: "g" },
          { name: "Pimiento rojo laminado", originalAmount: 40, unit: "g" },
          { name: "Alcachofas cortadas limpias", originalAmount: 50, unit: "g" }
        ],
        tips: "Cocina con un buen azafrán puro en hebra tostado en vez de colorantes artificiales para liberar el aroma definitivo."
      },
      merienda: {
        recipeName: "Mix de frutos secos naturales",
        calories: 210,
        time: "2 min",
        tag: "Energía Completa",
        image: "https://images.unsplash.com/photo-1596701062351-df5f8a42f3c5?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Almendras crudas con piel", originalAmount: 15, unit: "g" },
          { name: "Nueces peladas nacionales", originalAmount: 10, unit: "g" },
          { name: "Avellanas tostadas sin sal", originalAmount: 10, unit: "g" }
        ],
        tips: "Prepara raciones individuales pesadas en bolsitas herméticas previamente para evitar exceder las cantidades con facilidad."
      },
      cena: {
        recipeName: "Tortilla de patatas fit ligera",
        calories: 360,
        time: "20 min",
        tag: "Tradición Ligera",
        image: "https://images.unsplash.com/photo-1518047601542-79f18c655718?q=80&w=1000&auto=format&fit=crop",
        ingredients: [
          { name: "Patatas cocidas al microondas", originalAmount: 150, unit: "g" },
          { name: "Cebolla picada fina pochada", originalAmount: 50, unit: "g" },
          { name: "Huevos enteros camperos", originalAmount: 2, unit: "unidad(es)" }
        ],
        tips: "Cocinar previamente la patata con piel al microondas reduce el uso de aceite a tan solo una cucharadita, bajando el contenido calórico a la mitad."
      }
    }
  }
};
