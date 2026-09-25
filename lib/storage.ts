import {env} from 'cloudflare:workers';
import {initialState,normalizeDish,normalizeSettings,emptyMeals,type Day,type Dish,type MealType,type Settings,type State} from './menu';
export function database(){if(!env.DB)throw new Error('Database unavailable');return env.DB}
export async function readState(){const row=await database().prepare('SELECT data, revision FROM household WHERE id = 1').first<{data:string;revision:number}>();return row?{state:normalizeState(JSON.parse(row.data) as State),revision:row.revision}:{state:initialState(),revision:0}}
export async function saveState(state:State,revision:number){const serialized=JSON.stringify(state);if(new TextEncoder().encode(serialized).length>1800000)throw new Error('El catálogo y el histórico superan el espacio disponible para este formato. Exporta una copia y reduce el tamaño antes de guardar.');const result=await database().prepare('INSERT INTO household (id,data,revision) VALUES (1,?,1) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=household.revision+1 WHERE household.revision=?').bind(serialized,revision).run();if(result.meta.changes!==1)throw new Error('CONFLICT');return revision+1}

function normalizeMeals(day:Day,legacyType:MealType,settings:Settings){
 const source=day.mealsByType??{[legacyType]:day.meals};const normalized:Day['mealsByType']={};
 for(const [type,people] of Object.entries(source) as [MealType,Record<string,Dish[]>][]){normalized[type]=Object.fromEntries(Object.entries(people).map(([person,dishes])=>[person,dishes.map(d=>normalizeDish(d))]));}
 day.mealsByType=normalized;day.meals=normalized.Comida??emptyMeals(settings);if(day.personal){day.personalByType??={};day.personalByType.Comida??=day.personal;}if(day.personalByType?.Comida)day.personal=day.personalByType.Comida;
}
function normalizeState(state:State){
 state.settings=normalizeSettings(state.settings);
 state.added=state.added?.map(d=>normalizeDish(d));
 state.deletedDishIds=[...new Set((state.deletedDishIds??[]).filter(id=>Number.isSafeInteger(id)&&id>0))];
 state.overrides=Object.fromEntries(Object.entries(state.overrides).map(([id,d])=>[id,normalizeDish(d)])) as Record<string,Dish>;
 for(const menu of Object.values(state.menus)){const legacy=(menu.settings as Settings&{mealType?:MealType}).mealType??'Comida';menu.settings=normalizeSettings(menu.settings);for(const day of menu.days)normalizeMeals(day,legacy,menu.settings)}
 return state;
}
