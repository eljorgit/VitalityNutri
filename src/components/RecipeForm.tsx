import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Recipe, Ingredient } from "../types";
import ImagePlaceholder from "./ImagePlaceholder";
import ConfirmationModal from "./ConfirmationModal";

const getIngredientHelperText = (amount: number, unit: string, totalServings: number, t: (key: string, params?: any) => string) => {
  if (!amount || amount <= 0) return null;
  const helpers: string[] = [];

  // Per serving calculation
  if (totalServings > 1) {
    const perServing = (amount / totalServings).toFixed(1).replace(/\.0$/, "");
    helpers.push(t("recipeform.per_serving", { amount: perServing, unit }));
  }

  // Unit conversion approximation
  const lowerUnit = unit.toLowerCase().trim();
  if (lowerUnit.includes("taza")) {
    helpers.push(`~${Math.round(amount * 200)}g / ${Math.round(amount * 240)}ml`);
  } else if (lowerUnit.includes("cda") || lowerUnit === "tbsp") {
    helpers.push(`~${Math.round(amount * 15)}g / ml`);
  } else if (lowerUnit.includes("cdta") || lowerUnit === "tsp") {
    helpers.push(`~${Math.round(amount * 5)}g / ml`);
  } else if (lowerUnit.includes("pizca")) {
    helpers.push(`~${(amount * 0.5).toFixed(1)}g`);
  } else if (lowerUnit === "g" && amount >= 1000) {
    helpers.push(`${(amount / 1000).toFixed(2).replace(/\.05$/, "")} kg`);
  } else if (lowerUnit === "ml" && amount >= 1000) {
    helpers.push(`${(amount / 1000).toFixed(2).replace(/\.05$/, "")} l`);
  }

  if (helpers.length === 0) return null;
  return helpers.join(" • ");
};

interface RecipeFormProps {
  recipe: Recipe | null; // null for adding new
  onGoBack: () => void;
  onSave: () => void;
}

