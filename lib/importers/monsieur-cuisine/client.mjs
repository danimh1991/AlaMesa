import {
  MONSIEUR_CUISINE_BASE_URL,
  MONSIEUR_CUISINE_LANGUAGE,
  MONSIEUR_CUISINE_MAX_RETRIES,
  MONSIEUR_CUISINE_TIMEOUT_MS,
  MONSIEUR_CUISINE_WEB_CLIENT_ID,
} from "./config.mjs";

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function requireObject(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`JSON inesperado en ${context}`);
  }
  return value;
}

export class MonsieurCuisineClient {
  constructor({
    baseUrl = MONSIEUR_CUISINE_BASE_URL,
    language = MONSIEUR_CUISINE_LANGUAGE,
    timeoutMs = MONSIEUR_CUISINE_TIMEOUT_MS,
    maxRetries = MONSIEUR_CUISINE_MAX_RETRIES,
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.baseUrl = baseUrl;
    this.language = language;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.fetchImpl = fetchImpl;
  }

  async request(path, searchParams) {
    const url = new URL(path, this.baseUrl);
    if (searchParams) url.search = new URLSearchParams(searchParams).toString();
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            Accept: "application/json",
            "Accept-Language": this.language,
            "device-type": "web",
            "x-bypass-cdn": MONSIEUR_CUISINE_WEB_CLIENT_ID,
            "X-Request-ID": globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${attempt}`,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} en ${url.pathname}`);
        const text = await response.text();
        if (text.length > 10_000_000) throw new Error("Respuesta demasiado grande");
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`JSON no válido en ${url.pathname}`);
        }
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) await wait(250 * 2 ** attempt);
      }
    }
    throw lastError;
  }

  async getSearchPage(page, { officialOnly = true } = {}) {
    if (!Number.isSafeInteger(page) || page < 1) throw new Error("Página no válida");
    const payload = requireObject(
      await this.request(`/api/v1/recipes/search/page/${page}`, {
        ...(officialOnly ? { "filters[source]": "official" } : {}),
      }),
      "la búsqueda",
    );
    const data = requireObject(payload.data, "data de búsqueda");
    if (
      !Array.isArray(data.recipes) ||
      !Number.isSafeInteger(data.total) ||
      !Number.isSafeInteger(data.currentPage) ||
      !Number.isSafeInteger(data.totalPage)
    ) {
      throw new Error("JSON inesperado en la paginación de Monsieur Cuisine");
    }
    return data;
  }

  async getRecipe(recipeId) {
    if (!Number.isSafeInteger(Number(recipeId)) || Number(recipeId) < 1) {
      throw new Error(`ID de receta no válido: ${recipeId}`);
    }
    const payload = requireObject(
      await this.request(`/api/v2/recipes/${recipeId}`),
      `la receta ${recipeId}`,
    );
    const data = requireObject(payload.data, `data de la receta ${recipeId}`);
    return requireObject(data.recipe, `detalle de la receta ${recipeId}`);
  }
}
