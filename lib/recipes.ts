import recipes from './recipes.json';
import {generateDay,generateMenu,allowed,normalize,peopleFor,emptyMeals,monthDates,manualEntries,dinersFor,type Menu,type Dish,type State,type Day,type RecipeDetails} from './menu';
export type Recipe={id:string;name:string;category:string;type:string;season:string;complexity:number;ingredients:string[];steps:string[];notes:string;originalName:string;source:string;providerUrl:string;provider?:string;details?:RecipeDetails;rowIndex?:number;servings?:number|null;originalIngredients?:string};
export const pilot=recipes as Recipe[];
export const poolFor=(state:State)=>state.discovery?.recipes??pilot;
export function detailsFor(recipe:Recipe):RecipeDetails{return recipe.details??{servings:recipe.servings??null,ingredients:recipe.ingredients.map(name=>({name,quantity:null,unit:''})),steps:recipe.steps,sourceUrl:recipe.source,notes:recipe.notes,reviewed:false,originalIngredients:recipe.originalIngredients};}
export function pendingRecipe(day:Day,all:Recipe[]=pilot){return day.suggestedRecipe??all.find(r=>r.id===day.suggestion)??pilot.find(r=>r.id===day.suggestion)}
export function resolveRecipe(state:State,id:string){return poolFor(state).find(r=>r.id===id)??Object.values(state.menus).flatMap(m=>m.days).flatMap(d=>[d.suggestedRecipe,...Object.values(d.personal??{}).flatMap(p=>p.kind==='suggestion'?[p.recipe]:[])]).find(r=>r?.id===id)??pilot.find(r=>r.id===id);}
export function individualDay(day:Day,menu:Menu):Day{
 const copy=structuredClone(day);copy.personal??={};
 if(copy.manual){for(const p of peopleFor(menu.settings)){copy.personal[p]={kind:copy.manual.kind,note:copy.manual.kind==='custom'?manualEntries(copy.manual)[p]??'':copy.manual.note};copy.meals[p]=[];}delete copy.manual;}
 if(copy.suggestion){const recipe=pendingRecipe(copy);if(!recipe)throw new Error('Sustituye la propuesta antigua antes de editarla.');for(const p of peopleFor(menu.settings)){copy.personal[p]={kind:'suggestion',recipe};copy.meals[p]=[];}delete copy.suggestion;delete copy.suggestedRecipe;}
 return copy;
}
function eligible(pool:Recipe[],catalog:Dish[],date:string,menu:Menu,person=peopleFor(menu.settings)[0]){return pool.filter(r=>!catalog.some(d=>d.recipeId===r.id||normalize(d.name)===normalize(r.name))&&allowed({...r,id:0,diners:peopleFor(menu.settings),mealType:menu.settings.mealType,review:false},person,date,menu.settings));}
export function addSuggestions(menu:Menu,catalog:Dish[],menus:Record<string,Menu>,previous?:Menu,pool:Recipe[]=pilot){
 if(previous?.recipeSlots){menu.recipeSlots=previous.recipeSlots;return menu;}
 const tried=new Set(Object.values(menus).flatMap(m=>m.days.flatMap(d=>[...(d.suggestion?[d.suggestion]:[]),...Object.values(d.personal??{}).flatMap(p=>p.kind==='suggestion'?[p.recipe.id]:[])])));
 const choices=eligible(pool,catalog,menu.month+'-01',menu).filter(r=>!tried.has(r.id));menu.recipeSlots=[];
 for(const target of [Math.floor(menu.days.length*.25),Math.floor(menu.days.length*.75)]){const day=menu.days.filter(d=>!d.locked&&!menu.recipeSlots!.includes(d.date)).sort((a,b)=>Math.abs(menu.days.indexOf(a)-target)-Math.abs(menu.days.indexOf(b)-target))[0];if(!day||!choices.length)continue;const recipe=choices.splice(Math.floor(Math.random()*choices.length),1)[0];Object.assign(day,{suggestion:recipe.id,suggestedRecipe:recipe,locked:true,meals:emptyMeals(menu.settings),manual:{kind:'custom',entries:Object.fromEntries(peopleFor(menu.settings).map(p=>[p,recipe.name]))}});menu.recipeSlots.push(day.date);}
 return menu;
}
export function acceptRecipe(state:State,catalog:Dish[],body:{recipeId:string;dish:Omit<Dish,'id'|'recipeId'>;month?:string;date?:string;schedule?:boolean;replaceLocked?:boolean;targetPerson?:string},recipe:Recipe){
 const existing=catalog.find(d=>d.recipeId===recipe.id);
 if((existing&&!body.month)||(!existing&&catalog.some(d=>normalize(d.name)===normalize(body.dish.name))))throw new Error('Esta receta ya está en vuestros platos.');
 if(Boolean(body.month)!==Boolean(body.date))throw new Error('Indica el mes y el día juntos.');
 const dish:Dish=existing??{...body.dish,id:Math.max(0,...catalog.map(d=>d.id))+1,recipeId:recipe.id,recipe:detailsFor(recipe)};
 let menu=body.month?state.menus[body.month]:undefined;
 if(body.month&&body.date){
  if(!body.date.startsWith(body.month+'-'))throw new Error('El día no pertenece al mes seleccionado.');
  if(!menu&&body.schedule){if(!monthDates(body.month,state.settings.days).includes(body.date))throw new Error('Ese día no está incluido en Preferencias.');menu=generateMenu(body.month,catalog,state.settings,state.menus);}
  if(!menu||menu.status!=='draft')throw new Error('Abre el mes como borrador antes de aceptar la receta.');
  const day=menu.days.find(d=>d.date===body.date);if(!day)throw new Error('Elige un día planificado en ese mes.');
  const people=peopleFor(menu.settings),target=body.targetPerson;
  if(target&&!people.includes(target))throw new Error('Comensal no encontrado en este mes.');
  if(!body.schedule){const proposed=target?day.personal?.[target]:undefined;if(target?((proposed?.kind!=='suggestion'||proposed.recipe.id!==recipe.id)&&day.suggestion!==recipe.id):day.suggestion!==recipe.id)throw new Error('La propuesta de ese día ha cambiado.');}
  else if(day.locked&&!body.replaceLocked)throw new Error('Confirma que quieres sustituir la comida de ese día bloqueado.');
  if(dish.enabled===false||dish.type==='Guarnición')throw new Error('Elige un plato disponible de tipo único, entrante o principal.');
  const recipients=target?[target]:people;
  const replacement=target||body.schedule?individualDay(day,menu):{date:day.date,locked:true,meals:emptyMeals(menu.settings)} as Day;
  for(const p of recipients){
   if(!dish.diners.includes(p)){if(target)throw new Error('Este plato no está asignado a ese comensal.');replacement.meals[p]=generateDay(day.date,catalog,menu.settings,menu.days).meals[p];if(replacement.personal)delete replacement.personal[p];continue;}
   if(!allowed(dish,p,day.date,menu.settings))throw new Error('La temporada o el comensal no encajan con este plato.');
   const history=Object.values(state.menus).filter(m=>m.month!==menu!.month&&m.status==='confirmed').flatMap(m=>m.days).concat(menu.days.filter(d=>d.date!==day.date));
   if(dish.type==='Único')replacement.meals[p]=[dish];
   else {const opposite=dish.type==='Entrante'?'Principal':'Entrante';const pair=catalog.filter(d=>d.type===opposite&&d.id!==dish.id);const candidates=[dish,...pair];const oneSettings={...menu.settings,diners:dinersFor(menu.settings).filter(d=>d.id===p)};replacement.meals[p]=generateDay(day.date,candidates,oneSettings,history).meals[p];}
   if(replacement.personal)delete replacement.personal[p];
  }
  replacement.locked=true;menu.days[menu.days.findIndex(d=>d.date===day.date)]=replacement;menu.updatedAt=new Date().toISOString();state.menus[body.month]=menu;
 }
 if(!existing)state.added=[...(state.added??[]),dish];
}
export function suggestForDay(menu:Menu,catalog:Dish[],date:string,pool:Recipe[]=pilot){
 if(menu.status!=='draft')throw new Error('Abre el menú para editarlo.');const index=menu.days.findIndex(d=>d.date===date);if(index<0)throw new Error('Día no encontrado.');
 const day=menu.days[index];if(day.locked&&!day.suggestion)throw new Error('Desbloquea el día para proponer una receta nueva.');
 const used=new Set(menu.days.flatMap(d=>[...(d.suggestion?[d.suggestion]:[]),...Object.values(d.personal??{}).flatMap(p=>p.kind==='suggestion'?[p.recipe.id]:[])]));
 const options=eligible(pool,catalog,date,menu).filter(r=>!used.has(r.id));if(!options.length)throw new Error('No quedan ideas nuevas para este mes. Renueva las 50 recetas en Descubrir recetas.');
 const recipe=options[Math.floor(Math.random()*options.length)];menu.days[index]={date,locked:true,suggestion:recipe.id,suggestedRecipe:recipe,meals:emptyMeals(menu.settings),manual:{kind:'custom',entries:Object.fromEntries(peopleFor(menu.settings).map(p=>[p,recipe.name]))}};menu.recipeSlots=[...new Set([...(menu.recipeSlots??[]),date])];
}
export function editPerson(menu:Menu,catalog:Dish[],menus:State['menus'],body:{date:string;person:string;mode:'out'|'tupper'|'custom'|'generate'|'suggest';note?:string},pool:Recipe[]){
 const index=menu.days.findIndex(d=>d.date===body.date);if(index<0||!peopleFor(menu.settings).includes(body.person))throw new Error('Día o comensal no encontrado.');
 const day=individualDay(menu.days[index],menu),p=body.person;
 if(body.mode==='generate'){
  const history=Object.values(menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days).concat(menu.days.filter(d=>d.date!==body.date));
  day.meals[p]=generateDay(body.date,catalog,{...menu.settings,diners:dinersFor(menu.settings).filter(d=>d.id===p)},history,day).meals[p];delete day.personal![p];
 }else if(body.mode==='suggest'){
  const used=new Set(menu.days.flatMap(d=>[...(d.suggestion?[d.suggestion]:[]),...Object.values(d.personal??{}).flatMap(v=>v.kind==='suggestion'?[v.recipe.id]:[])]));
  const choices=eligible(pool,catalog,body.date,menu,p).filter(r=>!used.has(r.id));if(!choices.length)throw new Error('Renueva las 50 ideas en Descubrir recetas para obtener nuevas propuestas.');
  day.personal![p]={kind:'suggestion',recipe:choices[Math.floor(Math.random()*choices.length)]};day.meals[p]=[];
 }else {if(body.mode==='custom'&&!body.note?.trim())throw new Error('Escribe la comida puntual.');day.personal![p]={kind:body.mode,note:body.note?.trim()??''};day.meals[p]=[];}
 day.locked=true;menu.days[index]=day;
}
