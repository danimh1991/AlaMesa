import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { MonsieurCuisineClient } from "../lib/importers/monsieur-cuisine/client.mjs";
import { importMonsieurCuisineRecipes } from "../lib/importers/monsieur-cuisine/importer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return `Uso: npm run import:monsieur-cuisine -- [opciones]

Opciones:
  --limit <n>       Inspecciona como máximo n recetas
  --page <n>        Empieza en esta página (por defecto: 1)
  --dry-run         Consulta y normaliza sin modificar el catálogo
  --catalog <ruta>  Catálogo JSON de destino (por defecto: lib/catalog.json)
  --help            Muestra esta ayuda`;
}

function parseArguments(argv) {
  const options = {
    limit: Infinity,
    startPage: 1,
    dryRun: false,
    catalogPath: path.join(root, "lib", "catalog.json"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--help") options.help = true;
    else if (["--limit", "--page", "--catalog"].includes(argument)) {
      const value = argv[++index];
      if (!value) throw new Error(`Falta el valor de ${argument}`);
      if (argument === "--catalog") options.catalogPath = path.resolve(value);
      else {
        const number = Number(value);
        if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${argument} debe ser un entero positivo`);
        if (argument === "--limit") options.limit = number;
        else options.startPage = number;
      }
    } else throw new Error(`Opción desconocida: ${argument}`);
  }
  return options;
}

async function readCatalog(catalogPath) {
  const parsed = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("El catálogo debe ser un array JSON");
  return parsed;
}

async function writeCatalog(catalogPath, catalog) {
  const temporaryPath = `${catalogPath}.monsieur-cuisine.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(catalog)}\n`, "utf8");
  await fs.rename(temporaryPath, catalogPath);
}

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }
  const catalog = await readCatalog(options.catalogPath);
  const diners = [...new Set(catalog.flatMap((dish) => Array.isArray(dish.diners) ? dish.diners : []))];
  if (!diners.length) throw new Error("El catálogo no contiene comensales por defecto");
  console.log(`Catálogo: ${options.catalogPath}`);
  console.log(`Modo: ${options.dryRun ? "simulación" : "escritura"}; comensales: ${diners.join(", ")}`);
  const result = await importMonsieurCuisineRecipes({
    client: new MonsieurCuisineClient(),
    catalog,
    limit: options.limit,
    startPage: options.startPage,
    diners,
    onProgress(event) {
      if (event.kind === "imported") console.log(`  + ${event.sourceId}: ${event.name}`);
      else if (event.kind === "failed") console.error(`  ! Falló ${event.sourceId} (página ${event.page})`);
    },
  });
  if (!options.dryRun && result.imported.length) await writeCatalog(options.catalogPath, result.catalog);
  console.log(JSON.stringify(result.summary, null, 2));
  if (options.dryRun && result.imported.length) {
    console.log("Muestra normalizada:");
    console.log(JSON.stringify(result.imported.slice(0, 5), null, 2));
  }
  if (result.failures.length) {
    console.error("Fallos:");
    for (const failure of result.failures) console.error(`  ${JSON.stringify(failure)}`);
  }
  if (result.failures.length && !result.imported.length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(usage());
  process.exitCode = 1;
}