export default function RecipeForm({ recipe, onGoBack, onSave }: RecipeFormProps) {
  const { t } = useTranslation();
  const isEditing = !!recipe;

  // Form Fields State
  const [recipeName, setRecipeName] = useState("");
  const [calories, setCalories] = useState<number | null>(null);
  const [timeValue, setTimeValue] = useState<number>(20);
  const [timeUnit, setTimeUnit] = useState<"min" | "h">("min");
  const [tag, setTag] = useState("");
  const [image, setImage] = useState("");
  const [tips, setTips] = useState("");
  const [nutritionistTips, setNutritionistTips] = useState("");
  const [servings, setServings] = useState<number>(1);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [season, setSeason] = useState<string>("Todas");
  const [previewError, setPreviewError] = useState(false);

  const canAddIngredient = ingredients.length > 0 && ingredients[ingredients.length - 1].name.trim() !== "";
  const canAddStep = steps.length > 0 && steps[steps.length - 1].trim() !== "";

  // Modal State for custom inline validation & alerts
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel?: () => void;
    showCancel?: boolean;
    variant?: "danger" | "warning" | "success" | "info";
    icon?: string;
    cancelLabel?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "",
    onConfirm: () => {},
  });

  useEffect(() => {
    setPreviewError(false);
  }, [image]);

  // Database Ingredients Dictionary (for autocomplete)
  const [dbIngredients, setDbIngredients] = useState<{ name: string; category: string }[]>([]);
  const [activeAutocompleteIndex, setActiveAutocompleteIndex] = useState<number | null>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<{ name: string; category: string }[]>([]);

  // Modal State for new ingredient registration
  const [newIngredientModal, setNewIngredientModal] = useState<{
    isOpen: boolean;
    name: string;
    index: number;
    category: string;
    newCategory: string;
    isCreatingCategory: boolean;
  }>({
    isOpen: false,
    name: "",
    index: -1,
    category: "Otros",
    newCategory: "",
    isCreatingCategory: false,
  });

  const categoriesList = Array.from(new Set([
    "Verduras", "Proteínas", "Pescados", "Lácteos/Bebidas", "Granos/Semillas", "Despensa", "Otros",
    ...dbIngredients.map(di => di.category).filter(Boolean)
  ]));

  const handleConfirmNewIngredient = async () => {
    const finalCategory = newIngredientModal.isCreatingCategory 
      ? newIngredientModal.newCategory.trim() 
      : newIngredientModal.category;

    if (!finalCategory) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_category_required_title"),
        description: t("recipeform.alert_category_required_desc"),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "warning",
        icon: "warning"
      });
      return;
    }

    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newIngredientModal.name,
          category: finalCategory
        })
      });

      if (res.ok) {
        // Add locally to dbIngredients so it doesn't prompt again
        setDbIngredients(prev => [
          ...prev, 
          { name: newIngredientModal.name.toLowerCase().trim(), category: finalCategory }
        ]);

        // Update the category in the current ingredients list of the form
        if (newIngredientModal.index !== -1 && ingredients[newIngredientModal.index]) {
          const updated = [...ingredients];
          updated[newIngredientModal.index].category = finalCategory;
          setIngredients(updated);
        }

        setNewIngredientModal(prev => ({ ...prev, isOpen: false }));
      } else {
        throw new Error();
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_register_error_title"),
        description: t("recipeform.alert_register_error_desc"),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "danger",
        icon: "error"
      });
    }
  };

  const handleConfirmValidationItem = async () => {
    if (!tempParsedRecipe) return;

    const currentItem = importValidationQueue[currentValidationIdx];
    if (!currentItem) return;

    const finalName = validationIngredientName.trim();
    if (!finalName) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_name_required_title"),
        description: t("recipeform.alert_name_required_desc"),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "warning",
        icon: "warning"
      });
      return;
    }

    const finalCategory = validationIsCreatingCategory 
      ? validationNewCategory.trim() 
      : validationCategory;

    if (!finalCategory) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_category_required_title"),
        description: t("recipeform.alert_category_required_desc"),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "warning",
        icon: "warning"
      });
      return;
    }

    try {
      const exists = dbIngredients.some(
        (di) => di.name.toLowerCase().trim() === finalName.toLowerCase().trim()
      );

      let resolvedCategory = finalCategory;

      if (!exists) {
        const res = await fetch("/api/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: finalName,
            category: finalCategory
          })
        });

        if (res.ok) {
          setDbIngredients(prev => [
            ...prev,
            { name: finalName.toLowerCase().trim(), category: finalCategory }
          ]);
        } else {
          throw new Error("No se pudo registrar el alimento en la base de datos.");
        }
      } else {
        const existingIng = dbIngredients.find(
          (di) => di.name.toLowerCase().trim() === finalName.toLowerCase().trim()
        );
        resolvedCategory = existingIng?.category || finalCategory;
      }

      const updatedIngs = [...tempParsedRecipe.ingredients];
      updatedIngs[currentItem.index] = {
        ...updatedIngs[currentItem.index],
        name: finalName,
        category: resolvedCategory
      };

      const nextParsedRecipe = {
        ...tempParsedRecipe,
        ingredients: updatedIngs
      };
      setTempParsedRecipe(nextParsedRecipe);

      const nextIdx = currentValidationIdx + 1;
      if (nextIdx < importValidationQueue.length) {
        setCurrentValidationIdx(nextIdx);
        const nextItem = importValidationQueue[nextIdx];
        setValidationIngredientName(nextItem.name);
        setValidationCategory("Otros");
        setValidationNewCategory("");
        setValidationIsCreatingCategory(false);
        setValidationSkippedMessage("");
      } else {
        let skippedMsg = "";
        if (skippedIngredientsList.length === 1) {
          skippedMsg = t("recipeform.ai_import_skipped_singular", { name: skippedIngredientsList[0] });
        } else if (skippedIngredientsList.length > 1) {
          const listStr = skippedIngredientsList.map(name => `"${name}"`).join(", ");
          skippedMsg = t("recipeform.ai_import_skipped_plural", { list: listStr });
        }
        completeImport(nextParsedRecipe, skippedMsg);
      }
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_register_error_title"),
        description: err.message || t("recipeform.alert_register_error_desc"),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "danger",
        icon: "error"
      });
    }
  };

  const handleCancelValidationItem = () => {
    if (!tempParsedRecipe) return;

    const currentItem = importValidationQueue[currentValidationIdx];
    if (!currentItem) return;

    const skippedName = currentItem.name;
    const newSkippedList = [...skippedIngredientsList, skippedName];
    setSkippedIngredientsList(newSkippedList);

    // Mark for removal
    const updatedIngs = [...tempParsedRecipe.ingredients];
    updatedIngs[currentItem.index] = {
      ...updatedIngs[currentItem.index],
      name: "", 
    };

    const nextParsedRecipe = {
      ...tempParsedRecipe,
      ingredients: updatedIngs
    };
    setTempParsedRecipe(nextParsedRecipe);

    const nextIdx = currentValidationIdx + 1;
    if (nextIdx < importValidationQueue.length) {
      setCurrentValidationIdx(nextIdx);
      const nextItem = importValidationQueue[nextIdx];
      setValidationIngredientName(nextItem.name);
      setValidationCategory("Otros");
      setValidationNewCategory("");
      setValidationIsCreatingCategory(false);
      setValidationSkippedMessage(t("recipeform.ai_ingredient_removed", { name: skippedName }));
    } else {
      let skippedMsg = "";
      if (newSkippedList.length === 1) {
        skippedMsg = t("recipeform.ai_import_skipped_singular", { name: newSkippedList[0] });
      } else {
        const listStr = newSkippedList.map(name => `"${name}"`).join(", ");
        skippedMsg = t("recipeform.ai_import_skipped_plural", { list: listStr });
      }
      completeImport(nextParsedRecipe, skippedMsg);
    }
  };

  const completeImport = (recipe: any, customSuccessMsg?: string) => {
    setRecipeName(recipe.recipeName);
    setCalories(recipe.calories);
    setTimeValue(recipe.timeValue);
    setTimeUnit(recipe.timeUnit);
    setTag(recipe.tag);

    // Filter out skipped ingredients
    let flatIngs = recipe.ingredients.filter((ing: any) => ing.name && ing.name.trim() !== "");
    if (flatIngs.length === 0) {
      flatIngs = [{ name: "", originalAmount: 100, unit: "g", category: "Otros" }];
    } else {
      flatIngs.push({ name: "", originalAmount: 100, unit: "g", category: "Otros" });
    }
    setIngredients(flatIngs);

    let flatSteps = [...recipe.steps];
    if (flatSteps.length === 0) {
      flatSteps = [""];
    } else {
      flatSteps.push("");
    }
    setSteps(flatSteps);

    setImportValidationQueue([]);
    setCurrentValidationIdx(-1);
    setTempParsedRecipe(null);
    setValidationSkippedMessage("");
    setErrorMessage(customSuccessMsg || t("recipeform.ai_import_complete"));
    setIsSuccessMessage(true);
  };

  const [dbTags, setDbTags] = useState<string[]>([]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const tagsList = Array.from(new Set([
    "Saludable", "Vegano", "Vegetariano", "Rápido", "Sin Gluten", "Keto",
    ...dbTags,
    ...(tag ? [tag] : [])
  ]));

  // Unsplash/Image Search State
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageSearchResults, setImageSearchResults] = useState<string[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchMessage, setImageSearchMessage] = useState("");

  // AI Import State
  const [importType, setImportType] = useState<"image" | "pdf" | "text" | "mejora">("text");
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [optionsCount, setOptionsCount] = useState<number>(3);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiOptions, setAiOptions] = useState<any[]>([]);
  const [selectedAiOptionIdx, setSelectedAiOptionIdx] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);

  // Programmatic Import Validation Queue State
  interface ImportValidationItem {
    index: number;
    name: string;
    category: string;
    amount: number;
    unit: string;
  }
  const [importValidationQueue, setImportValidationQueue] = useState<ImportValidationItem[]>([]);
  const [currentValidationIdx, setCurrentValidationIdx] = useState<number>(-1);
  const [tempParsedRecipe, setTempParsedRecipe] = useState<{
    recipeName: string;
    calories: number | null;
    timeValue: number;
    timeUnit: string;
    tag: string;
    ingredients: Ingredient[];
    steps: string[];
  } | null>(null);

  const [validationIngredientName, setValidationIngredientName] = useState<string>("");
  const [validationCategory, setValidationCategory] = useState<string>("Otros");
  const [validationNewCategory, setValidationNewCategory] = useState<string>("");
  const [validationIsCreatingCategory, setValidationIsCreatingCategory] = useState<boolean>(false);
  const [validationSkippedMessage, setValidationSkippedMessage] = useState<string>("");
  const [skippedIngredientsList, setSkippedIngredientsList] = useState<string[]>([]);

  // Fetch Database Recipe Tags
  useEffect(() => {
    fetch("/api/recipes/tags")
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((data) => {
        setDbTags(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Error loading recipe tags:", err));
  }, []);

  // Fetch Database Ingredients for Autocomplete
  useEffect(() => {
    fetch("/api/ingredients")
      .then((res) => {
        if (res.ok) return res.json();
        return [];
      })
      .then((data) => {
        setDbIngredients(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Error loading ingredients dict:", err));
  }, []);

  // Populate form if editing
  useEffect(() => {
    if (recipe) {
      setRecipeName(recipe.recipeName);
      setCalories(recipe.calories !== undefined ? recipe.calories : null);
      
      const timeStr = recipe.time || "";
      const valMatch = timeStr.match(/[\d.,]+/);
      const parsedVal = valMatch ? parseFloat(valMatch[0].replace(",", ".")) : 20;
      setTimeValue(parsedVal);
      setTimeUnit(timeStr.toLowerCase().includes("h") ? "h" : "min");

      setTag(recipe.tag || "");
      setImage(recipe.image || "");
      setTips(recipe.tips || "");
      setNutritionistTips(recipe.nutritionistTips || "");
      setServings(recipe.servings || 1);
      setSeason(recipe.season || "Todas");

      // Handle both CategorizedIngredients and flat array
      let flatIngs: Ingredient[] = [];
      if (Array.isArray(recipe.ingredients)) {
        flatIngs = [...recipe.ingredients];
      } else if (recipe.ingredients && typeof recipe.ingredients === "object") {
        for (const cat of ["primerPlato", "segundoPlato", "postre", "general"]) {
          const arr = (recipe.ingredients as any)[cat];
          if (Array.isArray(arr)) {
            flatIngs.push(...arr);
          }
        }
      }
      
      // Apply trailing empty item logic on load
      let lastNonEmptyIng = -1;
      for (let i = flatIngs.length - 1; i >= 0; i--) {
        if (flatIngs[i].name.trim() !== "") {
          lastNonEmptyIng = i;
          break;
        }
      }
      if (lastNonEmptyIng === -1) {
        flatIngs = [{ name: "", originalAmount: 100, unit: "g", category: "Otros" }];
      } else {
        flatIngs = flatIngs.slice(0, lastNonEmptyIng + 1);
        flatIngs.push({ name: "", originalAmount: 100, unit: "g", category: "Otros" });
      }
      setIngredients(flatIngs);

      // Handle steps
      let flatSteps: string[] = [];
      if (Array.isArray(recipe.steps)) {
        flatSteps = [...recipe.steps];
      } else if (recipe.steps && typeof recipe.steps === "object") {
        for (const cat of ["primerPlato", "segundoPlato", "postre", "general"]) {
          const arr = (recipe.steps as any)[cat];
          if (Array.isArray(arr)) {
            flatSteps.push(...arr);
          }
        }
      }
      
      // Apply trailing empty item logic on load
      let lastNonEmptyStep = -1;
      for (let i = flatSteps.length - 1; i >= 0; i--) {
        if (flatSteps[i].trim() !== "") {
          lastNonEmptyStep = i;
          break;
        }
      }
      if (lastNonEmptyStep === -1) {
        flatSteps = [""];
      } else {
        flatSteps = flatSteps.slice(0, lastNonEmptyStep + 1);
        flatSteps.push("");
      }
      setSteps(flatSteps);
    } else {
      // Defaults for new recipe
      setRecipeName("");
      setCalories(null);
      setTimeValue(20);
      setTimeUnit("min");
      setTag("Saludable");
      setImage("");
      setTips("");
      setNutritionistTips("");
      setServings(1);
      setSeason("Todas");
      setIngredients([{ name: "", originalAmount: 100, unit: "g", category: "Otros" }]);
      setSteps([""]);
    }
  }, [recipe]);

  // Handle Autocomplete Filter
  const handleIngredientNameChange = (val: string, index: number) => {
    if (val.trim() === "") {
      const filtered = ingredients.filter((_, i) => i !== index);
      let lastNonEmptyIdx = -1;
      for (let i = filtered.length - 1; i >= 0; i--) {
        if (filtered[i].name.trim() !== "") {
          lastNonEmptyIdx = i;
          break;
        }
      }
      let finalIngs = [];
      if (lastNonEmptyIdx === -1) {
        finalIngs = [{ name: "", originalAmount: 100, unit: "g", category: "Otros" }];
      } else {
        finalIngs = filtered.slice(0, lastNonEmptyIdx + 1);
        finalIngs.push({ name: "", originalAmount: 100, unit: "g", category: "Otros" });
      }
      setIngredients(finalIngs);
      setAutocompleteSuggestions([]);
      setActiveAutocompleteIndex(null);
      return;
    }

    let updated = [...ingredients];
    updated[index].name = val;

    // Apply trailing empty item logic:
    let lastNonEmptyIdx = -1;
    for (let i = updated.length - 1; i >= 0; i--) {
      if (updated[i].name.trim() !== "") {
        lastNonEmptyIdx = i;
        break;
      }
    }

    if (lastNonEmptyIdx === -1) {
      updated = [{ name: "", originalAmount: 100, unit: "g", category: "Otros" }];
    } else {
      updated = updated.slice(0, lastNonEmptyIdx + 1);
      updated.push({ name: "", originalAmount: 100, unit: "g", category: "Otros" });
    }

    // Smart category autocomplete (Option 1)
    const exactMatch = dbIngredients.find(
      (i) => i.name.toLowerCase().trim() === val.toLowerCase().trim()
    );
    if (exactMatch && updated[index]) {
      updated[index].category = exactMatch.category || "Otros";
    }

    setIngredients(updated);

    if (val.trim().length > 1) {
      const suggestions = dbIngredients.filter((i) =>
        i.name.toLowerCase().includes(val.toLowerCase())
      );
      setAutocompleteSuggestions(suggestions.slice(0, 5));
      setActiveAutocompleteIndex(index);
    } else {
      setAutocompleteSuggestions([]);
      setActiveAutocompleteIndex(null);
    }
  };

  const handleSelectSuggestion = (sug: { name: string; category: string }, index: number) => {
    let updated = [...ingredients];
    updated[index].name = sug.name;
    updated[index].category = sug.category || "Otros";

    // Apply trailing empty item logic:
    let lastNonEmptyIdx = -1;
    for (let i = updated.length - 1; i >= 0; i--) {
      if (updated[i].name.trim() !== "") {
        lastNonEmptyIdx = i;
        break;
      }
    }

    if (lastNonEmptyIdx === -1) {
      updated = [{ name: "", originalAmount: 100, unit: "g", category: "Otros" }];
    } else {
      updated = updated.slice(0, lastNonEmptyIdx + 1);
      updated.push({ name: "", originalAmount: 100, unit: "g", category: "Otros" });
    }

    setIngredients(updated);
    setAutocompleteSuggestions([]);
    setActiveAutocompleteIndex(null);
  };

  // Add/Remove list items
  const addIngredient = () => {
    if (ingredients.length > 0 && ingredients[ingredients.length - 1].name.trim() === "") {
      return;
    }
    setIngredients([
      ...ingredients,
      { name: "", originalAmount: 100, unit: "g", category: "Otros" },
    ]);
  };

  const removeIngredient = (idx: number) => {
    const itemToDelete = ingredients[idx];
    const isEmpty = itemToDelete && itemToDelete.name.trim() === "";

    let updated = ingredients.filter((_, i) => i !== idx);

    if (isEmpty) {
      if (updated.length === 0) {
        updated = [{ name: "", originalAmount: 100, unit: "g", category: "Otros" }];
      }
    } else {
      let lastNonEmptyIdx = -1;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].name.trim() !== "") {
          lastNonEmptyIdx = i;
          break;
        }
      }

      if (lastNonEmptyIdx === -1) {
        updated = [{ name: "", originalAmount: 100, unit: "g", category: "Otros" }];
      } else {
        updated = updated.slice(0, lastNonEmptyIdx + 1);
        updated.push({ name: "", originalAmount: 100, unit: "g", category: "Otros" });
      }
    }

    setIngredients(updated);
  };

  const addStep = () => {
    if (steps.length > 0 && steps[steps.length - 1].trim() === "") {
      return;
    }
    setSteps([...steps, ""]);
  };

  const removeStep = (idx: number) => {
    const itemToDelete = steps[idx];
    const isEmpty = itemToDelete && itemToDelete.trim() === "";

    let updated = steps.filter((_, i) => i !== idx);

    if (isEmpty) {
      if (updated.length === 0) {
        updated = [""];
      }
    } else {
      let lastNonEmptyIdx = -1;
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].trim() !== "") {
          lastNonEmptyIdx = i;
          break;
        }
      }

      if (lastNonEmptyIdx === -1) {
        updated = [""];
      } else {
        updated = updated.slice(0, lastNonEmptyIdx + 1);
        updated.push("");
      }
    }

    setSteps(updated);
  };

  // Agnostic Image Search handler
  const handleSearchImages = async (queryParam?: string) => {
    const query = (queryParam !== undefined ? queryParam : imageSearchQuery).trim();
    if (!query) return;
    setIsSearchingImages(true);
    setImageSearchMessage("");
    setImageSearchResults([]);

    try {
      const res = await fetch(`/api/recipes/image-search?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.results) && data.results.length > 0) {
          setImageSearchResults(data.results);
        } else {
          setImageSearchResults([]);
          setImageSearchMessage(data.reason === "Unsplash client not initialized" 
            ? "Buscador de Unsplash inactivo (API key no configurada)." 
            : t("recipeform.image_no_results"));
        }
      } else {
        throw new Error();
      }
    } catch (err) {
      console.error("Error searching images:", err);
      setImageSearchMessage(t("recipeform.image_search_error"));
    } finally {
      setIsSearchingImages(false);
    }
  };

  // Convert File to Base64 helper
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // strip base64 prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Programmatic Fallback Parser (Deterministic OCR/Text extraction without AI)
  const handleProgrammaticParse = async () => {
    setErrorMessage("");
    setIsSuccessMessage(false);
    let textToParse = "";

    if (importType === "text" || importType === "mejora") {
      textToParse = importText;
    } else if (importType === "image" || importType === "pdf") {
      setErrorMessage(t("recipeform.parser_no_text"));
      setIsSuccessMessage(false);
      return;
    }

    if (!textToParse.trim()) {
      setErrorMessage(t("recipeform.parser_enter_text"));
      setIsSuccessMessage(false);
      return;
    }

    try {
      // 1. Identify section indices and divide lines
      let ingredientsStartIndex = -1;
      let preparationStartIndex = -1;

      const isIngHeader = (l: string) => /^(ingredientes|ingrediente|ingredients|ingredient)$/i.test(l.replace(/[:*#]/g, '').trim());
      const isPrepHeader = (l: string) => /^(preparación|preparacion|pasos|paso|instrucciones|instrucción|instruccion|elaboración|elaboracion|procedimiento|preparation|steps|directions|preparar)$/i.test(l.replace(/[:*#]/g, '').trim());

      const lines = textToParse.split("\n").map(l => l.trim());

      for (let i = 0; i < lines.length; i++) {
        const lineClean = lines[i].replace(/[:*#]/g, '').trim();
        if (isIngHeader(lineClean)) {
          ingredientsStartIndex = i;
        } else if (isPrepHeader(lineClean)) {
          preparationStartIndex = i;
        }
      }

      let parsedName = t("recipeform.parser_default_name");
      let parsedCalories: number | null = null;
      let parsedTime = "20 min";
      let parsedTag = t("recipeform.parser_default_tag");
      const parsedIngredients: Ingredient[] = [];
      const parsedSteps: string[] = [];

      // Find first non-empty line for name (excluding headers)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !isIngHeader(line) && !isPrepHeader(line)) {
          parsedName = line.replace(/[#*]/g, "").trim();
          break;
        }
      }

      let ingredientLines: string[] = [];
      let stepLines: string[] = [];

      if (ingredientsStartIndex !== -1) {
        const endOfIngs = preparationStartIndex !== -1 ? preparationStartIndex : lines.length;
        ingredientLines = lines.slice(ingredientsStartIndex + 1, endOfIngs);
      }

      if (preparationStartIndex !== -1) {
        stepLines = lines.slice(preparationStartIndex + 1);
      } else if (ingredientsStartIndex === -1) {
        // No headers at all. Do heuristic splitting.
        // First line is name. Subsequent lines starting with numbers/bullets are ingredients, the rest are steps.
        const restLines = lines.slice(1).map(l => l.trim()).filter(Boolean);
        for (const line of restLines) {
          const isIng = /^[-*•+o(]\s*/.test(line) || /^\d/.test(line);
          if (isIng) {
            ingredientLines.push(line);
          } else {
            stepLines.push(line);
          }
        }
      }

      // 2. Helper to parse a single ingredient line
      const parseIngredientLine = (line: string): Ingredient | null => {
        let cleanLine = line.trim();
        if (!cleanLine) return null;

        // Strip bullet points or list markers
        cleanLine = cleanLine.replace(/^[-*•+o]\s*/, '').trim();

        // Strip wrapping parentheses if it's something like (Mantequilla)
        if (cleanLine.startsWith('(') && cleanLine.endsWith(')') && !cleanLine.includes(' ')) {
          cleanLine = cleanLine.slice(1, -1).trim();
        }

        let amount = 1;
        let amountParsed = false;
        
        // Normalize unicode fractions
        cleanLine = cleanLine
          .replace(/½/g, " 0.5 ")
          .replace(/⅓/g, " 0.33 ")
          .replace(/¼/g, " 0.25 ")
          .replace(/¾/g, " 0.75 ")
          .replace(/⅛/g, " 0.125 ");

        // Convert word numbers (Spanish)
        const wordNumbers: { regex: RegExp, val: number }[] = [
          { regex: /^(un|una|uno)\s+/i, val: 1 },
          { regex: /^(medio|media)\s+/i, val: 0.5 },
          { regex: /^(dos)\s+/i, val: 2 },
          { regex: /^(tres)\s+/i, val: 3 },
          { regex: /^(cuatro)\s+/i, val: 4 },
          { regex: /^(cinco)\s+/i, val: 5 },
          { regex: /^(seis)\s+/i, val: 6 }
        ];

        for (const wn of wordNumbers) {
          if (wn.regex.test(cleanLine)) {
            cleanLine = cleanLine.replace(wn.regex, `${wn.val} `);
            break;
          }
        }

        // Try to match range, fraction, or single number
        const rangeRegex = /^(\d+(?:[.,]\d+)?)\s*(?:-|–|—|a|o)\s*(\d+(?:[.,]\d+)?)\s+(.*)$/i;
        const fractionRegex = /^(\d+)?\s*(\d+)\/(\d+)\s+(.*)$/;
        const singleNumberRegex = /^(\d+(?:[.,]\d+)?)\s+(.*)$/;

        let remainingText = cleanLine;

        let rangeMatch = cleanLine.match(rangeRegex);
        if (rangeMatch) {
          const start = parseFloat(rangeMatch[1].replace(',', '.'));
          const end = parseFloat(rangeMatch[2].replace(',', '.'));
          amount = (start + end) / 2;
          remainingText = rangeMatch[3].trim();
          amountParsed = true;
        } else {
          let fracMatch = cleanLine.match(fractionRegex);
          if (fracMatch) {
            const whole = fracMatch[1] ? parseFloat(fracMatch[1]) : 0;
            const num = parseFloat(fracMatch[2]);
            const den = parseFloat(fracMatch[3]);
            amount = whole + (num / den);
            remainingText = fracMatch[4].trim();
            amountParsed = true;
          } else {
            let singleMatch = cleanLine.match(singleNumberRegex);
            if (singleMatch) {
              amount = parseFloat(singleMatch[1].replace(',', '.'));
              remainingText = singleMatch[2].trim();
              amountParsed = true;
            }
          }
        }

        let unit = "unidad";
        if (!amountParsed) {
          amount = 1;
          unit = "al gusto";
        }

        const unitsMap: { [key: string]: string } = {
          'g': 'g', 'gr': 'g', 'grs': 'g', 'gramo': 'g', 'gramos': 'g',
          'kg': 'kg', 'kilo': 'kg', 'kilos': 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg',
          'ml': 'ml', 'mililitro': 'ml', 'mililitros': 'ml',
          'l': 'l', 'lt': 'l', 'lts': 'l', 'litro': 'l', 'litros': 'l',
          'cda': 'cda', 'cdas': 'cda', 'cucharada': 'cda', 'cucharadas': 'cda',
          'cdta': 'cdta', 'cdtas': 'cdta', 'cucharadita': 'cdta', 'cucharaditas': 'cdta',
          'taza': 'taza', 'tazas': 'taza', 'cup': 'taza', 'cups': 'taza',
          'vaso': 'vaso', 'vasos': 'vaso',
          'lata': 'lata', 'latas': 'lata', 'bote': 'bote', 'botes': 'bote', 'frasco': 'bote', 'frascos': 'bote',
          'paquete': 'paquete', 'paquetes': 'paquete', 'sobre': 'sobre', 'sobres': 'sobre',
          'unidad': 'unidad', 'unidades': 'unidad', 'ud': 'unidad', 'uds': 'unidad', 'u': 'unidad', 'unidad(es)': 'unidad',
          'loncha': 'loncha', 'lonchas': 'loncha', 'rebanada': 'rebanada', 'rebanadas': 'rebanada', 'rodaja': 'rodaja', 'rodajas': 'rodaja',
          'pizca': 'pizca', 'pizcas': 'pizca', 'puñado': 'puñado', 'puñados': 'puñado',
          'diente': 'diente', 'dientes': 'diente',
          'trozo': 'trozo', 'trozos': 'trozo', 'pedazo': 'trozo', 'pedazos': 'trozo',
          'rama': 'rama', 'ramas': 'rama', 'ramita': 'rama', 'ramitas': 'rama',
          'hoja': 'hoja', 'hojas': 'hoja'
        };

        let name = remainingText;

        if (amountParsed) {
          const wordMatch = remainingText.match(/^([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+)(?:\s+(?:de\s+|del\s+|d')\s*(.*)|(.*))$/i);
          if (wordMatch) {
            const possibleUnit = wordMatch[1].toLowerCase();
            if (unitsMap[possibleUnit]) {
              unit = unitsMap[possibleUnit];
              name = (wordMatch[2] || wordMatch[3] || "").trim();
            } else {
              unit = "unidad";
              name = remainingText;
            }
          } else {
            unit = "unidad";
            name = remainingText;
          }
        }

        // Secondary amount and unit extraction (e.g. "(400 ml +-)" or "(250g)")
        let secondaryAmount: number | undefined = undefined;
        let secondaryUnit: string | undefined = undefined;
        const secondaryMatch = name.match(/\(([\d.,]+)\s*([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]+)?\s*(?:\+\-|\-\+|\+\/\-)?\s*\)/i);
        if (secondaryMatch) {
          const secAmt = parseFloat(secondaryMatch[1].replace(',', '.'));
          let secUnit = (secondaryMatch[2] || "").toLowerCase().trim();
          if (secUnit && unitsMap[secUnit]) {
            secUnit = unitsMap[secUnit];
          }
          secondaryAmount = isNaN(secAmt) ? undefined : secAmt;
          secondaryUnit = secUnit || undefined;
          name = name.replace(secondaryMatch[0], '').trim();
        }

        // Strip "x persona" or "por persona"
        name = name.replace(/\s*(?:x|por|para)\s*(?:persona|personas|pers|pax)(?:\s+o\s+persona)?/gi, '').trim();

        name = name.replace(/^["'\s,.-]+|["'\s,.-]+$/g, '').trim();

        if (name) {
          name = name.charAt(0).toUpperCase() + name.slice(1);
        }

        if (!name) return null;

        return {
          name,
          originalAmount: parseFloat(amount.toFixed(2)),
          unit,
          secondaryAmount,
          secondaryUnit,
          category: "Otros"
        };
      };

      // Parse ingredients lines, pre-splitting composite condiment lines (e.g. "Aceite, sal y pimienta")
      const processedLines: string[] = [];
      for (const line of ingredientLines) {
        let clean = line.trim();
        if (!clean) continue;
        
        // Strip bullet points or list markers
        clean = clean.replace(/^[-*•+o]\s*/, '').trim();

        const startsWithNumber = /^(?:\d|½|⅓|¼|¾|⅛|un\s+|una\s+|uno\s+|medio\s+|media\s+)/i.test(clean);
        const hasSeparators = clean.includes(",") || /\s+y\s+/i.test(clean);
        
        if (!startsWithNumber && hasSeparators) {
          const parts = clean.split(/,\s*|\s+y\s+/i).map(p => p.trim()).filter(Boolean);
          processedLines.push(...parts);
        } else {
          processedLines.push(line);
        }
      }

      for (const line of processedLines) {
        const parsedIng = parseIngredientLine(line);
        if (parsedIng) {
          parsedIngredients.push(parsedIng);
        }
      }

      // Parse steps lines
      for (const line of stepLines) {
        const clean = line.trim();
        if (clean) {
          if (isIngHeader(clean) || isPrepHeader(clean)) continue;
          
          const stepText = clean
            .replace(/^(?:Paso\s+\d+\s*[:.-]*\s*|\d+[-.)\s]+\s*|[-*•]\s*)/i, "")
            .trim();
          
          if (stepText) {
            parsedSteps.push(stepText.charAt(0).toUpperCase() + stepText.slice(1));
          }
        }
      }

      // Try to parse calories or time from text
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (lower.includes("caloría") || lower.includes("caloria") || lower.includes("kcal")) {
          const match = line.match(/\d+/);
          if (match) {
            parsedCalories = parseInt(match[0], 10);
          }
        }
        if (lower.includes("tiempo") || lower.includes("minuto") || lower.includes(" min")) {
          const match = line.match(/\d+/);
          if (match) {
            const isHours = lower.includes("h") || lower.includes("hora");
            parsedTime = `${match[0]} ${isHours ? "h" : "min"}`;
          }
        }
      }

      // 3. Resolve times values
      let parsedTimeVal = 20;
      let parsedTimeUnit = "min";
      if (parsedTime) {
        const valMatch = parsedTime.match(/[\d.,]+/);
        if (valMatch) {
          parsedTimeVal = parseFloat(valMatch[0].replace(",", "."));
        }
        parsedTimeUnit = parsedTime.toLowerCase().includes("h") ? "h" : "min";
      }

      // 4. Match categories with DB and separate unrecognized ones
      const finalIngredients = parsedIngredients.map((ing) => {
        const dbIng = dbIngredients.find(
          (di) => di.name.toLowerCase().trim() === ing.name.toLowerCase().trim()
        );
        if (dbIng) {
          return { ...ing, category: dbIng.category || "Otros" };
        }
        return ing;
      });

      const unrecognized: ImportValidationItem[] = [];
      finalIngredients.forEach((ing, index) => {
        const exists = dbIngredients.some(
          (di) => di.name.toLowerCase().trim() === ing.name.toLowerCase().trim()
        );
        if (!exists) {
          unrecognized.push({
            index,
            name: ing.name,
            category: "Otros",
            amount: ing.originalAmount,
            unit: ing.unit
          });
        }
      });

      // 5. Populate form or initialize validation queue
      if (unrecognized.length > 0) {
        setTempParsedRecipe({
          recipeName: parsedName,
          calories: parsedCalories,
          timeValue: parsedTimeVal,
          timeUnit: parsedTimeUnit,
          tag: parsedTag,
          ingredients: finalIngredients,
          steps: parsedSteps
        });
        setImportValidationQueue(unrecognized);
        setCurrentValidationIdx(0);
        setSkippedIngredientsList([]);
        
        // Init modal fields for first item
        setValidationIngredientName(unrecognized[0].name);
        setValidationCategory("Otros");
        setValidationNewCategory("");
        setValidationIsCreatingCategory(false);
        setValidationSkippedMessage("");
      } else {
        // Direct populate
        setRecipeName(parsedName);
        setCalories(parsedCalories);
        setTimeValue(parsedTimeVal);
        setTimeUnit(parsedTimeUnit);
        setTag(parsedTag);

        let flatIngs = [...finalIngredients];
        if (flatIngs.length === 0) {
          flatIngs = [{ name: "", originalAmount: 100, unit: "g", category: "Otros" }];
        } else {
          flatIngs.push({ name: "", originalAmount: 100, unit: "g", category: "Otros" });
        }
        setIngredients(flatIngs);

        let flatSteps = [...parsedSteps];
        if (flatSteps.length === 0) {
          flatSteps = [""];
        } else {
          flatSteps.push("");
        }
        setSteps(flatSteps);

        setErrorMessage(t("recipeform.parser_success"));
        setIsSuccessMessage(true);
      }
    } catch (err: any) {
      setErrorMessage(t("recipeform.parser_error", { message: err.message }));
      setIsSuccessMessage(false);
    }
  };

  // AI OCR / Document Parser (calls express server endpoint)
  const handleAIParse = async () => {
    setErrorMessage("");
    setIsSuccessMessage(false);
    setAiOptions([]);
    setSelectedAiOptionIdx(null);
    setIsProcessingAI(true);

    try {
      let fileData = "";
      let textData = "";

      if (importType === "image" || importType === "pdf") {
        if (!importFile) {
          throw new Error(t("recipeform.ai_select_file"));
        }
        fileData = await fileToBase64(importFile);
      } else if (importType === "text") {
        textData = importText;
        if (!textData.trim()) {
          throw new Error(t("recipeform.ai_enter_text"));
        }
      } else if (importType === "mejora") {
        // Stringify current manual form to improve it
        const currentRecipeObj = {
          recipeName,
          calories,
          time: `${timeValue} ${timeUnit}`,
          tag,
          ingredients,
          steps,
          tips,
          nutritionistTips,
          servings
        };
        textData = JSON.stringify(currentRecipeObj);
      }

      // Capture current manual recipe state before sending request
      const originalOption = {
        recipeName: recipeName.trim() || t("recipeform.ai_manual_version"),
        calories: calories,
        time: `${timeValue} ${timeUnit}`,
        tag: tag || t("recipeform.ai_manual_tag"),
        image: image,
        ingredients: ingredients.filter(ing => ing.name.trim() !== "").map(ing => ({ ...ing })),
        steps: steps.filter(st => st.trim() !== "").map(st => st),
        tips: tips,
        nutritionistTips: nutritionistTips || t("recipeform.ai_original_version_short"),
        servings: servings,
        isOriginalManual: true
      };

      const response = await fetch("/api/recipes/process-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: importType,
          fileData,
          textData,
          optionsCount,
          extraPrompt
        })
      });

      if (!response.ok) {
        const errObj = await response.json();
        throw new Error(errObj.error || t("recipeform.ai_connection_error"));
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.options) && data.options.length > 0) {
        // Prepend the user's original option to the AI proposals
        setAiOptions([originalOption, ...data.options]);
        setSelectedAiOptionIdx(null); // Reset selection
      } else {
        throw new Error(t("recipeform.ai_no_options"));
      }
    } catch (err: any) {
      console.error("AI Import Exception:", err);
      setErrorMessage(err.message);
      setIsSuccessMessage(false);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Select AI option to populate the form
  const handleSelectAiOption = (idx: number) => {
    const selected = aiOptions[idx];
    if (!selected) return;

    setSelectedAiOptionIdx(idx);
    setRecipeName(selected.recipeName || "");
    setCalories(selected.calories || null);
    
    const timeStr = selected.time || "";
    const valMatch = timeStr.match(/[\d.,]+/);
    const parsedVal = valMatch ? parseFloat(valMatch[0].replace(",", ".")) : 20;
    setTimeValue(parsedVal);
    setTimeUnit(timeStr.toLowerCase().includes("h") ? "h" : "min");

    setTag(selected.tag || "Saludable");
    setTips(selected.tips || "");
    setNutritionistTips(selected.nutritionistTips || "");
    setServings(selected.servings || 1);

    if (selected.image || selected.isOriginalManual) {
      setImage(selected.image || "");
    }

    let flatIngs: Ingredient[] = [];
    if (Array.isArray(selected.ingredients)) {
      flatIngs = [...selected.ingredients];
    }
    let lastNonEmptyIng = -1;
    for (let i = flatIngs.length - 1; i >= 0; i--) {
      if (flatIngs[i].name.trim() !== "") {
        lastNonEmptyIng = i;
        break;
      }
    }
    if (lastNonEmptyIng === -1) {
      flatIngs = [{ name: "", originalAmount: 1, unit: "unidad", category: "Otros" }];
    } else {
      flatIngs = flatIngs.slice(0, lastNonEmptyIng + 1);
      flatIngs.push({ name: "", originalAmount: 1, unit: "unidad", category: "Otros" });
    }
    setIngredients(flatIngs);

    let flatSteps: string[] = [];
    if (Array.isArray(selected.steps)) {
      flatSteps = [...selected.steps];
    }
    let lastNonEmptyStep = -1;
    for (let i = flatSteps.length - 1; i >= 0; i--) {
      if (flatSteps[i].trim() !== "") {
        lastNonEmptyStep = i;
        break;
      }
    }
    if (lastNonEmptyStep === -1) {
      flatSteps = [""];
    } else {
      flatSteps = flatSteps.slice(0, lastNonEmptyStep + 1);
      flatSteps.push("");
    }
    setSteps(flatSteps);
  };

  const submitSave = async (activeIngs: Ingredient[], activeStps: string[]) => {
    const payload: Omit<Recipe, "id"> = {
      recipeName: recipeName.trim(),
      calories: calories || 0,
      time: `${timeValue} ${timeUnit}`,
      tag: tag.trim() || undefined,
      image: image.trim() || undefined,
      ingredients: activeIngs,
      tips: tips.trim(),
      steps: activeStps,
      nutritionistTips: nutritionistTips.trim() || undefined,
      servings: Math.max(1, servings),
      source: isEditing ? recipe.source || "manual" : (importType || "manual"),
      sourcePlanId: isEditing ? recipe.sourcePlanId : undefined,
      isAiGenerated: isEditing 
        ? recipe.isAiGenerated || false 
        : (selectedAiOptionIdx !== null && aiOptions[selectedAiOptionIdx] ? !aiOptions[selectedAiOptionIdx].isOriginalManual : false),
      isFavorite: isEditing ? recipe.isFavorite || false : false,
      season
    };

    try {
      const url = isEditing ? `/api/recipes/${recipe.id}` : "/api/recipes";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSave();
      } else {
        const data = await res.json();
        setAlertModal({
          isOpen: true,
          title: t("recipeform.alert_save_error_title"),
          description: data.error || t("recipeform.alert_save_error_desc"),
          confirmLabel: t("recipeform.alert_accept"),
          onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
          showCancel: false,
          variant: "danger",
          icon: "error"
        });
      }
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_connection_error_title"),
        description: t("recipeform.alert_connection_error_desc", { message: err.message }),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "danger",
        icon: "cloud_off"
      });
    }
  };

  // Save Recipe
  const handleSaveRecipe = () => {
    if (!recipeName.trim()) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_name_required_recipe_title"),
        description: t("recipeform.alert_name_required_recipe_desc"),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "warning",
        icon: "warning"
      });
      return;
    }

    const activeIngs = ingredients.filter((i) => i.name.trim() !== "");
    if (activeIngs.length === 0) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_ingredients_required_title"),
        description: t("recipeform.alert_ingredients_required_desc"),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "warning",
        icon: "shopping_basket"
      });
      return;
    }

    const activeStps = steps.filter((s) => s.trim() !== "");
    if (activeStps.length === 0) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_steps_required_title"),
        description: t("recipeform.alert_steps_required_desc"),
        confirmLabel: t("recipeform.alert_accept"),
        onConfirm: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        showCancel: false,
        variant: "warning",
        icon: "format_list_numbered"
      });
      return;
    }

    // Image warning
    if (!image.trim()) {
      setAlertModal({
        isOpen: true,
        title: t("recipeform.alert_no_image_title"),
        description: t("recipeform.alert_no_image_desc"),
        confirmLabel: t("recipeform.alert_no_image_confirm"),
        onConfirm: () => {
          setAlertModal(prev => ({ ...prev, isOpen: false }));
          submitSave(activeIngs, activeStps);
        },
        showCancel: true,
        cancelLabel: t("recipeform.alert_no_image_cancel"),
        onCancel: () => setAlertModal(prev => ({ ...prev, isOpen: false })),
        variant: "info",
        icon: "image"
      });
      return;
    }

    // Direct save if everything matches
    submitSave(activeIngs, activeStps);
  };

  return (
    <div className="space-y-6 text-left max-w-container-max mx-auto">
      
      {/* Header Controls */}
      <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {isEditing ? t("recipeform.edit_title") : t("recipeform.new_title")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            {isEditing ? t("recipeform.edit_desc", { name: recipe.recipeName }) : t("recipeform.new_desc")}
          </p>
        </div>
        <button
          type="button"
          onClick={onGoBack}
          className="inline-flex items-center justify-center p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400 transition cursor-pointer font-bold text-xs shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px] mr-1.5">arrow_back</span>
{t("recipeform.back_btn")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Form Editors */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl border border-slate-200/50 dark:border-zinc-800 shadow-sm space-y-6">
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1.5">{t("recipeform.name_label")}</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                  placeholder={t("recipeform.name_placeholder")}
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  onBlur={() => {
                    const trimmed = recipeName.trim();
                    if (trimmed) {
                      setImageSearchQuery(trimmed);
                      handleSearchImages(trimmed);
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1.5">{t("recipeform.tag_label")}</label>
                {!isCreatingTag ? (
                  <select
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
                    value={tag || ""}
                    onChange={(e) => {
                      if (e.target.value === "__NEW__") {
                        setIsCreatingTag(true);
                        setTag("");
                      } else {
                        setTag(e.target.value);
                      }
                    }}
                  >
                    <option value="">{t("recipeform.tag_none")}</option>
                    {tagsList.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="__NEW__" className="text-indigo-600 dark:text-indigo-400 font-bold">
                      {t("recipeform.tag_create")}
                    </option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                      placeholder={t("recipeform.tag_create_placeholder")}
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingTag(false);
                        setTag("");
                      }}
                      className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 cursor-pointer"
                    >
                      {t("recipeform.cancel_btn")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1.5">{t("recipeform.calories_label")}</label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                  placeholder={t("recipeform.calories_placeholder")}
                  value={calories !== null ? calories : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCalories(val === "" ? null : parseInt(val, 10));
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1.5">{t("recipeform.time_label")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                    value={timeValue}
                    onChange={(e) => setTimeValue(Math.max(1, parseFloat(e.target.value) || 1))}
                  />
                  <select
                    className="px-2.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
                    value={timeUnit}
                    onChange={(e) => setTimeUnit(e.target.value as "min" | "h")}
                  >
                    <option value="min">min</option>
                    <option value="h">{t("recipeform.time_unit_hours")}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1.5">{t("recipeform.servings_label")}</label>
                <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => setServings(Math.max(1, servings - 1))}
                    disabled={servings <= 1}
                    className="w-8 h-8 rounded-lg hover:bg-slate-200/80 dark:hover:bg-zinc-800/80 flex items-center justify-center font-bold text-slate-700 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed select-none transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">remove</span>
                  </button>
                  <span className="w-8 text-center text-xs font-black text-slate-800 dark:text-zinc-200 select-none">
                    {servings}
                  </span>
                  <button
                    type="button"
                    onClick={() => setServings(servings + 1)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-200/80 dark:hover:bg-zinc-800/80 flex items-center justify-center font-bold text-slate-700 dark:text-zinc-300 select-none transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Ingredients Editor */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block">{t("recipeform.ingredients_label")}</label>
                <button
                  type="button"
                  onClick={addIngredient}
                  disabled={!canAddIngredient}
                  className="inline-flex items-center text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px] mr-1">add_circle</span>
                  {t("recipeform.ingredient_add")}
                </button>
              </div>
              <div className="space-y-3">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="relative flex flex-col gap-2 bg-slate-50/50 dark:bg-zinc-955 p-3 rounded-xl border border-slate-100 dark:border-zinc-800/60">
                    <div className="w-full flex flex-col md:flex-row gap-2.5 items-start md:items-center">
                      {/* Autocomplete Input */}
                      <div className="relative flex-1 w-full">
                        <input
                          type="text"
                          placeholder={t("recipeform.ingredient_placeholder")}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                          value={ing.name}
                          onChange={(e) => handleIngredientNameChange(e.target.value, idx)}
                          onBlur={() => {
                            setTimeout(() => {
                              if (activeAutocompleteIndex === idx) {
                                setActiveAutocompleteIndex(null);
                              }
                              // Prompt if the food doesn't exist in dbIngredients
                              const name = ing.name.trim();
                              if (name) {
                                const exists = dbIngredients.some(
                                  (di) => di.name.toLowerCase().trim() === name.toLowerCase().trim()
                                );
                                if (!exists) {
                                  setNewIngredientModal({
                                    isOpen: true,
                                    name: name,
                                    index: idx,
                                    category: "Otros",
                                    newCategory: "",
                                    isCreatingCategory: false,
                                  });
                                }
                              }
                            }, 250);
                          }}
                        />
                        {activeAutocompleteIndex === idx && autocompleteSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg z-50 overflow-hidden">
                            {autocompleteSuggestions.map((sug, si) => (
                              <button
                                key={si}
                                type="button"
                                onClick={() => handleSelectSuggestion(sug, idx)}
                                className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800/40 last:border-0 cursor-pointer"
                              >
                                <span className="font-bold">{sug.name}</span>
                                <span className="float-right text-[10px] text-slate-400 dark:text-zinc-550 bg-slate-100 dark:bg-zinc-850 px-1.5 py-0.5 rounded">{sug.category}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 w-full md:w-auto">
                        <input
                          type="number"
                          step="any"
                          placeholder={t("recipeform.amount_placeholder")}
                          className="w-16 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200 text-center"
                          value={ing.originalAmount || ""}
                          onChange={(e) => {
                            const updated = [...ingredients];
                            updated[idx].originalAmount = parseFloat(e.target.value) || 0;
                            setIngredients(updated);
                          }}
                        />
                        {(() => {
                          const hardcodedUnits = ["g", "kg", "ml", "l", "unidad", "cucharada", "cucharadita", "taza", "pizca", "diente"];
                          const showCustomUnit = ing.unit && !hardcodedUnits.includes(ing.unit);
                          return (
                            <select
                              className="w-24 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
                              value={ing.unit}
                              onChange={(e) => {
                                const updated = [...ingredients];
                                updated[idx].unit = e.target.value;
                                setIngredients(updated);
                              }}
                            >
                              {hardcodedUnits.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                              {showCustomUnit && (
                                <option value={ing.unit}>{ing.unit}</option>
                              )}
                            </select>
                          );
                        })()}
                      </div>

                      <div className="flex gap-2 w-full md:w-auto">
                        <select
                          className="flex-1 md:flex-none w-28 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
                          value={ing.category || "Otros"}
                          onChange={(e) => {
                            const updated = [...ingredients];
                            updated[idx].category = e.target.value;
                            setIngredients(updated);
                          }}
                        >
                          {categoriesList.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        
                        <button
                          type="button"
                          onClick={() => removeIngredient(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer flex items-center justify-center shrink-0"
                          title={t("recipeform.ingredient_delete_title")}
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>

                    {getIngredientHelperText(ing.originalAmount, ing.unit, servings, t) && (
                      <div className="pl-1.5 border-l-2 border-emerald-500/40 text-[10px] text-emerald-600/95 dark:text-emerald-400/85 font-semibold select-none flex items-center gap-1 mt-0.5 animate-fade-in">
                        <span className="material-symbols-outlined text-[13px] text-emerald-600 dark:text-emerald-450">info</span>
                        <span>{getIngredientHelperText(ing.originalAmount, ing.unit, servings, t)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preparation Steps Editor */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block">{t("recipeform.steps_label")}</label>
                <button
                  type="button"
                  onClick={addStep}
                  disabled={!canAddStep}
                  className="inline-flex items-center text-[10px] font-extrabold text-emerald-600 hover:text-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px] mr-1">add_circle</span>
                  {t("recipeform.step_add")}
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-2 bg-slate-50/20 dark:bg-zinc-955/10 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800/40 items-start">
                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-zinc-400 shrink-0 mt-2">{idx + 1}</span>
                    <textarea
                      rows={2}
                      className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200 resize-none"
                      placeholder={t("recipeform.step_placeholder", { number: idx + 1 })}
                      value={step}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.trim() === "") {
                          const filtered = steps.filter((_, i) => i !== idx);
                          let lastNonEmptyIdx = -1;
                          for (let i = filtered.length - 1; i >= 0; i--) {
                            if (filtered[i].trim() !== "") {
                              lastNonEmptyIdx = i;
                              break;
                            }
                          }
                          let finalSteps = [];
                          if (lastNonEmptyIdx === -1) {
                            finalSteps = [""];
                          } else {
                            finalSteps = filtered.slice(0, lastNonEmptyIdx + 1);
                            finalSteps.push("");
                          }
                          setSteps(finalSteps);
                          return;
                        }

                        let updated = [...steps];
                        updated[idx] = val;

                        // Apply trailing empty item logic:
                        let lastNonEmptyIdx = -1;
                        for (let i = updated.length - 1; i >= 0; i--) {
                          if (updated[i].trim() !== "") {
                            lastNonEmptyIdx = i;
                            break;
                          }
                        }

                        if (lastNonEmptyIdx === -1) {
                          updated = [""];
                        } else {
                          updated = updated.slice(0, lastNonEmptyIdx + 1);
                          updated.push("");
                        }

                        setSteps(updated);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer flex items-center justify-center mt-1.5"
                      title={t("recipeform.step_delete_title")}
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Chef tips & Nutritionist tips */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1.5">{t("recipeform.chef_tips_label")}</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                  placeholder={t("recipeform.chef_tips_placeholder")}
                  value={tips}
                  onChange={(e) => setTips(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1.5">{t("recipeform.nutritionist_tips_label")}</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200 border-l-4 border-l-indigo-500"
                  placeholder={t("recipeform.nutritionist_tips_placeholder")}
                  value={nutritionistTips}
                  onChange={(e) => setNutritionistTips(e.target.value)}
                />
              </div>
            </div>

            {/* Action Save Buttons */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={onGoBack}
                className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 text-slate-600 dark:text-zinc-300 transition font-bold text-xs cursor-pointer"
              >
                {t("recipeform.cancel_btn")}
              </button>
              <button
                type="button"
                onClick={handleSaveRecipe}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition font-black text-xs cursor-pointer shadow-sm"
              >
                {t("recipeform.save_btn")}
              </button>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Image Search & AI Import */}
        <div className="lg:col-span-5 space-y-6">

          {/* Image Uploader & Search */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200/50 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">image</span>
              {t("recipeform.image_label")}
            </h2>

            <div>
              <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1.5">{t("recipeform.image_url_label")}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                  placeholder={t("recipeform.image_url_placeholder")}
                  value={image}
                  onChange={(e) => {
                    setImage(e.target.value);
                    setPreviewError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPreviewError(false);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPreviewError(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer"
                >
{t("recipeform.image_search_btn")}
                </button>
              </div>
            </div>

            {/* Image Preview / Fallback indicator */}
            <div className="w-full h-40 rounded-2xl overflow-hidden bg-slate-100 dark:bg-zinc-950 border border-slate-200/40 dark:border-zinc-800/40 flex items-center justify-center text-slate-400 dark:text-zinc-500 relative">
              {image && !previewError ? (
                <img
                  src={image}
                  alt="Vista previa de receta"
                  onError={() => setPreviewError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImagePlaceholder text={t("recipeform.image_preview_inactive")} />
              )}
            </div>

            {/* Image Search Box */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-850">
              <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1">{t("recipeform.image_search_label")}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t("recipeform.image_search_placeholder")}
                  className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                  value={imageSearchQuery}
                  onChange={(e) => setImageSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchImages()}
                />
                <button
                  type="button"
                  onClick={handleSearchImages}
                  disabled={isSearchingImages}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSearchingImages ? t("recipeform.image_searching") : t("recipeform.image_search_btn")}
                </button>
              </div>

              {imageSearchMessage && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">{imageSearchMessage}</p>
              )}

              {imageSearchResults.length > 0 && (
                <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-36 p-1 border border-slate-100 dark:border-zinc-800/60 rounded-xl bg-slate-50/50 dark:bg-zinc-955 select-none">
                  {imageSearchResults.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImage(url)}
                      className={`h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition active:scale-95 ${
                        image === url ? "border-emerald-500 shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                    >
                      <img src={url} alt={`Resultado ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI / Programmatic Import Accordion */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200/50 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
              <span className="material-symbols-outlined text-indigo-500 text-[18px]">psychology</span>
              {t("recipeform.ai_import_title")}
            </h2>

            {/* Type selector */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-100/80 dark:bg-zinc-950 rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 select-none">
              {(["text", "image", "pdf", "mejora"] as const).map((importTypeOption) => {
                const label = importTypeOption === "text" ? t("recipeform.ai_type_text") : importTypeOption === "image" ? t("recipeform.ai_type_image") : importTypeOption === "pdf" ? t("recipeform.ai_type_pdf") : t("recipeform.ai_type_mejora");
                const isActive = importType === importTypeOption;
                return (
                  <button
                    key={importTypeOption}
                    type="button"
                    onClick={() => {
                      setImportType(importTypeOption);
                      setAiOptions([]);
                      setErrorMessage("");
                      setIsSuccessMessage(false);
                    }}
                    className={`py-1 rounded-md text-[10px] font-black tracking-tight cursor-pointer transition duration-150 ${
                      isActive
                        ? "bg-indigo-500 text-white shadow-xs"
                        : "bg-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Conditional Input Rendering */}
            <div className="space-y-3">
              {(importType === "text" || importType === "mejora") && (
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1">
                    {importType === "text" ? t("recipeform.ai_text_label") : t("recipeform.ai_mejora_label")}
                  </label>
                  <textarea
                    rows={4}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-indigo-500 text-slate-700 dark:text-zinc-200"
                    placeholder={
                      importType === "text"
                        ? t("recipeform.ai_text_placeholder")
                        : t("recipeform.ai_mejora_placeholder")
                    }
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                </div>
              )}

              {(importType === "image" || importType === "pdf") && (
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1">
                    {importType === "image" ? t("recipeform.ai_image_label") : t("recipeform.ai_pdf_label")}
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-950 border-slate-200 dark:border-zinc-800/80 bg-slate-50/20 dark:bg-zinc-900 transition duration-150">
                      <div className="flex flex-col items-center justify-center pt-3 pb-3">
                        <span className="material-symbols-outlined text-slate-400 text-2xl select-none">upload_file</span>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mt-1.5">
                          {importFile ? importFile.name : t("recipeform.ai_file_upload")}
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept={importType === "image" ? "image/*" : "application/pdf"}
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Extras block */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1">{t("recipeform.ai_variants_label")}</label>
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => setOptionsCount(Math.max(1, optionsCount - 1))}
                      disabled={optionsCount <= 1}
                      className="w-8 h-8 rounded-lg hover:bg-slate-200/80 dark:hover:bg-zinc-800/80 flex items-center justify-center font-bold text-slate-700 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed select-none transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] font-bold">remove</span>
                    </button>
                    <span className="w-8 text-center text-xs font-black text-slate-800 dark:text-zinc-200 select-none">
                      {optionsCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOptionsCount(Math.min(5, optionsCount + 1))}
                      disabled={optionsCount >= 5}
                      className="w-8 h-8 rounded-lg hover:bg-slate-200/80 dark:hover:bg-zinc-800/80 flex items-center justify-center font-bold text-slate-700 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed select-none transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] font-bold">add</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1">{t("recipeform.ai_extra_label")}</label>
                  <input
                    type="text"
                    placeholder={t("recipeform.ai_extra_placeholder")}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:outline-none focus:border-indigo-500 text-slate-700 dark:text-zinc-200"
                    value={extraPrompt}
                    onChange={(e) => setExtraPrompt(e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-1">
                {/* Programmatic parser (only for text) */}
                {(importType === "text" || importType === "mejora") && (
                  <button
                    type="button"
                    onClick={handleProgrammaticParse}
                    disabled={isProcessingAI}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 text-slate-600 dark:text-zinc-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {t("recipeform.ai_import_direct")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAIParse}
                  disabled={isProcessingAI}
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isProcessingAI ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white animate-spin"></div>
                      <span>{t("recipeform.ai_processing")}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[15px]">settings_suggest</span>
                      <span>{t("recipeform.ai_process_btn")}</span>
                    </>
                  )}
                </button>
              </div>

              {errorMessage && (
                <div className={`p-3 rounded-xl text-xs font-semibold border ${
                  isSuccessMessage
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30" 
                    : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-100/50 dark:border-red-900/30"
                }`}>
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Generated AI Options Carousel/Grid */}
            {aiOptions.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-850 space-y-3 select-none">
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest leading-none mb-1">
                  {t("recipeform.ai_options_found", { count: aiOptions.length })}
                </p>
                <div className="flex flex-col gap-2.5">
                  {aiOptions.map((opt, oi) => {
                    const isSelected = selectedAiOptionIdx === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => handleSelectAiOption(oi)}
                        className={`w-full p-3.5 rounded-2xl border text-left transition duration-200 cursor-pointer flex flex-col gap-1.5 shadow-sm ${
                          isSelected
                            ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 ring-2 ring-indigo-500/25"
                            : opt.isOriginalManual
                              ? "bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-100/20 dark:hover:bg-amber-900/10 border-amber-200/50 dark:border-amber-900/30"
                              : "bg-slate-50/50 dark:bg-zinc-950/20 hover:bg-slate-100/30 dark:hover:bg-zinc-850/20 border-slate-200 dark:border-zinc-800"
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 leading-tight">
                            {opt.recipeName || t("recipeform.ai_no_name")}
                          </h3>
                          {opt.isOriginalManual ? (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 shadow-sm border border-amber-200 dark:border-amber-900/40">
{t("recipeform.ai_original_badge")}
                            </span>
                          ) : opt.tag ? (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100/30 dark:border-indigo-900/40">
                              {opt.tag}
                            </span>
                          ) : null}
                        </div>
                        
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-zinc-400">
                          <span className="font-semibold">{opt.time || "20 min"}</span>
                          <span>•</span>
                          <span className="font-semibold">{opt.calories || 0} kcal</span>
                          <span>•</span>
                          <span>{opt.servings || 1} {t("recipeform.ai_servings_orig")}</span>
                        </div>
                        
                        {opt.nutritionistTips && (
                          <p className="text-[10px] text-slate-400 dark:text-zinc-550 italic truncate w-full">
                            {opt.isOriginalManual ? t("recipeform.ai_original_version") : t("recipeform.ai_nutri_tip", { tip: opt.nutritionistTips })}
                          </p>
                        )}
                        
                        <div className="mt-1 self-end text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:underline">
                          {isSelected ? t("recipeform.ai_selected") : t("recipeform.ai_select_option")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      <ConfirmationModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        description={alertModal.description}
        confirmLabel={alertModal.confirmLabel}
        onConfirm={alertModal.onConfirm}
        onCancel={alertModal.onCancel || (() => setAlertModal(prev => ({ ...prev, isOpen: false })))}
        cancelLabel={alertModal.cancelLabel}
        showCancel={alertModal.showCancel}
        variant={alertModal.variant || "warning"}
        icon={alertModal.icon}
      />

      {newIngredientModal.isOpen && (
        <div className="modal-overlay fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in no-print" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 text-left">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40">
              <span className="material-symbols-outlined text-[30px]">restaurant</span>
            </div>

            <h3 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white text-center">
              {t("recipeform.new_ingredient_title")}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-zinc-400 text-center"
  dangerouslySetInnerHTML={{ __html: t("recipeform.new_ingredient_desc", { name: newIngredientModal.name }) }}>
</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1">
                  {t("recipeform.new_ingredient_category")}
                </label>
                {!newIngredientModal.isCreatingCategory ? (
                  <div className="flex gap-2">
                    <select
                      className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
                      value={newIngredientModal.category}
                      onChange={(e) => {
                        if (e.target.value === "__NEW__") {
                          setNewIngredientModal(prev => ({ ...prev, isCreatingCategory: true }));
                        } else {
                          setNewIngredientModal(prev => ({ ...prev, category: e.target.value }));
                        }
                      }}
                    >
                      {categoriesList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__NEW__" className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {t("recipeform.tag_create")}
                      </option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder={t("recipeform.new_ingredient_category_placeholder")}
                        className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-emerald-500 text-slate-700 dark:text-zinc-200"
                        value={newIngredientModal.newCategory}
                        onChange={(e) => setNewIngredientModal(prev => ({ ...prev, newCategory: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => setNewIngredientModal(prev => ({ ...prev, isCreatingCategory: false }))}
                        className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 cursor-pointer"
                      >
                        {t("recipeform.cancel_btn")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewIngredientModal(prev => ({ ...prev, isOpen: false }))}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-500/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
              >
                {t("recipeform.new_ingredient_skip")}
              </button>
              <button
                type="button"
                onClick={handleConfirmNewIngredient}
                className="rounded-xl px-4 py-2.5 text-xs font-bold transition-colors focus:outline-none focus:ring-4 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500/30"
              >
                {t("recipeform.new_ingredient_save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {currentValidationIdx !== -1 && importValidationQueue.length > 0 && (
        <div className="modal-overlay fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in no-print" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 text-left space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="material-symbols-outlined text-[20px]">fact_check</span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold tracking-tight text-gray-900 dark:text-white">
                    {t("recipeform.validation_title")}
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-zinc-400">
                    {t("recipeform.validation_subtitle")}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                {t("recipeform.validation_progress", { current: currentValidationIdx + 1, total: importValidationQueue.length })}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                style={{ width: `${((currentValidationIdx + 1) / importValidationQueue.length) * 100}%` }}
              ></div>
            </div>

            {/* Warning from skipped ingredient if present */}
            {validationSkippedMessage && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl text-[11px] leading-relaxed flex items-start gap-2 animate-pulse">
                <span className="material-symbols-outlined text-base mt-0.5 select-none text-amber-500">warning</span>
                <span>{validationSkippedMessage}</span>
              </div>
            )}

            {/* Detail */}
            <div className="bg-slate-50/50 dark:bg-zinc-955 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-850/60 text-xs text-slate-600 dark:text-zinc-400 space-y-1">
              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block leading-none">{t("recipeform.validation_original_text")}</span>
              <p className="font-bold text-slate-800 dark:text-zinc-200 leading-snug">
                "{importValidationQueue[currentValidationIdx].amount} {importValidationQueue[currentValidationIdx].unit} de {importValidationQueue[currentValidationIdx].name}"
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight">
                {t("recipeform.validation_not_registered")}
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1">
                  {t("recipeform.validation_name_label")}
                </label>
                <input
                  type="text"
                  placeholder={t("recipeform.validation_name_placeholder")}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-indigo-500 text-slate-700 dark:text-zinc-200"
                  value={validationIngredientName}
                  onChange={(e) => setValidationIngredientName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block mb-1">
                  {t("recipeform.validation_category_label")}
                </label>
                {!validationIsCreatingCategory ? (
                  <select
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-indigo-500 text-slate-700 dark:text-zinc-200 cursor-pointer"
                    value={validationCategory}
                    onChange={(e) => {
                      if (e.target.value === "__NEW__") {
                        setValidationIsCreatingCategory(true);
                      } else {
                        setValidationCategory(e.target.value);
                      }
                    }}
                  >
                    {categoriesList.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__NEW__" className="text-indigo-600 dark:text-indigo-400 font-bold">
                      {t("recipeform.tag_create")}
                    </option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t("recipeform.validation_category_placeholder")}
                      className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-955 focus:outline-none focus:border-indigo-500 text-slate-700 dark:text-zinc-200"
                      value={validationNewCategory}
                      onChange={(e) => setValidationNewCategory(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setValidationIsCreatingCategory(false)}
                      className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 cursor-pointer transition"
                    >
                      {t("recipeform.cancel_btn")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800/60">
              <button
                type="button"
                onClick={handleCancelValidationItem}
                className="rounded-xl border border-red-200 bg-red-50/20 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/35 dark:bg-red-950/10 dark:text-red-400 dark:hover:bg-red-950/20 transition cursor-pointer"
              >
                {t("recipeform.validation_delete")}
              </button>
              <button
                type="button"
                onClick={handleConfirmValidationItem}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition cursor-pointer"
              >
                {t("recipeform.validation_save_continue")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
