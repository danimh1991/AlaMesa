import fs from 'node:fs';

const endpoint='https://datasets-server.huggingface.co/rows';
const common={dataset:'somosnlp/RecetasDeLaAbuela',config:'version_1',split:'train'};
async function page(offset,length=100){
 const url=new URL(endpoint);url.search=new URLSearchParams({...common,offset:String(offset),length:String(length)});
 for(let attempt=1;attempt<=3;attempt++)try{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(response.ok)return await response.json()}catch{}
 throw new Error(`No se pudo leer el bloque ${offset}.`);
}
const first=await page(0,1),offsets=Array.from({length:Math.ceil(first.num_rows_total/100)},(_,i)=>i*100),rows=[];
for(let start=0;start<offsets.length;start+=12){const batch=await Promise.all(offsets.slice(start,start+12).map(offset=>page(offset)));rows.push(...batch.flatMap(result=>result.rows));}
const normalize=value=>String(value??'').replace(/<[^>]*>/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const index=rows.map(entry=>[entry.row_idx,[...new Set(normalize(`${entry.row.Nombre} ${entry.row.Ingredientes}`).match(/[a-z]{2,}/g)??[])].join(' ')]).filter(([,text])=>text);
const directory=new URL('../lib/recipe-search-index/',import.meta.url);fs.rmSync(directory,{recursive:true,force:true});fs.mkdirSync(directory,{recursive:true});const imports=[];
for(let start=0;start<index.length;start+=800){const suffix=String(imports.length).padStart(2,'0'),name=`part-${suffix}.json`;fs.writeFileSync(new URL(name,directory),JSON.stringify(index.slice(start,start+800)));imports.push(`import p${suffix} from './recipe-search-index/${name}';`)}
fs.writeFileSync(new URL('../lib/recipe-search-index.ts',import.meta.url),`${imports.join('\n')}\nexport default [${imports.map((_,i)=>`...p${String(i).padStart(2,'0')}`).join(',')}] as [number,string][];\n`);
console.log(`Índice actualizado: ${index.length} recetas.`);
