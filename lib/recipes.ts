import recipes from './recipes.json';
import {generateDay,generateMenu,allowed,normalize,peopleFor,emptyMeals,monthDates,manualEntries,dinersFor,selectedMealTypes,mealsFor,setMealsFor,personalFor,setPersonalFor,type Menu,type Dish,type State,type Day,type RecipeDetails,type MealType} from './menu';
export type Recipe={id:string;name:string;category:string;type:string;season:string;complexity:number;ingredients:string[];steps:string[];notes:string;originalName:string;source:string;providerUrl:string;provider?:string;details?:RecipeDetails;rowIndex?:number;servings?:number|null;originalIngredients?:string};
export const pilot=recipes as Recipe[];
export const poolFor=(state:State)=>state.discovery?.recipes??pilot;
export function detailsFor(recipe:Recipe):RecipeDetails{return recipe.details??{servings:recipe.servings??null,ingredients:recipe.ingredients.map(name=>({name,quantity:null,unit:''})),steps:recipe.steps,sourceUrl:recipe.source,notes:recipe.notes,reviewed:false,originalIngredients:recipe.originalIngredients};}
export function pendingRecipe(day:Day,all:Recipe[]=pilot){return day.suggestedRecipe??all.find(r=>r.id===day.suggestion)??pilot.find(r=>r.id===day.suggestion)}
const personalSuggestions=(day:Day)=>Object.values(day.personalByType??{Comida:day.personal??{}}).flatMap(group=>Object.values(group??{}).flatMap(p=>p.kind==='suggestion'?[p.recipe]:[]));
export function resolveRecipe(state:State,id:string){return poolFor(state).find(r=>r.id===id)??Object.values(state.menus).flatMap(m=>m.days).flatMap(d=>[d.suggestedRecipe,...personalSuggestions(d)]).find(r=>r?.id===id)??pilot.find(r=>r.id===id);}
export function individualDay(day:Day,menu:Menu):Day{
 const copy=structuredClone(day);
 if(copy.manual){
  for(const type of selectedMealTypes(menu.settings)){const personals={...personalFor(copy,type)};for(const p of peopleFor(menu.settings))personals[p]={kind:copy.manual.kind,note:copy.manual.kind==='custom'?manualEntries(copy.manual)[p]??'':copy.manual.note};setPersonalFor(copy,type,personals);setMealsFor(copy,type,emptyMeals(menu.settings));}
  delete copy.manual;
 }
 if(copy.suggestion){const recipe=pendingRecipe(copy);if(!recipe)throw new Error('Sustituye la propuesta antigua antes de editarla.');const personals={...personalFor(copy,'Comida')};for(const p of peopleFor(menu.settings))personals[p]={kind:'suggestion',recipe};setPersonalFor(copy,'Comida',personals);setMealsFor(copy,'Comida',emptyMeals(menu.settings));delete copy.suggestion;delete copy.suggestedRecipe;}
 return copy;
}
function eligible(pool:Recipe[],catalog:Dish[],date:string,menu:Menu,person=peopleFor(menu.settings)[0],mealType:MealType='Comida'){return pool.filter(r=>!catalog.some(d=>d.recipeId===r.id||normalize(d.name)===normalize(r.name))&&allowed({...r,id:0,diners:peopleFor(menu.settings),mealType,review:false},person,date,menu.settings,mealType));}
export function addSuggestions(menu:Menu,catalog:Dish[],menus:Record<string,Menu>,previous?:Menu,pool:Recipe[]=pilot){
 if(!selectedMealTypes(menu.settings).includes('Comida'))return menu;
 if(previous?.recipeSlots){menu.recipeSlots=previous.recipeSlots;return menu;}
 const tried=new Set(Object.values(menus).flatMap(m=>m.days.flatMap(d=>[...(d.suggestion?[d.suggestion]:[]),...personalSuggestions(d).map(recipe=>recipe.id)])));
 const choices=eligible(pool,catalog,menu.month+'-01',menu).filter(r=>!tried.has(r.id));menu.recipeSlots=[];
 for(const target of [Math.floor(menu.days.length*.25),Math.floor(menu.days.length*.75)]){const day=menu.days.filter(d=>!d.locked&&!menu.recipeSlots!.includes(d.date)).sort((a,b)=>Math.abs(menu.days.indexOf(a)-target)-Math.abs(menu.days.indexOf(b)-target))[0];if(!day||!choices.length)continue;const recipe=choices.splice(Math.floor(Math.random()*choices.length),1)[0];Object.assign(day,{suggestion:recipe.id,suggestedRecipe:recipe,locked:true});setMealsFor(day,'Comida',emptyMeals(menu.settings));menu.recipeSlots.push(day.date);}
 return menu;
}
export function acceptRecipe(state:State,catalog:Dish[],body:{recipeId:string;dish:Omit<Dish,'id'|'recipeId'>;month?:string;date?:string;schedule?:boolean;replaceLocked?:boolean;targetPerson?:string},recipe:Recipe){
 const existing=catalog.find(d=>d.recipeId===recipe.id&&d.mealType===body.dish.mealType);
 if((existing&&!body.month)||(!existing&&catalog.some(d=>normalize(d.name)===normalize(body.dish.name)&&d.recipeId!==recipe.id)))throw new Error('Esta receta ya está en vuestros platos.');
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
  if(target&&!selectedMealTypes(menu.settings).includes(dish.mealType))throw new Error('Ese tipo de comida no está activo en este mes.');
  if(!body.schedule){const proposed=target?personalFor(day,dish.mealType)[target]:undefined;const shared=dish.mealType==='Comida'?day.suggestion:undefined;if(target?((proposed?.kind!=='suggestion'||proposed.recipe.id!==recipe.id)&&shared!==recipe.id):shared!==recipe.id)throw new Error('La propuesta de ese día ha cambiado.');}
  else if(day.locked&&!body.replaceLocked)throw new Error('Confirma que quieres sustituir la comida de ese día bloqueado.');
  if(dish.enabled===false||dish.type==='Guarnición')throw new Error('Elige un plato disponible de tipo único, entrante o principal.');
  const recipients=target?[target]:people;
  const replacement=individualDay(day,menu);
  const targetMeals={...mealsFor(replacement,dish.mealType)};
  for(const p of recipients){
   if(!dish.diners.includes(p)){if(target)throw new Error('Este plato no está asignado a ese comensal.');const typeSettings={...menu.settings,mealTypes:[dish.mealType]};targetMeals[p]=mealsFor(generateDay(day.date,catalog,typeSettings,menu.days),dish.mealType)[p];const personals={...personalFor(replacement,dish.mealType)};delete personals[p];setPersonalFor(replacement,dish.mealType,personals);continue;}
   if(!allowed(dish,p,day.date,menu.settings,dish.mealType))throw new Error('La temporada o el comensal no encajan con este plato.');
   const history=Object.values(state.menus).filter(m=>m.month!==menu!.month&&m.status==='confirmed').flatMap(m=>m.days).concat(menu.days.filter(d=>d.date!==day.date));
   if(dish.type==='Único')targetMeals[p]=[dish];
   else {const opposite=dish.type==='Entrante'?'Principal':'Entrante';const pair=catalog.filter(d=>d.type===opposite&&d.id!==dish.id);const candidates=[dish,...pair];const oneSettings={...menu.settings,mealTypes:[dish.mealType],diners:dinersFor(menu.settings).filter(d=>d.id===p)};targetMeals[p]=mealsFor(generateDay(day.date,candidates,oneSettings,history),dish.mealType)[p];}
   const personals={...personalFor(replacement,dish.mealType)};delete personals[p];setPersonalFor(replacement,dish.mealType,personals);
  }
  setMealsFor(replacement,dish.mealType,targetMeals);
  replacement.locked=true;menu.days[menu.days.findIndex(d=>d.date===day.date)]=replacement;menu.updatedAt=new Date().toISOString();state.menus[body.month]=menu;
 }
 if(!existing)state.added=[...(state.added??[]),dish];
}
export function suggestForDay(menu:Menu,catalog:Dish[],date:string,pool:Recipe[]=pilot){
 if(!selectedMealTypes(menu.settings).includes('Comida'))throw new Error('Activa Comida en Preferencias para pedir una receta en un día.');
 if(menu.status!=='draft')throw new Error('Abre el menú para editarlo.');const index=menu.days.findIndex(d=>d.date===date);if(index<0)throw new Error('Día no encontrado.');
 const day=menu.days[index];if(day.locked&&!day.suggestion)throw new Error('Desbloquea el día para proponer una receta nueva.');
 const used=new Set(menu.days.flatMap(d=>[...(d.suggestion?[d.suggestion]:[]),...personalSuggestions(d).map(recipe=>recipe.id)]));
 const options=eligible(pool,catalog,date,menu).filter(r=>!used.has(r.id));if(!options.length)throw new Error('No quedan ideas nuevas para este mes. Renueva las 50 recetas en Descubrir recetas.');
 const recipe=options[Math.floor(Math.random()*options.length)],replacement=structuredClone(day);Object.assign(replacement,{locked:true,suggestion:recipe.id,suggestedRecipe:recipe});setMealsFor(replacement,'Comida',emptyMeals(menu.settings));delete replacement.manual;setPersonalFor(replacement,'Comida',{});menu.days[index]=replacement;menu.recipeSlots=[...new Set([...(menu.recipeSlots??[]),date])];
}
export function editPerson(menu:Menu,catalog:Dish[],menus:State['menus'],body:{date:string;person:string;mealType:MealType;mode:'out'|'tupper'|'custom'|'generate'|'suggest';note?:string},pool:Recipe[]){
 const index=menu.days.findIndex(d=>d.date===body.date);if(index<0||!peopleFor(menu.settings).includes(body.person))throw new Error('Día o comensal no encontrado.');
 if(!selectedMealTypes(menu.settings).includes(body.mealType))throw new Error('Ese tipo de comida no está activo en este mes.');
 const day=individualDay(menu.days[index],menu),p=body.person,type=body.mealType,personals={...personalFor(day,type)};
 if(body.mode==='generate'){
  const history=Object.values(menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days).concat(menu.days.filter(d=>d.date!==body.date));
  const settings={...menu.settings,mealTypes:[type],diners:dinersFor(menu.settings).filter(d=>d.id===p)};const meals={...mealsFor(day,type),[p]:mealsFor(generateDay(body.date,catalog,settings,history,day),type)[p]};setMealsFor(day,type,meals);delete personals[p];setPersonalFor(day,type,personals);
 }else if(body.mode==='suggest'){
  const used=new Set(menu.days.flatMap(d=>[...(d.suggestion?[d.suggestion]:[]),...personalSuggestions(d).map(recipe=>recipe.id)]));
  const choices=eligible(pool,catalog,body.date,menu,p,type).filter(r=>!used.has(r.id));if(!choices.length)throw new Error('Renueva las 50 ideas en Descubrir recetas para obtener nuevas propuestas.');
  personals[p]={kind:'suggestion',recipe:choices[Math.floor(Math.random()*choices.length)]};setPersonalFor(day,type,personals);setMealsFor(day,type,{...mealsFor(day,type),[p]:[]});
 }else {if(body.mode==='custom'&&!body.note?.trim())throw new Error('Escribe la comida puntual.');personals[p]={kind:body.mode,note:body.note?.trim()??''};setPersonalFor(day,type,personals);setMealsFor(day,type,{...mealsFor(day,type),[p]:[]});}
 day.locked=true;menu.days[index]=day;
}
