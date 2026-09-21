import {refreshRecipes,lookupRecipe} from '../../../lib/recipe-provider';
import {basket,addProduct,includeMenu} from '../../../lib/shopping-store';
import {z} from 'zod';
import {dishSchema,recipeSchema} from '../../../lib/schemas';
import {planImport,applyImport} from '../../../lib/catalog-transfer';
import {addSuggestions,acceptRecipe,suggestForDay,poolFor,resolveRecipe,editPerson} from '../../../lib/recipes';
import seed from '../../../lib/catalog.json';
import {readState,saveState} from '../../../lib/storage';
import {generateMenu,generateDay,menuWarnings,validateDay,monthDates,normalize,normalizeDish,peopleFor,emptyMeals,selectedMealTypes,mealsFor,setMealsFor,validateDay as validateManual,type Dish,type State} from '../../../lib/menu';
import {getChatGPTUser} from '../../chatgpt-auth';
const month=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const diners=z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).refine(v=>!['Ambos','__proto__','constructor','prototype'].includes(v)),name:z.string().trim().min(1).max(40)})).min(1).max(12).refine(ds=>new Set(ds.map(d=>d.id)).size===ds.length&&new Set(ds.map(d=>normalize(d.name))).size===ds.length,'Los nombres no pueden repetirse.');
const settings=z.object({diners:diners.optional(),days:z.array(z.number().int().min(0).max(6)).min(1).max(7),summerMonths:z.array(z.number().int().min(1).max(12)).max(12),repeatDays:z.number().int().min(1).max(90),mealTypes:z.array(z.enum(['Desayuno','Comida','Merienda','Cena'])).min(1).max(4)});
const dish=dishSchema;
const manual=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('custom'),entries:z.record(z.string().trim().min(1).max(240)).optional(),Dani:z.string().trim().min(1).max(240).optional(),Marta:z.string().trim().min(1).max(240).optional()}),
 z.object({kind:z.literal('out'),note:z.string().trim().max(240).default('')}),
 z.object({kind:z.literal('empty'),note:z.string().trim().max(240).default('')})]);
