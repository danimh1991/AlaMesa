import { mapMonsieurCuisineRecipe, monsieurCuisineRecipeId } from "./mapper.mjs";

export async function importMonsieurCuisineRecipes({
  client,
  catalog,
  limit = Infinity,
  startPage = 1,
  diners,
  onProgress = () => {},
}) {
  const existing = new Set(catalog.map((dish) => dish.recipeId).filter(Boolean));
  const imported = [];
  const failures = [];
  let alreadyExisting = 0;
  let inspected = 0;
  let nextId = Math.max(0, ...catalog.map((dish) => Number(dish.id) || 0)) + 1;
  let page = startPage;
  let total = 0;
  let totalPages = startPage;
  do {
    let search;
    try {
      search = await client.getSearchPage(page, { officialOnly: true });
    } catch (error) {
      failures.push({ page, error: error instanceof Error ? error.message : String(error) });
      break;
    }
    total = search.total;
    totalPages = search.totalPage;
    for (const summary of search.recipes) {
      if (inspected >= limit) break;
      inspected += 1;
      let stableId;
      try {
        stableId = monsieurCuisineRecipeId(summary?.id);
      } catch (error) {
        failures.push({ sourceId: summary?.id, error: error instanceof Error ? error.message : String(error) });
        continue;
      }
      if (existing.has(stableId)) {
        alreadyExisting += 1;
        onProgress({ kind: "existing", sourceId: summary.id, page });
        continue;
      }
      try {
        const detail = await client.getRecipe(summary.id);
        const dish = mapMonsieurCuisineRecipe(detail, { id: nextId, diners });
        imported.push(dish);
        existing.add(dish.recipeId);
        nextId += 1;
        onProgress({ kind: "imported", sourceId: summary.id, name: dish.name, page });
      } catch (error) {
        failures.push({ sourceId: summary.id, page, error: error instanceof Error ? error.message : String(error) });
        onProgress({ kind: "failed", sourceId: summary.id, page });
      }
    }
    page += 1;
  } while (page <= totalPages && inspected < limit);
  return {
    catalog: [...catalog, ...imported],
    imported,
    failures,
    summary: { total, inspected, alreadyExisting, new: imported.length, failed: failures.length },
  };
}
