# Desarrollo de AlaMesa

Repositorio: https://github.com/danimh1991/AlaMesa

Sitio vinculado: https://mesa-de-dani-y-marta.dani-mh1991.chatgpt.site

## En este equipo (Windows)

Abre `terminal.cmd` para disponer de Node, npm y Git. Las herramientas portátiles están en `.tools/`, excluidas de Git.

Para arrancar la web, abre `iniciar-local.cmd` o ejecuta en esa terminal:

```sh
npm run dev -- --hostname 127.0.0.1
```

Abre http://127.0.0.1:5173. El acceso de desarrollo usa una cuenta simulada en http://127.0.0.1:5173/signin-with-chatgpt?return_to=/.
Los datos locales se guardan en `.wrangler/state` y son independientes de los del sitio publicado.

## Comprobaciones

```sh
npm run test
npm run typecheck
npm run build
```

## Commits

`main` sigue a `origin/main`. Para trabajar en una rama:

```sh
git switch -c codex/mi-cambio
git add .
git commit -m "Describe el cambio"
git push -u origin HEAD
```

GitHub puede pedir autenticación al hacer push. Usa tu cuenta con permisos sobre el repositorio; no guardes tokens en archivos ni en la URL del remoto.

## Publicación en Sites

`.openai/hosting.json` conserva la vinculación al sitio existente. Un commit o push a GitHub no publica automáticamente en Sites.
Pide a Codex que publique los cambios en el sitio vinculado: utilizará la habilidad Sites, compilará y publicará una versión con las credenciales temporales correspondientes, conservando su acceso actual.

## Otro equipo

Instala Git y Node.js >=22.13, clona el repositorio y ejecuta `npm run install:ci`.
En Codex, configura antes el perfil con el script `configure-execution-profile.mjs` de la habilidad Sites. Fuera de Codex, los scripts del proyecto seleccionan el perfil portátil por defecto.
Las herramientas de `.tools/` no se distribuyen con el repositorio.
