import {normalize,type Dish} from './menu';
import type {Recipe} from './recipes';

export const PROVIDER_URL='https://huggingface.co/datasets/somosnlp/RecetasDeLaAbuela';
type Row={row_idx:number;row:Record<string,unknown>;truncated_cells?:unknown[]};
type Page={rows:Row[];num_rows_total:number};
const API='https://datasets-server.huggingface.co/';
export async function providerPage(route:'rows'|'search',params:Record<string,string>):Promise<Page>{
 const url=new URL(route,API);url.search=new URLSearchParams({dataset:'somosnlp/RecetasDeLaAbuela',config:'version_1',split:'train',...params}).toString();
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`Provider HTTP ${response.status}`);
  const text=await response.text();if(text.length>3000000)throw new Error('Provider response too large');
  const data=JSON.parse(text);if(!Array.isArray(data.rows)||!Number.isSafeInteger(data.num_rows_total))throw new Error('Invalid provider response');
  return data;
 }catch(e){console.error('Recipe provider',e instanceof Error?e.message:'Unavailable');throw new Error('Recetas de la Abuela no responde ahora. Conservamos vuestra selección; vuelve a intentarlo en unos instantes.');}
}
function safeUrl(value:unknown){try{const u=new URL(String(value));return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}}
function text(value:unknown){return typeof value==='string'?value.replace(/<[^>]*>/g,'').trim():''}
function chunks(value:string,max:number){const result:string[]=[];for(let i=0;i<value.length;i+=max)result.push(value.slice(i,i+max));return result;}
// Some sources store lists as Python literals inside a CSV string. Parse quoted
// items without evaluating code; keep commas inside an ingredient intact.
export function sourceList(value:string):string[]{
 if(value.startsWith('[')&&value.endsWith(']')){
  try{const parsed=JSON.parse(value);if(Array.isArray(parsed)&&parsed.every(x=>typeof x==='string'))return parsed.map(text).filter(Boolean)}catch{}
  const items=[...value.matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g)].map(m=>(m[1]??m[2]).replace(/\\n/g,'\n').replace(/\\(['"\\])/g,'$1').trim()).filter(Boolean);
  if(items.length)return items;
 }
 return [];
}
export function fromProvider(entry:Row):Recipe|null{
 const r=entry.row,id=Number(r.Id),name=text(r.Nombre),ingredients=text(r.Ingredientes),steps=text(r.Pasos),source=safeUrl(r.URL);
 if(!Number.isSafeInteger(id)||id<1||!name||name.length>180||!ingredients||!steps||!source||entry.truncated_cells?.length||ingredients.length>8000||steps.length>18000)return null;
 const n=normalize(name),group=normalize(text(r.Categoria));
 // This planner serves lunches, not desserts, beverages or condiments on their own.
 if(/postre|reposteria|pasteleria|bebida|coctel/.test(group)||/\b(bizcocho|tarta|galletas?|helado|batido|zumo|flan|natillas|mousse|brownie|cupcake|magdalena|chocolate|cacao|cake|sorbete|granizado|alfajor|alfajores|panna cotta|pancakes?|panqueques?|postres?|dulces?|chocotorta)\b/.test(n)||/^(mermelada|salsa |mayonesa|pan |masa |tortitas|crema pastelera|crema de pistacho)/.test(n))return null;
 const category=/pasta|espaguet|macarron|fusilli|noquis|raviol|tallarin|noodle|canelon|lasana|pizza/.test(n)?'Pasta':/arroz|paella|risotto/.test(n)?'Arroz':/pollo|pavo|gallina/.test(n)?'Pollo':/merluza|salmon|atun|bacalao|pescado|sardina|gamba|langostino|marisco|calamar|pulpo|dorada|lubina/.test(n)?'Pescado':/ternera|cerdo|cordero|carne|costilla|solomillo|chorizo|jamon/.test(n)?'Carne':/lenteja|garbanzo|alubia|frijol|judia|habas/.test(n)?'Legumbres':/arroz|paella|risotto/.test(n)?'Arroz':/pasta|espaguet|macarron|lasa[nñ]a|canelon|tallarin|fideo/.test(n)?'Pasta':/huevo|tortilla|revuelto/.test(n)?'Huevos':'Verduras';
 const type=/sopa|caldo |crema |ensalada|gazpacho|salmorejo/.test(n)?'Entrante':/arroz|pasta|paella|risotto|noodle|fideo|macarron|espaguet|spaghetti|fusilli|noquis|raviol|lasa[nñ]a|canelon|tallarin|tortilla|pizza/.test(n)?'Único':['Carne','Pollo','Pescado'].includes(category)?'Principal':'Único';
 const servingsMatch=text(r.Comensales).match(/^\s*(\d{1,3})(?:\s*(?:personas?|raciones?|comensales?))?\s*$/i);
 const servings=servingsMatch&&Number(servingsMatch[1])>0?Number(servingsMatch[1]):null;
 const difficulty=normalize(text(r.Dificultad));
 // Preserve the source text and quantities; do not invent conversions or servings.
 const ingredientItems=sourceList(ingredients),stepItems=sourceList(steps);
 return {id:`abuela-${id}`,rowIndex:entry.row_idx,name,originalName:name,category,type,season:'Ambos',complexity:/dificil|alta/.test(difficulty)?4:/media/.test(difficulty)?3:2,ingredients:(ingredientItems.length?ingredientItems:ingredients.split(/\n|;|,(?!\d)/)).map(s=>s.trim()).filter(Boolean).flatMap(s=>chunks(s,240)).slice(0,100),steps:(stepItems.length?stepItems:steps.split(/\n+/)).filter(Boolean).flatMap(s=>chunks(s,5000)),notes:'Clasificación orientativa. Revisa raciones y cantidades antes de añadir los ingredientes a la compra.',source,providerUrl:PROVIDER_URL,provider:'Recetas de la Abuela',servings,originalIngredients:ingredientItems.length?ingredientItems.join('\n'):ingredients};
}
export async function lookupRecipe(id:string,rowIndex:number){
 const page=await providerPage('rows',{offset:String(rowIndex),length:'1'});
 const recipe=page.rows[0]&&fromProvider(page.rows[0]);if(!recipe||recipe.id!==id)throw new Error('La receta ha cambiado en el origen. Búscala de nuevo antes de confirmarla.');return recipe;
}
export async function refreshRecipes(previous:Recipe[],catalog:Dish[]):Promise<Recipe[]>{
 const meta=await providerPage('rows',{offset:'0',length:'1'}),total=meta.num_rows_total;
 if(total<50)throw new Error('El catálogo no tiene suficientes recetas disponibles. Conservamos la selección anterior.');
 const excludedIds=new Set([...previous.map(r=>r.id),...catalog.flatMap(d=>d.recipeId?[d.recipeId]:[])]);
 const names=new Set([...catalog.map(d=>normalize(d.name)),...previous.map(d=>normalize(d.name))]);
 const recipes:Recipe[]=[];const visited=new Set<number>();
 for(let round=0;round<3&&recipes.length<50;round++){
  const offsets=Array.from({length:4},()=>{let offset;do{offset=Math.floor(Math.random()*Math.max(1,total-100))}while(visited.has(offset));visited.add(offset);return offset});
  const pages=await Promise.all(offsets.map(offset=>providerPage('rows',{offset:String(offset),length:'100'})));
  const candidates=pages.flatMap(p=>p.rows).map(fromProvider).filter((r):r is Recipe=>r!==null);
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
  for(const recipe of candidates){if(excludedIds.has(recipe.id)||names.has(normalize(recipe.name)))continue;recipes.push(recipe);excludedIds.add(recipe.id);names.add(normalize(recipe.name));if(recipes.length===50)break;}
 }
 if(recipes.length!==50)throw new Error('No se han encontrado 50 ideas diferentes. Conservamos la selección anterior; inténtalo de nuevo.');
 return recipes;
}
const searchCache=new Map<string,{until:number;result:{recipes:Recipe[];total:number;nextOffset:number|null}}>();
export async function searchRecipes(query:string,offset:number){
 query=normalize(query).replace(/\s+/g,' ');
 const key=`${query}:${offset}`,cached=searchCache.get(key);if(cached&&cached.until>Date.now())return cached.result;
 const page=await providerPage('search',{query,offset:String(offset),length:'30'});
 const recipes=page.rows.map(fromProvider).filter((r):r is Recipe=>r!==null);
 const unique=[...new Map(recipes.map(r=>[normalize(r.name),r])).values()];
 const result={recipes:unique,total:page.num_rows_total,nextOffset:page.rows.length&&offset+page.rows.length<page.num_rows_total?offset+page.rows.length:null};
 if(searchCache.size>=12)searchCache.delete(searchCache.keys().next().value!);
 searchCache.set(key,{until:Date.now()+300000,result});return result;
}
