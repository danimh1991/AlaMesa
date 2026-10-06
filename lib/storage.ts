import {env} from 'cloudflare:workers';
import {initialState,normalizeDish,normalizeSettings,emptyMeals,mealTypes,type Day,type Dish,type MealType,type Settings,type State} from './menu';

export type ReadParts={dishes?:boolean;menus?:boolean;availableFood?:boolean;shopping?:boolean;discovery?:boolean};
export type SaveChanges={settings?:boolean;dishes?:number[]|'all';menus?:string[]|'all';availableFood?:string[]|'all';shopping?:boolean;discovery?:boolean};
type MetaRow={revision:number;settings:string};
type JsonRow={data:string};
type DishRow={dish_id:number;kind:'override'|'added'|'deleted';data:string|null};

export function database(){if(!env.DB)throw new Error('Database unavailable');return env.DB}

export async function readState(parts?:ReadParts){
 const db=database(),all=!parts;
 try{
  const meta=await db.prepare('SELECT revision, settings FROM app_state WHERE id = 1').first<MetaRow>();
  if(!meta)return readLegacy();
  const requests:Promise<unknown>[]=[];
  if(all||parts.dishes)requests.push(db.prepare('SELECT dish_id, kind, data FROM dish_changes').all<DishRow>());
  if(all||parts.menus)requests.push(db.prepare('SELECT data FROM menus').all<JsonRow>());
  if(all||parts.availableFood)requests.push(db.prepare('SELECT data FROM available_food').all<JsonRow>());
  if(all||parts.shopping)requests.push(db.prepare('SELECT data FROM shopping_state WHERE id = 1').first<JsonRow>());
  if(all||parts.discovery)requests.push(db.prepare('SELECT data FROM discovery_state WHERE id = 1').first<JsonRow>());
  const results=await Promise.all(requests);let index=0;
  const state=initialState();state.settings=JSON.parse(meta.settings) as Settings;
  if(all||parts.dishes){const rows=(results[index++] as D1Result<DishRow>).results;state.overrides={};state.added=[];state.deletedDishIds=[];for(const row of rows){if(row.kind==='deleted')state.deletedDishIds.push(row.dish_id);else if(row.data){const dish=JSON.parse(row.data) as Dish;if(row.kind==='added')state.added.push(dish);else state.overrides[row.dish_id]=dish;}}}
  if(all||parts.menus){state.menus=Object.fromEntries(((results[index++] as D1Result<JsonRow>).results).map(row=>{const menu=JSON.parse(row.data) as State['menus'][string];return [menu.month,menu]}))}
  if(all||parts.availableFood)state.availableFood=((results[index++] as D1Result<JsonRow>).results).map(row=>JSON.parse(row.data));
  if(all||parts.shopping){const row=results[index++] as JsonRow|null;if(row)state.shopping=JSON.parse(row.data)}
  if(all||parts.discovery){const row=results[index++] as JsonRow|null;if(row)state.discovery=JSON.parse(row.data)}
  return {state:normalizeState(state),revision:meta.revision};
 }catch(e){if(isMissingNormalizedSchema(e))return readLegacy();throw e}
}

async function readLegacy(){const row=await database().prepare('SELECT data, revision FROM household WHERE id = 1').first<{data:string;revision:number}>();return row?{state:normalizeState(JSON.parse(row.data) as State),revision:row.revision}:{state:initialState(),revision:0}}

export async function saveState(state:State,revision:number,changes:SaveChanges={settings:true,dishes:'all',menus:'all',availableFood:'all',shopping:true,discovery:true}){
 try{return await saveNormalized(state,revision,changes)}catch(e){if(isMissingNormalizedSchema(e))return saveLegacy(state,revision);throw e}
}

