export const MONSIEUR_CUISINE_BASE_URL =
  globalThis.process?.env?.MONSIEUR_CUISINE_BASE_URL ?? "https://mc-api.tecpal.com";

export const MONSIEUR_CUISINE_LANGUAGE =
  globalThis.process?.env?.MONSIEUR_CUISINE_LANGUAGE ?? "es-ES";

export const MONSIEUR_CUISINE_TIMEOUT_MS = Number(
  globalThis.process?.env?.MONSIEUR_CUISINE_TIMEOUT_MS ?? 20_000,
);

export const MONSIEUR_CUISINE_MAX_RETRIES = Number(
  globalThis.process?.env?.MONSIEUR_CUISINE_MAX_RETRIES ?? 2,
);

// Identificador público que utiliza el cliente web oficial para obtener la
// respuesta completa (incluidos los nombres localizados de los ingredientes).
export const MONSIEUR_CUISINE_WEB_CLIENT_ID =
  "cd844315-77c4-46ba-83fe-7702d13b12b2";
