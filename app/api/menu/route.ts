import {z} from 'zod';
import {dishSchema,recipeSchema} from '../../../lib/schemas';
import {planImport,applyImport} from '../../../lib/catalog-transfer';
import {addSuggestions,acceptRecipe,suggestForDay} from '../../../lib/recipes';
import seed from '../../../lib/catalog.json';
import {readState,saveState} from '../../../lib/storage';
import {generateMenu,generateDay,menuWarnings,validateDay,monthDates,normalize,type Dish,type State} from '../../../lib/menu';
import {getChatGPTUser} from '../../chatgpt-auth';
const month=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const settings=z.object({days:z.array(z.number().int().min(0).max(6)).min(1).max(7),summerMonths:z.array(z.number().int().min(1).max(12)).max(12),repeatDays:z.number().int().min(1).max(90)});
const dish=dishSchema;
const manual=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('custom'),Dani:z.string().trim().min(1).max(240),Marta:z.string().trim().min(1).max(240)}),
 z.object({kind:z.literal('out'),note:z.string().trim().max(240).default('')}),
 z.object({kind:z.literal('empty'),note:z.string().trim().max(240).default('')})]);
const catalogFor=(state:State)=>[...seed,...(state.added??[])].map(d=>state.overrides[d.id]??d) as Dish[];
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('recipe'),id:z.number().int().positive(),recipe:recipeSchema,revision:z.number().int().min(0)}),
 z.object({action:z.literal('preview-import'),document:z.unknown(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('import-catalog'),document:z.unknown(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('accept-recipe'),recipeId:z.string(),dish:dish.omit({id:true,recipeId:true}),month:month.optional(),date:z.string().optional(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('reject-recipe'),month,date:z.string(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('generate'),month,revision:z.number().int().min(0)}),
 z.object({action:z.enum(['reroll','lock','suggest-recipe']),month,date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),revision:z.number().int().min(0)}),
 z.object({action:z.enum(['confirm','edit']),month,revision:z.number().int().min(0)}),
 z.object({action:z.literal('settings'),settings,revision:z.number().int().min(0)}),
 z.object({action:z.literal('dish'),dish,revision:z.number().int().min(0)}),
 z.object({action:z.literal('create-dish'),dish:dish.omit({id:true}),revision:z.number().int().min(0)}),
 z.object({action:z.literal('day-manual'),month,date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),manual,revision:z.number().int().min(0)})]);
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){if(!await getChatGPTUser())return json({error:'Inicia sesión para ver vuestro menú.'},401);try{const data=await readState();return json({...data,catalog:catalogFor(data.state)})}catch(e){console.error('Menu read',e);return json({error:'No se han podido cargar los menús. Inténtalo de nuevo.'},503)}}
export async function POST(request:Request){
 if(!await getChatGPTUser())return json({error:'Inicia sesión para guardar los cambios.'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen no permitido.'},403);
 let body;try{const raw=await request.text();if(new TextEncoder().encode(raw).length>1500000)return json({error:'El archivo supera el límite de 1,5 MB. Divide la importación en varios archivos.'},413);body=input.parse(JSON.parse(raw))}catch{return json({error:'Los datos enviados no son válidos.'},400)}
 try{const {state,revision}=await readState();if(revision!==body.revision)return json({error:'Hay cambios guardados desde otra pestaña. Recarga antes de continuar.'},409);
 const catalog=catalogFor(state);
 if(body.action==='preview-import'||body.action==='import-catalog'){const plan=planImport(body.document,catalog);if(body.action==='preview-import')return json({preview:plan.summary,revision});applyImport(state,plan)}
 else if(body.action==='recipe'){const original=catalog.find(d=>d.id===body.id);if(!original)return json({error:'Plato desconocido.'},404);state.overrides[body.id]={...original,recipe:body.recipe}}
 else if(body.action==='accept-recipe'){acceptRecipe(state,catalog,body);if(body.month){const m=state.menus[body.month];m.warnings=menuWarnings(m,Object.values(state.menus).filter(x=>x.month!==m.month&&x.status==='confirmed').flatMap(x=>x.days));}}
 else if(body.action==='settings'){state.settings={...body.settings,days:[...new Set(body.settings.days)].sort(),summerMonths:[...new Set(body.settings.summerMonths)].sort((a,b)=>a-b)}}
 else if(body.action==='dish'){if(!catalog.some(d=>d.id===body.dish.id))return json({error:'Plato desconocido.'},404);state.overrides[body.dish.id]={...body.dish,recipeId:catalog.find(d=>d.id===body.dish.id)?.recipeId}}
 else if(body.action==='create-dish'){if(catalog.some(d=>normalize(d.name)===normalize(body.dish.name)))return json({error:'Ya hay un plato con ese nombre. Puedes editarlo en el catálogo.'},409);const id=Math.max(...catalog.map(d=>d.id),0)+1;state.added=[...(state.added??[]),{...body.dish,id,recipeId:undefined}]}
 else {const menu=state.menus[body.month];if(body.action==='generate'){if(menu?.status==='confirmed')return json({error:'Abre el menú para editarlo antes de regenerarlo.'},409);state.menus[body.month]=addSuggestions(generateMenu(body.month,catalog,state.settings,state.menus,menu),catalog,state.menus,menu)}
 else {if(!menu)return json({error:'Este mes todavía no tiene menú.'},404);
 if(body.action==='edit')menu.status='draft';
 else {if(menu.status==='confirmed')return json({error:'El menú está confirmado. Ábrelo para editarlo.'},409);
 if(body.action==='confirm'){if(menu.days.some(d=>d.suggestion))throw new Error('Acepta o sustituye las recetas por probar antes de confirmar el mes.');if(menu.days.length!==monthDates(menu.month,menu.settings.days).length)throw new Error('El mes está incompleto.');for(const day of menu.days)validateDay({...day,meals:{Dani:day.meals.Dani.map(d=>catalog.find(x=>x.id===d.id)!),Marta:day.meals.Marta.map(d=>catalog.find(x=>x.id===d.id)!)}},menu.settings);menu.status='confirmed'}
 else if(body.action==='suggest-recipe'){suggestForDay(menu,catalog,body.date)}
 else if(body.action==='lock'){const day=menu.days.find(d=>d.date===body.date);if(!day)throw new Error('Día no encontrado.');day.locked=!day.locked}
 else if(body.action==='day-manual'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0)throw new Error('Día no encontrado.');menu.days[index]={date:body.date,locked:true,meals:{Dani:[],Marta:[]},manual:body.manual}}
 else if(body.action==='reject-recipe'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0||!menu.days[index].suggestion)throw new Error('No hay una receta por probar en ese día.');menu.days[index]=generateDay(body.date,catalog,menu.settings,[...Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days),...menu.days.filter(d=>d.date!==body.date)]);}
 else if(body.action==='reroll'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0)throw new Error('Día no encontrado.');if(menu.days[index].locked)throw new Error('Desbloquea el día para cambiarlo.');const history=[...Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days),...menu.days.filter(d=>d.date!==body.date)];menu.days[index]=generateDay(body.date,catalog,menu.settings,history,menu.days[index])}
 }menu.updatedAt=new Date().toISOString();menu.warnings=menuWarnings(menu,Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days))}}
 const next=await saveState(state,revision);return json({state,revision:next,catalog:catalogFor(state)});
 }catch(e){if(e instanceof Error&&e.message==='CONFLICT')return json({error:'Hay cambios más recientes. Recarga la página.'},409);console.error('Menu save',e);return json({error:e instanceof Error&&!/D1|SQLITE|Database/i.test(e.message)?e.message:'No se han guardado los cambios. Inténtalo de nuevo.'},400)}
}
