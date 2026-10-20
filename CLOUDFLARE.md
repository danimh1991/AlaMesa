# Estado actual: acceso sin inicio de sesión

La interfaz de menús conserva su comportamiento actual. La API REST de recetas permite lectura pública, pero exige un Bearer token para `POST`, `PUT` y `DELETE`. Si activaste Cloudflare Access, recuerda que esa protección externa se aplica antes de que el Worker pueda validar el token.

Compila para este dominio con `APP_BASE_PATH=/alamesa` y el `D1_DATABASE_ID` remoto antes de ejecutar `npm run build`; después usa `npm run deploy:cloudflare`. En Sites, sus permisos de plataforma siguen aplicándose.

Las instrucciones siguientes se conservan como referencia para una futura reactivación; antes habrá que restaurar las comprobaciones de sesión en las API.

# Cloudflare y Sites

La misma aplicación admite Sites (sesión de ChatGPT), desarrollo local (sesión simulada) y Cloudflare independiente (Cloudflare Access con código por correo).

## Activar el acceso en Cloudflare

1. En Workers & Pages, abre el Worker `alamesa` y activa Cloudflare Access para su dominio de producción `alamesa.dani-mh1991.workers.dev`. Protege todo el dominio, incluidas `/api/*`. Si usas otros dominios o previews, protégelos también o desactívalos.
2. En Cloudflare Zero Trust / Access / Applications, edita la aplicación creada. Crea una política **Allow**, selector **Emails**, con exclusivamente el correo que quieras autorizar. Para esta instalación utiliza el correo indicado en la conversación. No uses políticas Bypass ni Everyone. Todos los autorizados comparten el mismo hogar y sus menús.
3. Habilita **One-time PIN** como método de acceso. Cloudflare enviará el código al correo permitido; la aplicación no guarda contraseñas.
4. Copia el dominio de tu equipo (`https://TU-EQUIPO.cloudflareaccess.com`) y el **Application Audience (AUD) Tag** de esa aplicación.
5. En el Worker, Settings / Variables and Secrets, configura estas variables de ejecución (no solo de compilación):

| Variable | Valor |
| --- | --- |
| `AUTH_PROVIDER` | `cloudflare-access` |
| `CF_ACCESS_TEAM_DOMAIN` | `https://TU-EQUIPO.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | El AUD real de la aplicación de Access |

No uses el ID de cuenta ni el de D1 como AUD. No hacen falta claves privadas ni contraseñas en Git. Las variables no llevan prefijo `NEXT_PUBLIC_`.

## Compilar y desplegar

Conserva `D1_DATABASE_ID` en las variables de compilación con el identificador real de tu base D1. El binding de ejecución debe llamarse `DB`.

```sh
npm run install:ci
npm test
npm run typecheck
npm run build
npm run deploy:cloudflare
```

En Workers Builds, usa `npm run build` como comando de compilación y `npm run deploy:cloudflare` como comando de despliegue. El comando publica en el Worker existente `alamesa` y conserva las variables del panel. Si renombras el Worker, cambia el argumento `--name`.

Si D1 es nuevo, aplica `drizzle/0000_household.sql` y después `drizzle/0002_normalized_state.sql`. Para actualizar una instalación antigua, crea primero una exportación de D1 y aplica únicamente `0002_normalized_state.sql`; conserva `household` como copia de transición. No ejecutes `0001_reset_planning.sql` en una base con menús: es un borrado histórico de planificación. La API de recetas reutiliza `dish_changes`, por lo que no requiere una migración adicional. La base de Cloudflare es independiente de la de Sites y de la local.

## API REST de recetas

La especificación OpenAPI 3.1 se publica en `/alamesa/openapi.yaml`. Las rutas son:

- `GET /alamesa/api/recipes` y `GET /alamesa/api/recipes/:id` (públicas).
- `POST /alamesa/api/recipes`, `PUT /alamesa/api/recipes/:id` y `DELETE /alamesa/api/recipes/:id` (Bearer token obligatorio).

Genera un token largo y aleatorio fuera del repositorio y guárdalo como secreto del Worker ya compilado:

```sh
npx wrangler secret put RECIPE_API_TOKEN --config dist/server/wrangler.json --name alamesa
```

No uses una variable `NEXT_PUBLIC_*` ni incluyas el valor en el frontend. Para habilitar CORS a un cliente web concreto, configura `RECIPE_API_ALLOWED_ORIGINS` como una lista de orígenes exactos separados por comas; las peticiones del mismo origen y los clientes servidor-a-servidor sin cabecera `Origin` ya funcionan. No uses `*`.

Ejemplo de alta:

```sh
curl -X POST 'https://danieta.com/alamesa/api/recipes' \
  -H "Authorization: Bearer $RECIPE_API_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @examples/pollo-horno-manzana-cebolla.json
