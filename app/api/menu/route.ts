import {basket,addProduct,includeMenu} from '../../../lib/shopping-store';
import {z} from 'zod';
import {dishSchema,recipeSchema} from '../../../lib/schemas';
import {planImport,applyImport} from '../../../lib/catalog-transfer';
import {addSuggestions,acceptRecipe,suggestForDay,poolFor,resolveRecipe,editPerson} from '../../../lib/recipes';
import seed from '../../../lib/catalog.json';
import {readState,saveState,type ReadParts,type SaveChanges} from '../../../lib/storage';
import {generateMenu,generateDay,applyAvailableFood,consumeAvailableFood,menuWarnings,validateDay,monthDates,normalize,normalizeDish,peopleFor,emptyMeals,selectedMealTypes,mealsFor,setMealsFor,personalFor,setPersonalFor,validateDay as validateManual,type Dish,type State} from '../../../lib/menu';

const month=z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const diners=z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).refine(v=>!['Ambos','__proto__','constructor','prototype'].includes(v)),name:z.string().trim().min(1).max(40)})).min(1).max(12).refine(ds=>new Set(ds.map(d=>d.id)).size===ds.length&&new Set(ds.map(d=>normalize(d.name))).size===ds.length,'Los nombres no pueden repetirse.');
const categoryRange=z.object({min:z.number().int().min(0).max(7),max:z.number().int().min(0).max(7)}).refine(range=>range.min<=range.max,'El mínimo no puede superar el máximo.');
const settings=z.object({diners:diners.optional(),days:z.array(z.number().int().min(0).max(6)).min(1).max(7),summerMonths:z.array(z.number().int().min(1).max(12)).max(12),repeatDays:z.number().int().min(1).max(90),mealTypes:z.array(z.enum(['Desayuno','Comida','Merienda','Cena'])).min(1).max(4),newRecipeSuggestions:z.number().int().min(0).max(10),categoryRanges:z.record(z.string().trim().min(1).max(40),categoryRange).refine(ranges=>Object.keys(ranges).length>=1&&Object.keys(ranges).length<=24,'Añade entre 1 y 24 tipos principales.').refine(ranges=>new Set(Object.keys(ranges).map(normalize)).size===Object.keys(ranges).length,'No repitas tipos principales.')} ).superRefine((value,ctx)=>{const ranges=Object.values(value.categoryRanges),minimum=ranges.reduce((sum,range)=>sum+range.min,0),maximum=ranges.reduce((sum,range)=>sum+range.max,0);if(minimum>value.days.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Los mínimos semanales superan los días planificados.',path:['categoryRanges']});if(maximum<value.days.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Los máximos semanales no cubren todos los días planificados.',path:['categoryRanges']})});
const dish=dishSchema;
const manual=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('custom'),entries:z.record(z.string().trim().min(1).max(240)).optional(),Dani:z.string().trim().min(1).max(240).optional(),Marta:z.string().trim().min(1).max(240).optional()}),
 z.object({kind:z.literal('out'),note:z.string().trim().max(240).default('')}),
 z.object({kind:z.literal('empty'),note:z.string().trim().max(240).default('')})]);
