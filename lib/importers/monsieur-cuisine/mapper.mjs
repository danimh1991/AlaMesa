const clean = (value) => (typeof value === "string" ? value.trim() : "");
const normalize = (value) =>
  clean(String(value ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const chunks = (value, maximum) => {
  const result = [];
  for (let index = 0; index < value.length; index += maximum) {
    result.push(value.slice(index, index + maximum));
  }
  return result;
};

const FRACTIONS = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

export function monsieurCuisineRecipeId(sourceId) {
  const id = Number(sourceId);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("ID original no válido");
  return `monsieur-cuisine-${id}`;
}

function quantity(value) {
  const raw = clean(String(value ?? ""));
  if (!raw) return null;
  if (FRACTIONS[raw] !== undefined) return FRACTIONS[raw];
  const mixed = raw.match(/^(\d+)\s*([¼½¾⅓⅔])$/);
  if (mixed) return Number(mixed[1]) + FRACTIONS[mixed[2]];
  const number = Number(raw.replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function chooseServing(recipe) {
  const servings = Array.isArray(recipe.servingSizes) ? recipe.servingSizes : [];
  return (
    servings.find((entry) => entry?.id === recipe.defaultServingSizeId) ?? servings[0]
  );
}

function categoryFor(recipe) {
  const name = normalize(recipe.name);
  if (/pasta|espaguet|macarron|fusilli|ñoqui|noqui|raviol|tallarin|fideo|canelon|lasaña|lasana|pizza/.test(name)) return "Pasta";
  if (/arroz|paella|risotto/.test(name)) return "Arroz";
  if (/pollo|pavo|gallina/.test(name)) return "Pollo";
  if (/merluza|salmon|atun|bacalao|pescado|sardina|gamba|langostino|marisco|calamar|pulpo|dorada|lubina/.test(name)) return "Pescado";
  if (/ternera|cerdo|cordero|carne|costilla|solomillo|chorizo|jamon|albondiga/.test(name)) return "Carne";
  if (/lenteja|garbanzo|alubia|frijol|judia|haba/.test(name)) return "Legumbres";
  if (/huevo|tortilla|revuelto/.test(name)) return "Huevos";
  return "Verduras";
}

function typeFor(recipe) {
  const categories = (recipe.categories ?? []).map((entry) => normalize(entry?.name));
  if (categories.some((name) => name === "guarniciones")) return "Guarnición";
  if (categories.some((name) => name === "entrantes")) return "Entrante";
  return "Único";
}

function mealTypeFor(recipe) {
  const categories = (recipe.categories ?? []).map((entry) => normalize(entry?.name));
  if (categories.includes("desayunos")) return "Desayuno";
  if (categories.includes("cenas") && !categories.includes("platos principales")) return "Cena";
  return "Comida";
}

function seconds(value) {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value % 60 === 0) return `${value / 60} min`;
  if (value > 60) return `${Math.floor(value / 60)} min ${value % 60} s`;
  return `${value} s`;
}

const MODE_LABELS = {
  customized: "Cocción personalizada",
  kneading: "Amasado",
  scale: "Báscula",
  turbo: "Turbo",
  steaming: "Vaporera",
  roasting: "Rehogar",
};

function deviceText(deviceSetting) {
  if (!deviceSetting || typeof deviceSetting !== "object") return "";
  const common = [];
  if (deviceSetting.mode) common.push(MODE_LABELS[deviceSetting.mode] ?? `Programa ${deviceSetting.mode}`);
  if (deviceSetting.reverse) common.push("sentido inverso");
  if (deviceSetting.turbo) common.push("turbo");
  if (deviceSetting.size) common.push(`tamaño ${deviceSetting.size}`);
  if (deviceSetting.texture) common.push(`textura ${deviceSetting.texture}`);
  if (deviceSetting.cleaningMode) common.push(`limpieza ${deviceSetting.cleaningMode}`);
  const settings = Array.isArray(deviceSetting.settings) ? deviceSetting.settings : [];
  const variants = settings.map((setting) => {
    const parts = [];
    const duration = seconds(Number(setting?.time));
    if (duration) parts.push(duration);
    if (Number(setting?.temperature) > 0) parts.push(`${setting.temperature} °C`);
    if (Number(setting?.speed) > 0) parts.push(`velocidad ${setting.speed}`);
    if (Number(setting?.weight) > 0) parts.push(`peso ${setting.weight} g`);
    return parts.join(" / ");
  }).filter(Boolean);
  return [...common, ...variants].join(" / ");
}

function deviceInstruction(deviceSetting) {
  if (!deviceSetting || typeof deviceSetting !== "object") return "";
  const mode = MODE_LABELS[deviceSetting.mode] ?? clean(deviceSetting.mode);
  const settings = Array.isArray(deviceSetting.settings) ? deviceSetting.settings : [];
  const variants = settings.map((setting) => {
    const parts = [];
    const duration = seconds(Number(setting?.time));
    if (duration) parts.push(`durante ${duration}`);
    if (Number(setting?.temperature) > 0) parts.push(`a ${setting.temperature} °C`);
    if (Number(setting?.speed) > 0) parts.push(`a velocidad ${setting.speed}`);
    if (Number(setting?.weight) > 0) parts.push(`${setting.weight} g`);
    return parts.join(", ");
  }).filter(Boolean);
  const qualifiers = [];
  if (deviceSetting.reverse) qualifiers.push("en sentido inverso");
  if (deviceSetting.turbo) qualifiers.push("con turbo");
  const prefix = deviceSetting.mode === "scale"
    ? "Pesa"
    : `Programa el robot${mode ? ` en ${mode.toLowerCase()}` : ""}`;
  return `${prefix}${variants.length ? ` ${variants.join("; ")}` : ""}${qualifiers.length ? `, ${qualifiers.join(" y ")}` : ""}.`;
}

function stepText(step) {
  const rawDescription = clean(step?.description) || clean(step?.name);
  const description = /^(mode|modo)$/i.test(rawDescription) ? "" : rawDescription;
  const parameters = deviceText(step?.deviceSetting);
  const instruction = !description && parameters ? deviceInstruction(step?.deviceSetting) : "";
  const moduleText = Array.isArray(step?.modules) && step.modules.length
    ? `Módulos: ${JSON.stringify(step.modules)}`
    : "";
  const ingredientText = Array.isArray(step?.ingredients) && step.ingredients.length
    ? `Ingredientes del paso: ${step.ingredients.map((item) => clean(item?.name) || item?.systemIngredientId).filter(Boolean).join(", ")}`
    : "";
  return [description, instruction, description && parameters && `Ajustes del robot: ${parameters}`, ingredientText, moduleText]
    .filter(Boolean)
    .join(" — ");
}

function additionalInstructions(instruction) {
  const text = clean(instruction);
  const match = text.match(/(?:^|\n)\s*(SUGERENCIAS?|VARIANTES?)\s*[:\n]/i);
  return match ? text.slice(match.index).trim() : "";
}

export function mapMonsieurCuisineRecipe(recipe, { id, diners }) {
  if (!recipe || typeof recipe !== "object") throw new Error("Detalle de receta vacío");
  const sourceId = Number(recipe.id);
  const name = clean(recipe.name);
  if (!Number.isSafeInteger(sourceId) || sourceId < 1 || !name) throw new Error("Receta sin ID o nombre");
  if (name.length > 180) throw new Error(`Receta ${sourceId} con nombre demasiado largo`);
  if (!Array.isArray(diners) || !diners.length) throw new Error("Faltan los comensales por defecto");
  const serving = chooseServing(recipe);
  if (!serving || typeof serving !== "object") throw new Error(`Receta ${sourceId} sin formato de raciones`);
  const groups = new Map((serving.ingredientGroups ?? []).map((group) => [group.id, clean(group.name)]));
  const unresolved = [];
  const sourceIngredients = Array.isArray(serving.ingredients) ? serving.ingredients : [];
  if (sourceIngredients.length > 100) throw new Error(`Receta ${sourceId} con más de 100 ingredientes`);
  const ingredients = sourceIngredients.map((ingredient) => {
    const sourceName = clean(ingredient?.name);
    const sourceIngredientId = Number(ingredient?.systemIngredientId);
    const ingredientName = sourceName || (Number.isSafeInteger(sourceIngredientId)
      ? `Ingrediente Monsieur Cuisine #${sourceIngredientId}`
      : "Ingrediente sin nombre en origen");
    if (!sourceName) unresolved.push(ingredientName);
    const originalAmount = clean(String(ingredient?.amount ?? ""));
    const group = groups.get(ingredient?.ingredientGroupId);
    const notes = [group && `Sección: ${group}`, originalAmount && quantity(originalAmount) === null && `Cantidad original: ${originalAmount}`]
      .filter(Boolean)
      .join(". ");
    return {
      name: ingredientName,
      quantity: quantity(originalAmount),
      unit: clean(ingredient?.unit).slice(0, 40),
      ...(notes ? { notes: notes.slice(0, 300) } : {}),
    };
  });
  const steps = (Array.isArray(serving.steps) ? serving.steps : [])
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
    .map(stepText)
    .filter(Boolean)
    .flatMap((step) => chunks(step, 5000));
  const extra = additionalInstructions(serving.instruction);
  if (extra) steps.push(...chunks(extra, 5000));
  if (steps.length > 100) throw new Error(`Receta ${sourceId} con más de 100 bloques de preparación`);
  const categories = (recipe.categories ?? []).map((entry) => clean(entry?.name)).filter(Boolean);
  const tags = (recipe.tags ?? []).map((entry) => clean(entry?.name ?? entry)).filter(Boolean);
  const nutrients = (Array.isArray(recipe.nutrients) ? recipe.nutrients : []).map((entry) =>
    `${clean(entry?.name)}: ${entry?.amountFloat ?? entry?.amount ?? "?"} ${clean(entry?.unit)}`.trim(),
  ).filter((entry) => !entry.startsWith(":"));
  const notes = [
    `Importada de Monsieur Cuisine (${clean(recipe.source) || "fuente no indicada"}).`,
    `Duración: ${recipe.duration ?? "?"} min; preparación: ${recipe.preparationDuration ?? "?"} min.`,
    `Ración de origen seleccionada: ${serving.amount ?? "?"} ${clean(serving.servingUnit) || "unidades"}.`,
    clean(recipe.author?.name) && `Autor: ${clean(recipe.author.name)}.`,
    Number.isFinite(recipe.rating) && `Valoración de origen: ${recipe.rating} (${recipe.totalRating ?? 0} votos).`,
    categories.length && `Categorías de origen: ${categories.join(", ")}.`,
    tags.length && `Etiquetas: ${tags.join(", ")}.`,
    nutrients.length && `Nutrientes: ${nutrients.join("; ")}.`,
    clean(recipe.description) && `Descripción: ${clean(recipe.description)}.`,
    clean(recipe.deviceTypes?.join?.(", ")) && `Dispositivos: ${recipe.deviceTypes.join(", ")}.`,
    unresolved.length && `${unresolved.length} ingrediente(s) llegaron sin nombre desde la API; se conserva su systemIngredientId para revisión manual.`,
    !ingredients.length && "La API no devolvió ingredientes para esta ración.",
    !steps.length && "La API no devolvió pasos para esta ración.",
  ].filter(Boolean).join(" ").slice(0, 5000);
  const originalIngredients = (serving.ingredients ?? []).map((ingredient) => {
    const group = groups.get(ingredient?.ingredientGroupId);
    return [group && `[${group}]`, clean(String(ingredient?.amount ?? "")), clean(ingredient?.unit), clean(ingredient?.name) || `MC#${ingredient?.systemIngredientId ?? "?"}`]
      .filter(Boolean).join(" ");
  }).join("\n").slice(0, 10000);
  const complexity = Math.max(1, Math.min(5, Number(recipe.complexityLevel) || 2));
  const servings = Number(serving.amount);
  const sourceUrl = clean(recipe.url);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new Error(`Receta ${sourceId} con URL no válida`);
  return {
    id,
    name,
    category: categoryFor(recipe),
    season: "Ambos",
    complexity,
    diners: [...diners],
    mealType: mealTypeFor(recipe),
    type: typeFor(recipe),
    review: false,
    enabled: true,
    recipeId: monsieurCuisineRecipeId(sourceId),
    recipe: {
      servings: Number.isFinite(servings) && servings > 0 ? servings : null,
      ingredients,
      steps,
      sourceUrl,
      notes,
      reviewed: false,
      ...(originalIngredients ? { originalIngredients } : {}),
    },
  };
}