```

El script `examples/create-test-recipe.ps1` comprueba primero el `recipeId` estable y solo crea la receta de prueba si no existe. Esto hace que la operación manual sea idempotente. No se ejecuta contra producción durante el desarrollo.

```powershell
$env:RECIPE_API_TOKEN = Read-Host 'Token'
./examples/create-test-recipe.ps1
```

Una creación correcta devuelve `201` y conserva ambos identificadores:

```json
{
  "recipe": {
    "id": 291,
    "recipeId": "api-pollo-horno-manzana-cebolla",
    "name": "Pollo al horno con manzana y cebolla",
    "recipe": {"servings": 2, "ingredients": [], "steps": []}
  }
}
```

`id` es el identificador numérico del plato dentro del catálogo; `recipeId` es la identidad estable de la receta y `recipe` contiene sus raciones, ingredientes y pasos. El ejemplo abreviado anterior omite campos obligatorios solo para mostrar la forma de la respuesta; el JSON completo está en `examples/pollo-horno-manzana-cebolla.json`.

El modelo actual no tiene un campo `person`: la evolución ya aplicada en el repositorio lo sustituyó por `diners` (identificadores de comensales) y `mealType`. La API usa esos nombres canónicos y valida que cada categoría y comensal exista en las Preferencias guardadas.

Para conectarla a ChatGPT mediante una GPT Action, despliega primero la API y comprueba todos los métodos. Después importa `https://danieta.com/alamesa/openapi.yaml` en la sección de acciones, selecciona autenticación `API Key` de tipo `Bearer`, guarda allí el mismo token del secreto del Worker y prueba cada operación desde la vista previa. No pegues el token dentro del esquema ni de las instrucciones. La [guía oficial de GPT Actions](https://developers.openai.com/api/docs/actions/getting-started) recomienda describir la API con OpenAPI, configurar la autenticación y probar cada acción. Esta integración no necesita un servidor MCP.

## Comprobar

Abre el dominio de Cloudflare en una ventana privada: debe aparecer Access antes de la aplicación. Tras recibir e introducir el código por correo, el catálogo y los menús deben cargar. Un correo no permitido debe quedar bloqueado. Una petición sin sesión a `/api/menu` no debe devolver datos.

El botón de acceso usa `/auth/signin`: en Sites conduce al acceso de ChatGPT; en Cloudflare comprueba la sesión de Access. Si falta configuración, muestra un mensaje en lugar del anterior 404. El cierre de sesión está en `/auth/signout`.

En Cloudflare se comprueban la firma, caducidad, emisor y audiencia del JWT. Las cabeceras `oai-authenticated-user-*` no sirven para entrar en este modo. No actives `AUTH_PROVIDER=sites` en un Worker independiente.

En Sites no añadas estas variables de Cloudflare: conserva `.openai/hosting.json` y el flujo de publicación existente. En local `npm run dev` mantiene la sesión simulada habitual.

Referencias oficiales:
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
