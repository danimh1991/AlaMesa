import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { MonsieurCuisineClient } from "../lib/importers/monsieur-cuisine/client.mjs";
import { mapMonsieurCuisineRecipe, monsieurCuisineRecipeId } from "../lib/importers/monsieur-cuisine/mapper.mjs";
import { importMonsieurCuisineRecipes } from "../lib/importers/monsieur-cuisine/importer.mjs";

const fixture = JSON.parse(
  await fs.readFile(new URL("../tests/fixtures/monsieur-cuisine-recipe.json", import.meta.url), "utf8"),
);

assert.equal(monsieurCuisineRecipeId(453695), "monsieur-cuisine-453695");
assert.throws(() => monsieurCuisineRecipeId("no-id"), /ID original/);

const mapped = mapMonsieurCuisineRecipe(fixture, { id: 408, diners: ["Dani", "Marta"] });
assert.equal(mapped.recipeId, "monsieur-cuisine-453695");
assert.equal(mapped.review, false);
assert.equal(mapped.recipe.reviewed, false);
assert.equal(mapped.recipe.servings, 4);
assert.deepEqual(mapped.recipe.ingredients[0], {
  name: "huevos medianos",
  quantity: 4,
  unit: "unidades",
  notes: "Sección: PARA 4 HUEVOS",
});
assert.match(mapped.recipe.steps[1], /9 min/);
assert.match(mapped.recipe.steps[1], /120 °C/);
assert.match(mapped.recipe.steps[1], /velocidad 1/);
assert.doesNotMatch(mapped.recipe.steps[1], /\bMode\b/);
assert.match(mapped.recipe.steps[1], /Programa el robot/);
assert.match(mapped.recipe.steps[2], /SUGERENCIA/);
const specialModes = mapMonsieurCuisineRecipe({
  ...fixture,
  servingSizes: [{
    ...fixture.servingSizes[0],
    steps: [{
      ...fixture.servingSizes[0].steps[1],
      deviceSetting: { ...fixture.servingSizes[0].steps[1].deviceSetting, reverse: true, turbo: true, mode: "kneading" },
    }],
  }],
}, { id: 409, diners: ["Dani", "Marta"] });
assert.match(specialModes.recipe.steps[0], /sentido inverso/);
assert.match(specialModes.recipe.steps[0], /turbo/);
assert.match(specialModes.recipe.steps[0], /amasado/i);

let requestHeaders;
const headerClient = new MonsieurCuisineClient({
  maxRetries: 0,
  fetchImpl: async (_url, options) => {
    requestHeaders = options.headers;
    return new Response(JSON.stringify({ data: { recipe: fixture } }));
  },
});
await headerClient.getRecipe(453695);
assert.equal(requestHeaders["device-type"], "web");
assert.equal(requestHeaders["x-bypass-cdn"], "cd844315-77c4-46ba-83fe-7702d13b12b2");
assert.match(requestHeaders["X-Request-ID"], /.+/);

let detailCalls = 0;
const fakeClient = {
  async getSearchPage() {
    return {
      total: 2,
      currentPage: 1,
      totalPage: 1,
      recipes: [{ id: 453695 }, { id: 999999 }],
    };
  },
  async getRecipe(id) {
    detailCalls += 1;
    return { ...fixture, id, name: "Receta incremental" };
  },
};
const existing = [{ ...mapped, id: 408 }];
const incremental = await importMonsieurCuisineRecipes({
  client: fakeClient,
  catalog: existing,
  diners: ["Dani", "Marta"],
});
assert.equal(detailCalls, 1);
assert.equal(incremental.summary.alreadyExisting, 1);
assert.equal(incremental.summary.new, 1);
assert.equal(incremental.imported[0].recipeId, "monsieur-cuisine-999999");
assert.equal(incremental.imported[0].id, 409);

console.log("PASS: mapeo, recipeId, ingredientes, pasos e importación incremental de Monsieur Cuisine.");
