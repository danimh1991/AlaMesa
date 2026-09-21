# Estado actual: acceso sin inicio de sesión

La aplicación permite consultar y modificar los datos sin autenticación. Si activaste Cloudflare Access, desactívalo para este Worker en el panel; el código no puede saltarse esa protección externa. Las variables de Access ya no son necesarias para usar los menús.

Compila y vuelve a desplegar con `npm run build` y `npm run deploy:cloudflare`. En Sites, sus permisos de plataforma siguen aplicándose.

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

Si D1 es nuevo, crea la tabla ejecutando el SQL de `drizzle/0000_household.sql` una sola vez en esa base. No ejecutes `0001_reset_planning.sql` en una base con menús: es un borrado histórico de planificación, no necesario para habilitar el acceso. La base de Cloudflare es independiente de la de Sites y de la local.

## Comprobar

Abre el dominio de Cloudflare en una ventana privada: debe aparecer Access antes de la aplicación. Tras recibir e introducir el código por correo, el catálogo y los menús deben cargar. Un correo no permitido debe quedar bloqueado. Una petición sin sesión a `/api/menu` no debe devolver datos.

El botón de acceso usa `/auth/signin`: en Sites conduce al acceso de ChatGPT; en Cloudflare comprueba la sesión de Access. Si falta configuración, muestra un mensaje en lugar del anterior 404. El cierre de sesión está en `/auth/signout`.

En Cloudflare se comprueban la firma, caducidad, emisor y audiencia del JWT. Las cabeceras `oai-authenticated-user-*` no sirven para entrar en este modo. No actives `AUTH_PROVIDER=sites` en un Worker independiente.

En Sites no añadas estas variables de Cloudflare: conserva `.openai/hosting.json` y el flujo de publicación existente. En local `npm run dev` mantiene la sesión simulada habitual.

Referencias oficiales:
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