async function saveNormalized(state:State,revision:number,changes:SaveChanges){
 const db=database(),token=crypto.randomUUID(),statements:D1PreparedStatement[]=[];
 statements.push(db.prepare('INSERT OR IGNORE INTO app_state (id, revision, settings) VALUES (1, 0, ?)').bind(JSON.stringify(normalizeSettings(state.settings))));
 statements.push(db.prepare('UPDATE app_state SET revision=revision+1, settings=?, write_token=? WHERE id=1 AND revision=?').bind(JSON.stringify(normalizeSettings(state.settings)),token,revision));
 const owns="EXISTS (SELECT 1 FROM app_state WHERE id=1 AND write_token=?)";
 if(changes.dishes){
  const ids=changes.dishes==='all'?[...new Set([...Object.keys(state.overrides).map(Number),...(state.added??[]).map(d=>d.id),...(state.deletedDishIds??[])])]:[...new Set(changes.dishes)];
  if(changes.dishes==='all')statements.push(db.prepare(`DELETE FROM dish_changes WHERE ${owns}`).bind(token));
  for(const id of ids){
   const record=dishRecord(state,id);
   if(changes.dishes!=='all')statements.push(db.prepare(`DELETE FROM dish_changes WHERE dish_id=? AND ${owns}`).bind(id,token));
   if(record)statements.push(db.prepare(`INSERT OR REPLACE INTO dish_changes (dish_id,kind,data) SELECT ?,?,? WHERE ${owns}`).bind(id,record.kind,record.data,token));
  }
 }
 if(changes.menus){
  const months=changes.menus==='all'?Object.keys(state.menus):[...new Set(changes.menus)];
  if(changes.menus==='all')statements.push(db.prepare(`DELETE FROM menus WHERE ${owns}`).bind(token));
  for(const month of months){const menu=state.menus[month];if(changes.menus!=='all')statements.push(db.prepare(`DELETE FROM menus WHERE month=? AND ${owns}`).bind(month,token));if(menu)statements.push(db.prepare(`INSERT OR REPLACE INTO menus (month,data) SELECT ?,? WHERE ${owns}`).bind(month,JSON.stringify(menu),token))}
 }
 if(changes.availableFood){
  const ids=changes.availableFood==='all'?(state.availableFood??[]).map(food=>food.id):[...new Set(changes.availableFood)];
  if(changes.availableFood==='all')statements.push(db.prepare(`DELETE FROM available_food WHERE ${owns}`).bind(token));
  for(const id of ids){const food=(state.availableFood??[]).find(item=>item.id===id);if(changes.availableFood!=='all')statements.push(db.prepare(`DELETE FROM available_food WHERE id=? AND ${owns}`).bind(id,token));if(food)statements.push(db.prepare(`INSERT OR REPLACE INTO available_food (id,data) SELECT ?,? WHERE ${owns}`).bind(id,JSON.stringify(food),token))}
 }
 if(changes.shopping)statements.push(db.prepare(`DELETE FROM shopping_state WHERE id=1 AND ${owns}`).bind(token),db.prepare(`INSERT INTO shopping_state (id,data) SELECT 1,? WHERE ${owns}`).bind(JSON.stringify(state.shopping??{items:[],included:{}}),token));
 if(changes.discovery){statements.push(db.prepare(`DELETE FROM discovery_state WHERE id=1 AND ${owns}`).bind(token));if(state.discovery)statements.push(db.prepare(`INSERT INTO discovery_state (id,data) SELECT 1,? WHERE ${owns}`).bind(JSON.stringify(state.discovery),token))}
 statements.push(db.prepare('UPDATE app_state SET write_token=NULL WHERE id=1 AND write_token=?').bind(token));
 const result=await db.batch(statements);if(result[1].meta.changes!==1)throw new Error('CONFLICT');return revision+1;
}

function dishRecord(state:State,id:number){if((state.deletedDishIds??[]).includes(id))return {kind:'deleted',data:null} as const;const added=(state.added??[]).find(d=>d.id===id);if(added)return {kind:'added',data:JSON.stringify(added)} as const;const override=state.overrides[id];return override?{kind:'override',data:JSON.stringify(override)} as const:null}
function isMissingNormalizedSchema(error:unknown){return error instanceof Error&&/no such table: (?:app_state|dish_changes|menus|available_food|shopping_state|discovery_state)/i.test(error.message)}
async function saveLegacy(state:State,revision:number){const serialized=JSON.stringify(state);if(new TextEncoder().encode(serialized).length>1800000)throw new Error('El catálogo y el histórico superan el espacio disponible para este formato. Exporta una copia y reduce el tamaño antes de guardar.');const result=await database().prepare('INSERT INTO household (id,data,revision) VALUES (1,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=household.revision+1 WHERE household.revision=?').bind(serialized,revision).run();if(result.meta.changes!==1)throw new Error('CONFLICT');return revision+1}

function normalizeMeals(day:Day,legacyType:MealType,settings:Settings){
 const source=day.mealsByType??{[legacyType]:day.meals};const normalized:Day['mealsByType']={};
 for(const [type,people] of Object.entries(source) as [MealType,Record<string,Dish[]>][]){normalized[type]=Object.fromEntries(Object.entries(people).map(([person,dishes])=>[person,dishes.map(d=>normalizeDish(d))]));}
 day.mealsByType=normalized;day.meals=normalized.Comida??emptyMeals(settings);if(day.personal){day.personalByType??={};day.personalByType.Comida??=day.personal;}if(day.personalByType?.Comida)day.personal=day.personalByType.Comida;
}
function normalizeState(state:State){
 state.settings=normalizeSettings(state.settings);
 state.added=state.added?.map(d=>normalizeDish(d));
 state.availableFood=(state.availableFood??[]).filter(item=>typeof item?.id==='string'&&typeof item.name==='string'&&typeof item.category==='string'&&mealTypes.includes(item.mealType)&&Number.isInteger(item.portions)&&item.portions>0&&Array.isArray(item.diners)).map(item=>({...item,name:item.name.trim(),category:item.category.trim(),portions:Math.min(999,item.portions),diners:[...new Set(item.diners.filter(id=>typeof id==='string'&&id))]})).filter(item=>item.name&&item.category&&item.diners.length);
 state.deletedDishIds=[...new Set((state.deletedDishIds??[]).filter(id=>Number.isSafeInteger(id)&&id>0))];
 state.overrides=Object.fromEntries(Object.entries(state.overrides).map(([id,d])=>[id,normalizeDish(d)])) as Record<string,Dish>;
 for(const menu of Object.values(state.menus)){const legacy=(menu.settings as Settings&{mealType?:MealType}).mealType??'Comida';menu.settings=normalizeSettings(menu.settings);for(const day of menu.days)normalizeMeals(day,legacy,menu.settings)}
 return state;
}
