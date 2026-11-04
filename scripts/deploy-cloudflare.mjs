import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const databaseId=process.env.D1_DATABASE_ID?.trim();
if(!databaseId||databaseId==='00000000-0000-4000-8000-000000000000'){
 throw new Error('Define D1_DATABASE_ID con la base remota antes de desplegar. No se ha publicado nada.');
}

const env={...process.env,D1_DATABASE_ID:databaseId,APP_BASE_PATH:process.env.APP_BASE_PATH??'/alamesa'};
if(env.APP_BASE_PATH!=='/alamesa')throw new Error('El despliegue de producción requiere APP_BASE_PATH=/alamesa. No se ha publicado nada.');

function run(command,args){
 const result=spawnSync(command,args,{stdio:'inherit',env});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}

const npmCli=process.env.npm_execpath;
if(!npmCli)throw new Error('No se ha encontrado el ejecutable de npm. No se ha publicado nada.');
run(process.execPath,[npmCli,'run','build']);
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
const binding=config.d1_databases?.find(database=>database.binding==='DB');
if(binding?.database_id!==databaseId)throw new Error('El artefacto no apunta a la D1 solicitada. No se ha publicado nada.');

const server=readFileSync('dist/server/index.js','utf8');
if(!server.includes('/alamesa'))throw new Error('El artefacto no contiene el prefijo /alamesa. No se ha publicado nada.');

run(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--config','dist/server/wrangler.json','--name','alamesa','--keep-vars']);