const catalogFor=(state:State)=>{const deleted=new Set(state.deletedDishIds??[]);return [...seed,...(state.added??[])].filter(d=>!deleted.has(d.id)).map(d=>normalizeDish(state.overrides[d.id]??d)) as Dish[]};
const product=z.object({name:z.string().trim().min(1).max(240),quantity:z.number().positive().max(1000000).nullable(),unit:z.string().trim().max(40)});
const availableFood=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(1).max(180),category:z.string().trim().min(1).max(40),mealType:z.enum(['Desayuno','Comida','Merienda','Cena']),portions:z.number().int().min(1).max(999),diners:z.array(z.string().trim().min(1).max(80)).min(1).max(12).refine(v=>new Set(v).size===v.length)});
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('refresh-recipes'),sources:z.array(z.enum(['abuela','monsieur-cuisine'])).min(1).max(2).default(['abuela']),revision:z.number().int().min(0)}),
 z.object({action:z.literal('person-day'),month,date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),person:z.string().min(1).max(80),mealType:z.enum(['Desayuno','Comida','Merienda','Cena']).default('Comida'),mode:z.enum(['out','tupper','custom','dish','generate','suggest']),note:z.string().trim().max(240).optional(),dishId:z.number().int().positive().optional(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('day-dish'),month,date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),mealType:z.enum(['Desayuno','Comida','Merienda','Cena']),dishId:z.number().int().positive(),revision:z.number().int().min(0)}),
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
 z.object({action:z.literal('accept-recipe'),recipeId:z.string().regex(/^(?:abuela|monsieur-cuisine)-\d+$/),rowIndex:z.number().int().min(0).max(1000000).optional(),schedule:z.boolean().optional(),replaceLocked:z.boolean().optional(),targetPerson:z.string().max(80).optional(),dish:dish.omit({id:true,recipeId:true}),month:month.optional(),date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).optional(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('reject-recipe'),month,date:z.string(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('generate'),month,revision:z.number().int().min(0)}),
 z.object({action:z.enum(['reroll','lock','suggest-recipe']),month,date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),revision:z.number().int().min(0)}),
 z.object({action:z.enum(['confirm','edit']),month,revision:z.number().int().min(0)}),
 z.object({action:z.literal('settings'),settings,revision:z.number().int().min(0)}),
 z.object({action:z.literal('dish'),dish,revision:z.number().int().min(0)}),
 z.object({action:z.literal('create-dish'),dish:dish.omit({id:true}),revision:z.number().int().min(0)}),
 z.object({action:z.literal('delete-dish'),id:z.number().int().positive(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('delete-dishes'),ids:z.array(z.number().int().positive()).min(1).max(1000).refine(ids=>new Set(ids).size===ids.length,'No repitas platos.'),revision:z.number().int().min(0)}),
 z.object({action:z.literal('save-available-food'),food:availableFood,revision:z.number().int().min(0)}),
 z.object({action:z.literal('remove-available-food'),id:z.string().uuid(),revision:z.number().int().min(0)}),
 z.object({action:z.literal('day-manual'),month,date:z.string().regex(/^20\d{2}-\d{2}-\d{2}$/),manual,revision:z.number().int().min(0)})]);
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
type Input=z.infer<typeof input>;
function readPartsFor(body:Input):ReadParts{
 const action=body.action,parts:ReadParts={dishes:true};
 if(['generate','reroll','lock','suggest-recipe','person-day','day-dish','confirm','edit','day-manual','reject-recipe','shopping-include'].includes(action)||(action==='accept-recipe'&&!!body.month))parts.menus=true;
 if(['generate','confirm','save-available-food','remove-available-food'].includes(action))parts.availableFood=true;
 if(action.startsWith('shopping-')||action==='confirm')parts.shopping=true;
 if(['refresh-recipes','generate','reroll','suggest-recipe','person-day','day-dish','reject-recipe','accept-recipe'].includes(action))parts.discovery=true;
 return parts;
}
function changesFor(body:Input,createdDishId?:number,changedFoodId?:string,changedDishIds:number[]=[]):SaveChanges{
 const action=body.action;
 if(action==='settings')return {settings:true};
 if(action==='dish'||action==='recipe'||action==='delete-dish')return {dishes:[action==='dish'?body.dish.id:body.id]};
 if(action==='delete-dishes')return {dishes:body.ids};
 if(action==='create-dish')return {dishes:createdDishId?[createdDishId]:[]};
 if(action==='preview-import')return {};
 if(action==='import-catalog')return {dishes:changedDishIds};
 if(action==='accept-recipe')return {dishes:changedDishIds,...(body.month?{menus:[body.month]}:{})};
 if(action==='refresh-recipes')return {discovery:true};
 if(action==='save-available-food')return {availableFood:changedFoodId?[changedFoodId]:[]};
 if(action==='remove-available-food')return {availableFood:[body.id]};
 if(action.startsWith('shopping-'))return {shopping:true};
 if(action==='confirm')return {menus:[body.month],availableFood:'all',shopping:true};
 if('month' in body)return {menus:[body.month]};
 return {};
}
function mutationPayload(state:State,revision:number,changes:SaveChanges,previousCatalog:Dish[]){
 const patch:Partial<State>={};if(changes.settings)patch.settings=state.settings;
 if(changes.menus){const months=changes.menus==='all'?Object.keys(state.menus):changes.menus;patch.menus=Object.fromEntries(months.flatMap(month=>state.menus[month]?[[month,state.menus[month]]]:[]))}
 if(changes.availableFood)patch.availableFood=state.availableFood??[];if(changes.shopping)patch.shopping=state.shopping;if(changes.discovery)patch.discovery=state.discovery;
 const before=new Map(previousCatalog.map(d=>[d.id,d])),afterCatalog=catalogFor(state),after=new Map(afterCatalog.map(d=>[d.id,d]));
 const ids=changes.dishes==='all'?[...new Set([...before.keys(),...after.keys()])]:changes.dishes??[];
 const catalogUpserts=ids.flatMap(id=>{const dish=after.get(id);return dish&&JSON.stringify(dish)!==JSON.stringify(before.get(id))?[dish]:[]}),catalogDeletes=ids.filter(id=>before.has(id)&&!after.has(id));
 const dishRecords=ids.map(id=>{if((state.deletedDishIds??[]).includes(id))return {id,kind:'deleted' as const};const added=(state.added??[]).find(d=>d.id===id);if(added)return {id,kind:'added' as const,dish:added};const override=state.overrides[id];return override?{id,kind:'override' as const,dish:override}:{id,kind:'none' as const}});
 return {revision,patch,catalogUpserts,catalogDeletes,dishRecords};
}
function dishSnapshot(state:State){const rows=new Map<number,string>();for(const [id,dish] of Object.entries(state.overrides))rows.set(Number(id),'override:'+JSON.stringify(dish));for(const dish of state.added??[])rows.set(dish.id,'added:'+JSON.stringify(dish));for(const id of state.deletedDishIds??[])rows.set(id,'deleted');return rows}
function changedDishes(before:Map<number,string>,state:State){const after=dishSnapshot(state);return [...new Set([...before.keys(),...after.keys()])].filter(id=>before.get(id)!==after.get(id))}
export async function GET(request:Request){try{const discovery=new URL(request.url).searchParams.get('part')==='discovery';if(discovery){const data=await readState({discovery:true});return json({revision:data.revision,discovery:data.state.discovery})}const data=await readState({dishes:true,menus:true,availableFood:true,shopping:true}),catalog=catalogFor(data.state),state={...data.state,overrides:{},added:[],deletedDishIds:[]};return json({state,revision:data.revision,catalog})}catch(e){console.error('Menu read',e);return json({error:'No se han podido cargar los menús. Inténtalo de nuevo.'},503)}}
export async function POST(request:Request){

 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen no permitido.'},403);
 if(request.headers.get('x-alamesa-response')!=='delta-v1')return json({error:'La aplicación se ha actualizado. Recarga la página antes de continuar.'},409);
 let body;try{const raw=await request.text();if(new TextEncoder().encode(raw).length>1500000)return json({error:'El archivo supera el límite de 1,5 MB. Divide la importación en varios archivos.'},413);body=input.parse(JSON.parse(raw))}catch{return json({error:'Los datos enviados no son válidos.'},400)}
 try{const {state,revision}=await readState(readPartsFor(body));if(revision!==body.revision)return json({error:'Hay cambios guardados desde otra pestaña. Recarga antes de continuar.'},409);
 const catalog=catalogFor(state);
 let createdDishId:number|undefined,changedFoodId:string|undefined;
 const beforeDishes=['import-catalog','accept-recipe'].includes(body.action)?dishSnapshot(state):new Map<number,string>();
 if(['dish','create-dish','accept-recipe'].includes(body.action)&&'dish' in body&&!Object.keys(state.settings.categoryRanges).some(category=>normalize(category)===normalize(body.dish.category)))throw new Error('El tipo principal del plato no está en Preferencias. Añádelo antes de guardar el plato.');
 if(['dish','create-dish','accept-recipe'].includes(body.action)&&'dish' in body){const active=peopleFor(body.action==='accept-recipe'&&body.month?state.menus[body.month]?.settings??state.settings:state.settings);if(body.dish.diners.some(p=>!active.includes(p))){const existing='id' in body.dish?catalog.find(d=>d.id===(body.dish as Partial<Dish>).id):undefined;if(!existing||body.dish.diners.some(p=>!existing.diners.includes(p)))throw new Error('Selecciona comensales de Preferencias.');}}
 if(body.action==='refresh-recipes'){const {refreshRecipes}=await import('../../../lib/recipe-provider');state.discovery={recipes:await refreshRecipes(poolFor(state),catalog,body.sources),updatedAt:new Date().toISOString(),sources:body.sources}}
 else if(body.action==='shopping-check-all'){for(const item of basket(state).items)item.checked=true}
 else if(body.action==='shopping-clear-checked'){const store=basket(state);store.items=store.items.filter(i=>!i.checked)}
 else if(body.action==='shopping-add'){addProduct(state,body.product)}
 else if(body.action==='shopping-update'||body.action==='shopping-check'||body.action==='shopping-remove'){const store=basket(state),item=store.items.find(i=>i.id===body.id);if(!item)throw new Error('Producto no encontrado.');if(body.action==='shopping-remove')store.items=store.items.filter(i=>i.id!==body.id);else if(body.action==='shopping-check')item.checked=body.checked;else Object.assign(item,body.product)}
 else if(body.action==='shopping-include'){const menu=state.menus[body.month];if(!menu||body.from>body.to||!body.from.startsWith(body.month)||!body.to.startsWith(body.month))throw new Error('Periodo no válido.');includeMenu(state,menu,catalog,body.from,body.to)}
 else if(body.action==='preview-import'||body.action==='import-catalog'){const plan=planImport(body.document,catalog,Math.max(0,...(state.deletedDishIds??[])));if(body.action==='preview-import')return json({preview:plan.summary,revision});applyImport(state,plan);if(catalogFor(state).some(d=>!Object.keys(state.settings.categoryRanges).some(category=>normalize(category)===normalize(d.category))))throw new Error('La importación contiene tipos principales que no están en Preferencias. Añádelos antes de importar.')}
 else if(body.action==='recipe'){const original=catalog.find(d=>d.id===body.id);if(!original)return json({error:'Plato desconocido.'},404);state.overrides[body.id]={...original,recipe:body.recipe}}
 else if(body.action==='accept-recipe'){const recipe=resolveRecipe(state,body.recipeId)??(body.rowIndex!==undefined?await (await import('../../../lib/recipe-provider')).lookupRecipe(body.recipeId,body.rowIndex):undefined);if(!recipe)throw new Error('Vuelve a buscar la receta antes de confirmarla.');acceptRecipe(state,catalog,body,recipe);if(body.month){const m=state.menus[body.month];m.warnings=menuWarnings(m,Object.values(state.menus).filter(x=>x.month!==m.month&&x.status==='confirmed').flatMap(x=>x.days));}}
 else if(body.action==='settings'){state.settings={...body.settings,diners:body.settings.diners??state.settings.diners,days:[...new Set(body.settings.days)].sort(),summerMonths:[...new Set(body.settings.summerMonths)].sort((a,b)=>a-b),mealTypes:[...new Set(body.settings.mealTypes)]}}
 else if(body.action==='dish'){if(!catalog.some(d=>d.id===body.dish.id))return json({error:'Plato desconocido.'},404);state.overrides[body.dish.id]={...body.dish,recipeId:catalog.find(d=>d.id===body.dish.id)?.recipeId}}
 else if(body.action==='create-dish'){if(catalog.some(d=>normalize(d.name)===normalize(body.dish.name)))return json({error:'Ya hay un plato con ese nombre. Puedes editarlo en el catálogo.'},409);const id=Math.max(...catalog.map(d=>d.id),...(state.deletedDishIds??[]),0)+1;createdDishId=id;state.added=[...(state.added??[]),{...body.dish,id,recipeId:undefined}]}
 else if(body.action==='delete-dish'){if(!catalog.some(d=>d.id===body.id))return json({error:'Plato desconocido.'},404);state.added=(state.added??[]).filter(d=>d.id!==body.id);delete state.overrides[body.id];state.deletedDishIds=[...new Set([...(state.deletedDishIds??[]),body.id])];}
 else if(body.action==='delete-dishes'){const known=new Set(catalog.map(d=>d.id));if(body.ids.some(id=>!known.has(id)))return json({error:'Alguno de los platos seleccionados ya no existe. Recarga antes de continuar.'},409);const selected=new Set(body.ids);state.added=(state.added??[]).filter(d=>!selected.has(d.id));for(const id of selected)delete state.overrides[id];state.deletedDishIds=[...new Set([...(state.deletedDishIds??[]),...selected])];}
 else if(body.action==='save-available-food'){if(!Object.keys(state.settings.categoryRanges).some(category=>normalize(category)===normalize(body.food.category)))throw new Error('El tipo principal debe existir en Preferencias.');if(body.food.diners.some(person=>!peopleFor(state.settings).includes(person)))throw new Error('Selecciona comensales de Preferencias.');const food={...body.food,id:body.food.id??crypto.randomUUID()},index=(state.availableFood??[]).findIndex(item=>item.id===food.id);changedFoodId=food.id;state.availableFood=index<0?[...(state.availableFood??[]),food]:(state.availableFood??[]).map(item=>item.id===food.id?food:item);}
 else if(body.action==='remove-available-food'){state.availableFood=(state.availableFood??[]).filter(item=>item.id!==body.id);}
 else {const menu=state.menus[body.month];if(body.action==='generate'){if(menu?.status==='confirmed')return json({error:'Abre el menú para editarlo antes de regenerarlo.'},409);state.menus[body.month]=addSuggestions(applyAvailableFood(generateMenu(body.month,catalog,state.settings,state.menus,menu),state.availableFood??[]),catalog,state.menus,menu,poolFor(state))}
 else {if(!menu)return json({error:'Este mes todavía no tiene menú.'},404);
 if(body.action==='edit')menu.status='draft';
 else {if(menu.status==='confirmed')return json({error:'El menú está confirmado. Ábrelo para editarlo.'},409);
 if(body.action==='confirm'){if(menu.days.some(d=>d.suggestion||selectedMealTypes(menu.settings).some(type=>Object.values(personalFor(d,type)).some(p=>p.kind==='suggestion'))))throw new Error('Acepta o sustituye las recetas por probar antes de confirmar el mes.');if(menu.days.length!==monthDates(menu.month,menu.settings.days).length)throw new Error('El mes está incompleto.');for(const day of menu.days){const checked=structuredClone(day);for(const type of selectedMealTypes(menu.settings))setMealsFor(checked,type,Object.fromEntries(peopleFor(menu.settings).map(p=>[p,(mealsFor(day,type)[p]??[]).map(d=>catalog.find(x=>x.id===d.id)??d)])));validateDay(checked,menu.settings)}menu.status='confirmed';consumeAvailableFood(state,menu);includeMenu(state,menu,catalog)}
 else if(body.action==='suggest-recipe'){suggestForDay(menu,catalog,body.date,poolFor(state))}
 else if(body.action==='person-day'){editPerson(menu,catalog,state.menus,body,poolFor(state))}
 else if(body.action==='day-dish'){for(const person of peopleFor(menu.settings))editPerson(menu,catalog,state.menus,{date:body.date,person,mealType:body.mealType,mode:'dish',dishId:body.dishId},poolFor(state))}
 else if(body.action==='lock'){const day=menu.days.find(d=>d.date===body.date);if(!day)throw new Error('Día no encontrado.');day.locked=!day.locked}
 else if(body.action==='day-manual'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0)throw new Error('Día no encontrado.');menu.days[index]={date:body.date,locked:true,meals:emptyMeals(menu.settings),mealsByType:{},manual:body.manual};validateManual(menu.days[index],menu.settings)}
 else if(body.action==='reject-recipe'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0||!menu.days[index].suggestion)throw new Error('No hay una receta por probar en ese día.');const history=[...Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days),...menu.days.filter(d=>d.date!==body.date)],replacement=structuredClone(menu.days[index]),food=generateDay(body.date,catalog,{...menu.settings,mealTypes:['Comida']},history,replacement,Math.random,true);setMealsFor(replacement,'Comida',mealsFor(food,'Comida'));delete replacement.suggestion;delete replacement.suggestedRecipe;delete replacement.manual;setPersonalFor(replacement,'Comida',{});replacement.locked=selectedMealTypes(menu.settings).some(type=>Object.keys(personalFor(replacement,type)).length>0);menu.days[index]=replacement;}
 else if(body.action==='reroll'){const index=menu.days.findIndex(d=>d.date===body.date);if(index<0)throw new Error('Día no encontrado.');if(menu.days[index].locked)throw new Error('Desbloquea el día para cambiarlo.');const history=[...Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days),...menu.days.filter(d=>d.date!==body.date)];menu.days[index]=generateDay(body.date,catalog,menu.settings,history,menu.days[index],Math.random,true)}
 }menu.updatedAt=new Date().toISOString();menu.warnings=menuWarnings(menu,Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days))}}
 const changes=changesFor(body,createdDishId,changedFoodId,changedDishes(beforeDishes,state)),next=await saveState(state,revision,changes);return json(mutationPayload(state,next,changes,catalog));
 }catch(e){if(e instanceof Error&&e.message==='CONFLICT')return json({error:'Hay cambios más recientes. Recarga la página.'},409);console.error('Menu save',e);return json({error:e instanceof Error&&!/D1|SQLITE|Database/i.test(e.message)?e.message:'No se han guardado los cambios. Inténtalo de nuevo.'},400)}
}