const catalogFor=(state:State)=>[...seed,...(state.added??[])].map(d=>normalizeDish(state.overrides[d.id]??d)) as Dish[];
const product=z.object({name:z.string().trim().min(1).max(240),quantity:z.number().positive().max(1000000).nullable(),unit:z.string().trim().max(40)});
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('refresh-recipes'),revision:z.number().int().min(0)}),
 z.object({action:z.literal('person-day'),month,date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),person:z.string().min(1).max(80),mode:z.enum(['out','tupper','custom','generate','suggest']),note:z.string().trim().max(240).optional(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('shopping-check-all'),revision:z.number().int().min(0)}),
 z.object({action:z.literal('shopping-clear-checked'),revision:z.number().int().min(0)}),
 z.object({action:z.literal('shopping-add'),product,revision:z.number().int().min(0)}),
 z.object({action:z.literal('shopping-update'),id:z.string(),product,revision:z.number().int().min(0)}),
 z.object({action:z.literal('shopping-check'),id:z.string(),checked:z.boolean(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('shopping-remove'),id:z.string(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('shopping-include'),month,from:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),to:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),revision:z.number().int().min(0)}),
 z.object({action:z.literal('recipe'),id:z.number().int().positive(),recipe:recipeSchema,revision:z.number().int().min(0)}),
 z.object({action:z.literal('preview-import'),document:z.unknown(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('import-catalog'),document:z.unknown(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('accept-recipe'),recipeId:z.string().regex(/^abuela-\d+$/),rowIndex:z.number().int().min(0).max(1000000).optional(),schedule:z.boolean().optional(),replaceLocked:z.boolean().optional(),targetPerson:z.string().max(80).optional(),dish:dish.omit({id:true,recipeId:true}),month:month.optional(),date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).optional(),revision:z.number().int().min(0)}),
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
 if(['dish','create-dish','accept-recipe'].includes(body.action)&&'dish' in body){const active=peopleFor(body.action==='accept-recipe'&&body.month?state.menus[body.month]?.settings??state.settings:state.settings);if(body.dish.diners.some(p=>!active.includes(p))){const existing='id' in body.dish?catalog.find(d=>d.id===(body.dish as Partial<Dish>).id):undefined;if(!existing||body.dish.diners.some(p=>!existing.diners.includes(p)))throw new Error('Selecciona comensales de Preferencias.');}}
 if(body.action==='refresh-recipes'){state.discovery={recipes:await refreshRecipes(poolFor(state),catalog),updatedAt:new Date().toISOString()}}
 else if(body.action==='shopping-check-all'){for(const item of basket(state).items)item.checked=true}
 else if(body.action==='shopping-clear-checked'){const store=basket(state);store.items=store.items.filter(i=>!i.checked)}
 else if(body.action==='shopping-add'){addProduct(state,body.product)}
 else if(body.action==='shopping-update'||body.action==='shopping-check'||body.action==='shopping-remove'){const store=basket(state),item=store.items.find(i=>i.id===body.id);if(!item)throw new Error('Producto no encontrado.');if(body.action==='shopping-remove')store.items=store.items.filter(i=>i.id!==body.id);else if(body.action==='shopping-check')item.checked=body.checked;else Object.assign(item,body.product)}
 else if(body.action==='shopping-include'){const menu=state.menus[body.month];if(!menu||body.from>body.to||!body.from.startsWith(body.month)||!body.to.startsWith(body.month))throw new Error('Periodo no válido.');includeMenu(state,menu,catalog,body.from,body.to)}
 else if(body.action==='preview-import'||body.action==='import-catalog'){const plan=planImport(body.document,catalog);if(body.action==='preview-import')return json({preview:plan.summary,revision});applyImport(state,plan)}
 else if(body.action==='recipe'){const original=catalog.find(d=>d.id===body.id);if(!original)return json({error:'Plato desconocido.'},404);state.overrides[body.id]={...original,recipe:body.recipe}}
 else if(body.action==='accept-recipe'){const recipe=resolveRecipe(state,body.recipeId)??(body.rowIndex!==undefined?await lookupRecipe(body.recipeId,body.rowIndex):undefined);if(!recipe)throw new Error('Vuelve a buscar la receta antes de confirmarla.');acceptRecipe(state,catalog,body,recipe);if(body.month){const m=state.menus[body.month];m.warnings=menuWarnings(m,Object.values(state.menus).filter(x=>x.month!==m.month&&x.status==='confirmed').flatMap(x=>x.days));}}
 else if(body.action==='settings'){state.settings={...body.settings,diners:body.settings.diners??state.settings.diners,days:[...new Set(body.settings.days)].sort(),summerMonths:[...new Set(body.settings.summerMonths)].sort((a,b)=>a-b),mealTypes:[...new Set(body.settings.mealTypes)]}}
 else if(body.action==='dish'){if(!catalog.some(d=>d.id===body.dish.id))return json({error:'Plato desconocido.'},404);state.overrides[body.dish.id]={...body.dish,recipeId:catalog.find(d=>d.id===body.dish.id)?.recipeId}}
 else if(body.action==='create-dish'){if(catalog.some(d=>normalize(d.name)===normalize(body.dish.name)))return json({error:'Ya hay un plato con ese nombre. Puedes editarlo en el catálogo.'},409);const id=Math.max(...catalog.map(d=>d.id),0)+1;state.added=[...(state.added??[]),{...body.dish,id,recipeId:undefined}]}
 else {const menu=state.menus[body.month];if(body.action==='generate'){if(menu?.status==='confirmed')return json({error:'Abre el menú para editarlo antes de regenerarlo.'},409);if(!state.discovery)state.discovery={recipes:await refreshRecipes([],catalog),updatedAt:new Date().toISOString()};state.menus[body.month]=addSuggestions(generateMenu(body.month,catalog,state.settings,state.menus,menu),catalog,state.menus,menu,poolFor(state))}
 else {if(!menu)return json({error:'Este mes todavía no tiene menú.'},404);
 if(body.action==='edit')menu.status='draft';
 else {if(menu.status==='confirmed')return json({error:'El menú está confirmado. Ábrelo para editarlo.'},409);
 if(body.action==='confirm'){if(menu.days.some(d=>d.suggestion||Object.values(d.personal??{}).some(p=>p.kind==='suggestion')))throw new Error('Acepta o sustituye las recetas por probar antes de confirmar el mes.');if(menu.days.length!==monthDates(menu.month,menu.settings.days).length)throw new Error('El mes está incompleto.');for(const day of menu.days){const checked=structuredClone(day);for(const type of selectedMealTypes(menu.settings))setMealsFor(checked,type,Object.fromEntries(peopleFor(menu.settings).map(p=>[p,(mealsFor(day,type)[p]??[]).map(d=>catalog.find(x=>x.id===d.id)!)])));validateDay(checked,menu.settings)}menu.status='confirmed';includeMenu(state,menu,catalog)}
 else if(body.action==='suggest-recipe'){suggestForDay(menu,catalog,body.date,poolFor(state))}
 else if(body.action==='person-day'){editPerson(menu,catalog,state.menus,body,poolFor(state))}
 else if(body.action==='lock'){const day=menu.days.find(d=>d.date===body.date);if(!day)throw new Error('Día no encontrado.');day.locked=!day.locked}
 else if(body.action==='day-manual'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0)throw new Error('Día no encontrado.');menu.days[index]={date:body.date,locked:true,meals:emptyMeals(menu.settings),mealsByType:{},manual:body.manual};validateManual(menu.days[index],menu.settings)}
 else if(body.action==='reject-recipe'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0||!menu.days[index].suggestion)throw new Error('No hay una receta por probar en ese día.');const history=[...Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days),...menu.days.filter(d=>d.date!==body.date)],replacement=structuredClone(menu.days[index]),food=generateDay(body.date,catalog,{...menu.settings,mealTypes:['Comida']},history,replacement);setMealsFor(replacement,'Comida',mealsFor(food,'Comida'));delete replacement.suggestion;delete replacement.suggestedRecipe;delete replacement.manual;delete replacement.personal;replacement.locked=false;menu.days[index]=replacement;}
 else if(body.action==='reroll'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0)throw new Error('Día no encontrado.');if(menu.days[index].locked)throw new Error('Desbloquea el día para cambiarlo.');const history=[...Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days),...menu.days.filter(d=>d.date!==body.date)];menu.days[index]=generateDay(body.date,catalog,menu.settings,history,menu.days[index])}
 }menu.updatedAt=new Date().toISOString();menu.warnings=menuWarnings(menu,Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days))}}
 const next=await saveState(state,revision);return json({state,revision:next,catalog:catalogFor(state)});
 }catch(e){if(e instanceof Error&&e.message==='CONFLICT')return json({error:'Hay cambios más recientes. Recarga la página.'},409);console.error('Menu save',e);return json({error:e instanceof Error&&!/D1|SQLITE|Database/i.test(e.message)?e.message:'No se han guardado los cambios. Inténtalo de nuevo.'},400)}
}
