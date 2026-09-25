export type Person = string;
export type Diner={id:string;name:string};
export type MealType='Desayuno'|'Comida'|'Merienda'|'Cena';
export const dishCategories=['Carne','Verduras','Pollo','Pescado','Pasta','Legumbres','Arroz','Huevos'] as const;
export type DishCategory=typeof dishCategories[number];
export type CategoryRange={min:number;max:number};
export type Ingredient={name:string;quantity:number|null;unit:string;notes?:string};
export type RecipeDetails={servings:number|null;ingredients:Ingredient[];steps:string[];sourceUrl:string;notes:string;reviewed:boolean;originalIngredients?:string};
export type Dish = {id:number;name:string;category:string;season:string;complexity:number;diners:string[];mealType:MealType;type:string;review:boolean;enabled?:boolean;family?:string;recipeId?:string;recipe?:RecipeDetails};
export type Settings = {diners?:Diner[];days:number[];summerMonths:number[];repeatDays:number;mealTypes:MealType[];newRecipeSuggestions:number;categoryRanges:Record<string,CategoryRange>};
export type ManualMeal = {kind:'custom';entries?:Record<string,string>;Dani?:string;Marta?:string}|{kind:'out'|'empty';note:string};
export type PersonalMeal={kind:'out'|'tupper'|'custom'|'empty';note:string}|{kind:'suggestion';recipe:import('./recipes').Recipe};
export type Day = {date:string;meals:Record<Person,Dish[]>;mealsByType?:Partial<Record<MealType,Record<Person,Dish[]>>>;locked:boolean;manual?:ManualMeal;suggestion?:string;suggestedRecipe?:import('./recipes').Recipe;personal?:Record<string,PersonalMeal>;personalByType?:Partial<Record<MealType,Record<string,PersonalMeal>>>};
export type Menu = {month:string;status:'draft'|'confirmed';days:Day[];settings:Settings;updatedAt:string;warnings:string[];recipeSlots?:string[]};
export type ShoppingItem={id:string;name:string;quantity:number|null;unit:string;checked:boolean;uses:string[]};
export type ShoppingStore={items:ShoppingItem[];included:Record<string,number>};
export type State = {settings:Settings;menus:Record<string,Menu>;overrides:Record<string,Dish>;added?:Dish[];deletedDishIds?:number[];shopping?:ShoppingStore;discovery?:{recipes:import('./recipes').Recipe[];updatedAt:string}};
export const mealTypes:MealType[]=['Desayuno','Comida','Merienda','Cena'];
export const defaultCategoryRanges=Object.fromEntries(dishCategories.map(category=>[category,{min:0,max:7}])) as Record<string,CategoryRange>;
export const defaults:Settings={diners:[{id:'Dani',name:'Dani'},{id:'Marta',name:'Marta'}],days:[1,2,3,4,5],summerMonths:[6,7,8,9],repeatDays:21,mealTypes:['Comida'],newRecipeSuggestions:2,categoryRanges:defaultCategoryRanges};
export const initialState=():State=>({settings:structuredClone(defaults),menus:{},overrides:{}});
export const people:Person[]=['Dani','Marta'];
export const dinersFor=(s:Settings)=>s.diners??defaults.diners!;
export const peopleFor=(s:Settings)=>dinersFor(s).map(d=>d.id);
export const dinerName=(s:Settings,id:string)=>dinersFor(s).find(d=>d.id===id)?.name??id;
export const emptyMeals=(s:Settings):Record<string,Dish[]>=>Object.fromEntries(peopleFor(s).map(p=>[p,[]]));
export const selectedMealTypes=(s:Settings)=>{const legacy=(s as Settings&{mealType?:MealType}).mealType;const selected=Array.isArray(s.mealTypes)?s.mealTypes:legacy?[legacy]:['Comida'];return mealTypes.filter(type=>selected.includes(type));};
export const mealsFor=(day:Day,type:MealType):Record<string,Dish[]>=>day.mealsByType?.[type]??(type==='Comida'?day.meals:{});
export function setMealsFor(day:Day,type:MealType,meals:Record<string,Dish[]>){day.mealsByType??={};day.mealsByType[type]=meals;if(type==='Comida')day.meals=meals;}
export const personalFor=(day:Day,type:MealType):Record<string,PersonalMeal>=>day.personalByType?.[type]??(type==='Comida'?day.personal??{}:{});
export function setPersonalFor(day:Day,type:MealType,personal:Record<string,PersonalMeal>){day.personalByType??={};day.personalByType[type]=personal;if(type==='Comida')day.personal=personal;}
export const manualEntries=(m:Extract<ManualMeal,{kind:'custom'}>):Record<string,string>=>m.entries??{Dani:m.Dani??'',Marta:m.Marta??''};
export function normalize(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
export function family(d:Dish){
 if(d.family?.trim())return normalize(d.family);
 const n=normalize(d.name);
 const groups=[['pasta','espaguet','macarron','rigatoni','tagliatelle','ravioli','noodle','pasta'],['arroz','arroz','paella','risotto'],['berenjena','berenjena'],['pollo','pollo','jamoncito','contramuslo','alita'],['lentejas','lenteja'],['garbanzos','garbanzo'],['judias','fabada','fabes','judion'],['solomillo','solomillo'],['ternera','filete de ternera','filetes de ternera','entrecot'],['emperador','emperador','pez espada']];
 for(const [key,...words] of groups)if(words.some(w=>n.includes(w)))return key;
 return n.split(' ').slice(0,2).join(' ');
}
export function monthDates(month:string,days:number[]){const [y,m]=month.split('-').map(Number);const out:string[]=[];for(let d=1;d<=new Date(Date.UTC(y,m,0)).getUTCDate();d++){const dt=new Date(Date.UTC(y,m-1,d));if(days.includes(dt.getUTCDay()))out.push(`${month}-${String(d).padStart(2,'0')}`)}return out}
export function allowed(d:Dish,p:Person,date:string,s:Settings,type:MealType='Comida'){const summer=s.summerMonths.includes(Number(date.slice(5,7)));return d.enabled!==false&&d.diners.includes(p)&&d.mealType===type&&(d.season==='Ambos'||d.season===(summer?'Verano':'Invierno'))}
// Base spacing applies to level 3; simple meals can return sooner.
export function repeatInterval(d:Dish,s:Settings){return s.repeatDays*[0.4,0.7,1,1.6,2.3][Math.max(0,Math.min(4,d.complexity-1))]}
export function normalizeSettings(s:Settings):Settings{const selected=selectedMealTypes(s),suggestions=Number.isInteger(s.newRecipeSuggestions)?s.newRecipeSuggestions:defaults.newRecipeSuggestions,ranges=(s as Partial<Settings>).categoryRanges??{},categoryNames=[...dishCategories,...Object.keys(ranges).map(name=>name.trim()).filter(name=>name&&!dishCategories.some(category=>normalize(category)===normalize(name)))];return {diners:structuredClone(dinersFor(s)),days:s.days??defaults.days,summerMonths:s.summerMonths??defaults.summerMonths,repeatDays:s.repeatDays??defaults.repeatDays,mealTypes:selected.length?selected:['Comida'],newRecipeSuggestions:Math.max(0,Math.min(10,suggestions)),categoryRanges:Object.fromEntries(categoryNames.map(category=>{const source=Object.entries(ranges).find(([name])=>normalize(name)===normalize(category))?.[1],range=source??defaultCategoryRanges[category]??{min:0,max:7},min=Math.max(0,Math.min(7,Number.isInteger(range.min)?range.min:0)),max=Math.max(0,Math.min(7,Number.isInteger(range.max)?range.max:7));return [category,{min:Math.min(min,max),max:Math.max(min,max)}]}))}}
export function normalizeDish(d:Dish|Record<string,unknown>):Dish{
 const legacy=typeof (d as {person?:unknown}).person==='string'?(d as {person:string}).person:'';
 const selected=Array.isArray((d as {diners?:unknown}).diners)?(d as {diners:string[]}).diners.filter(x=>typeof x==='string'&&x):legacy==='Ambos'?['Dani','Marta']:legacy?[legacy]:[];
 const mealType=mealTypes.includes((d as {mealType?:MealType}).mealType as MealType)?(d as {mealType:MealType}).mealType:'Comida';
 const result={...d,diners:[...new Set(selected)],mealType} as Dish&{person?:string};delete result.person;return result;
}
function distance(a:string,b:string){return Math.abs(Date.parse(a)-Date.parse(b))/86400000}
function week(date:string){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
export function primaryCategory(meal:Dish[]){return (meal.find(d=>d.type==='Principal')??meal.find(d=>d.type==='Único')??meal[meal.length-1])?.category}
export function generateDay(date:string,catalog:Dish[],s:Settings,history:Day[],old?:Day,random= Math.random,enforceCategoryRanges=false):Day {
 const people=peopleFor(s);const day:Day={date,locked:false,meals:emptyMeals(s),mealsByType:{}};
 for(const mealType of selectedMealTypes(s))setMealsFor(day,mealType,generateMeals(date,catalog,s,mealType,history,old,random,enforceCategoryRanges));
 return day;
}
function generateMeals(date:string,catalog:Dish[],s:Settings,mealType:MealType,history:Day[],old?:Day,random= Math.random,enforceCategoryRanges=false):Record<string,Dish[]> {
 const people=peopleFor(s),result=emptyMeals(s),extraPreparationPenalty=45;
 const noise=new Map(catalog.map(d=>[d.id,12*Math.log(-Math.log(Math.max(1e-9,Math.min(1-1e-9,random()))))+12*Math.log(d.complexity)]));
 type Choice={meal:Dish[];score:number};
 const best={} as Record<Person,Choice>,scores={} as Record<Person,Map<number,number>>,optionsByPerson={} as Record<Person,Choice[]>;
 function choices(valid:Dish[],score:(d:Dish)=>number):Choice[]{
  const unique=valid.filter(d=>d.type==='Único').map(d=>({meal:[d],score:score(d)}));
  const starters=valid.filter(d=>d.type==='Entrante').map(d=>({d,score:score(d)})).sort((a,b)=>a.score-b.score).slice(0,5);
  const mains=valid.filter(d=>d.type==='Principal').map(d=>({d,score:score(d)})).sort((a,b)=>a.score-b.score).slice(0,8);
  const combos=starters.flatMap(a=>mains.filter(b=>b.d.id!==a.d.id).map(b=>({meal:[a.d,b.d],score:(a.score+b.score)/2+2+(a.d.category===b.d.category?14:0)})));
  return [...unique,...combos].sort((a,b)=>a.score-b.score);
 }
 for(const p of people){
  const valid=catalog.filter(d=>allowed(d,p,date,s,mealType));
  const ids=new Map<number,number>(),names=new Map<string,number>(),families=new Map<string,number>(),groups=new Map<string,number>();
  const add=<K,>(map:Map<K,number>,key:K,n:number)=>map.set(key,(map.get(key)??0)+n),targetWeek=week(date);
  for(const h of history){const gap=distance(date,h.date);if(gap>120)continue;const meals=mealsFor(h,mealType)[p]??[];for(const meal of new Map(meals.map(x=>[normalize(x.name),x])).values()){const penalty=140*Math.exp(-gap/(repeatInterval(meal,s)/2));add(ids,meal.id,penalty);add(names,normalize(meal.name),penalty)}if(gap<8)for(const f of new Set(meals.map(family)))add(families,f,(8-gap)*7);const groupPenalty=(gap<=3?(4-gap)*6:0)+(targetWeek===week(h.date)?10:0);if(groupPenalty)for(const g of new Set(meals.map(x=>x.category)))add(groups,g,groupPenalty)}
  const score=(d:Dish)=>{let value=noise.get(d.id)!+Math.max(ids.get(d.id)??0,names.get(normalize(d.name))??0)+(families.get(family(d))??0)+(groups.get(d.category)??0);if((old&&mealsFor(old,mealType)[p])?.some(x=>x.id===d.id))value+=500;return value};
  scores[p]=new Map(valid.map(d=>[d.id,score(d)]));optionsByPerson[p]=choices(valid,d=>scores[p].get(d.id)!);
  if(!optionsByPerson[p].length)throw new Error(`No hay un ${mealType.toLowerCase()} completo para ${p} el ${date}. Añade platos de ese tipo o revisa su temporada.`);
 }
 let targetCategory:string|undefined;
 if(mealType==='Comida'&&enforceCategoryRanges){
  const targetWeek=week(date),weekDates=monthDates(date.slice(0,7),s.days).filter(d=>week(d)===targetWeek),seenDates=new Set(history.filter(d=>week(d.date)===targetWeek).map(d=>d.date));
  const counts=new Map<string,number>();for(const h of history.filter(d=>week(d.date)===targetWeek)){const category=h.suggestedRecipe?.category??primaryCategory(mealsFor(h,'Comida')[people[0]]??[]);if(category)counts.set(category,(counts.get(category)??0)+1)}
  const remaining=weekDates.filter(d=>d>=date&&!seenDates.has(d)).length,enforceMinimums=weekDates.length===s.days.length;
  const categories=Object.keys(s.categoryRanges),deficits=new Map(categories.map(category=>[category,enforceMinimums?Math.max(0,s.categoryRanges[category].min-(counts.get(category)??0)):0])),deficitTotal=[...deficits.values()].reduce((sum,n)=>sum+n,0);
  if(deficitTotal>remaining)throw new Error('Los días bloqueados no dejan espacio para cumplir los mínimos semanales. Desbloquea algún día o ajusta los rangos.');
  const compatible=categories.filter(category=>(counts.get(category)??0)<s.categoryRanges[category].max&&people.every(p=>optionsByPerson[p].some(option=>primaryCategory(option.meal)===category)));
  const required=deficitTotal===remaining?compatible.filter(category=>(deficits.get(category)??0)>0):compatible;
  if(!required.length)throw new Error('No hay una combinación de platos que cumpla los rangos semanales. Revisa los máximos o añade platos compatibles.');
  targetCategory=required.map(category=>({category,score:people.reduce((sum,p)=>sum+(optionsByPerson[p].find(option=>primaryCategory(option.meal)===category)?.score??1e9),0)/people.length-(deficits.get(category)??0)*80})).sort((a,b)=>a.score-b.score)[0].category;
 }
 for(const p of people)best[p]=targetCategory?optionsByPerson[p].find(option=>primaryCategory(option.meal)===targetCategory)!:optionsByPerson[p][0];
 const common=catalog.filter(d=>people.every(p=>scores[p].has(d.id))),sharedOptions=choices(common,d=>people.reduce((sum,p)=>sum+scores[p].get(d.id)!,0)/people.length).filter(option=>!targetCategory||primaryCategory(option.meal)===targetCategory),shared=sharedOptions[0];
 const share=shared&&shared.score<=people.reduce((sum,p)=>sum+best[p].score,0)/people.length+extraPreparationPenalty;
 for(const p of people)result[p]=(share?shared.meal:best[p].meal).map(d=>({...d}));
 return result;
}
export function menuWarnings(menu:Menu,history:Day[]){const people=peopleFor(menu.settings),types=selectedMealTypes(menu.settings);const warnings:string[]=[];let repeats=0;const seen=[...history];for(const day of menu.days){for(const type of types)for(const p of people)for(const dish of mealsFor(day,type)[p]??[])if(seen.some(h=>distance(day.date,h.date)<repeatInterval(dish,menu.settings)&&mealsFor(h,type)[p]?.some(x=>x.id===dish.id||normalize(x.name)===normalize(dish.name))))repeats++;seen.push(day)}if(repeats)warnings.push(`Hay ${repeats} asignaciones repetidas antes de la separación orientativa de su complejidad. Es una preferencia; puedes cambiar esos días.`);if(menu.days.some(d=>types.some(type=>people.some(p=>mealsFor(d,type)[p]?.some(x=>x.review)))))warnings.push('El menú incluye platos marcados para revisión en vuestro Excel. Comprueba sus datos antes de confirmar.');return warnings}
export function generateMenu(month:string,catalog:Dish[],settings:Settings,menus:Record<string,Menu>,previous?:Menu):Menu{
 const history=Object.values(menus).filter(m=>m.month!==month&&m.status==='confirmed').flatMap(m=>m.days);
 const days:Day[]=[];const locked=previous?.days.filter(d=>d.locked&&monthDates(month,settings.days).includes(d.date))??[];
 for(const date of monthDates(month,settings.days)){const saved=locked.find(d=>d.date===date);if(saved){if(peopleFor(previous!.settings).join()!==peopleFor(settings).join())throw new Error('Han cambiado los comensales. Desbloquea los días antes de regenerar este mes.');const keep=structuredClone(saved);if(!keep.manual)for(const type of selectedMealTypes(settings)){const handled=(type==='Comida'&&!!keep.suggestion)||Object.keys(personalFor(keep,type)).length>0;if(!handled&&peopleFor(settings).some(p=>!(mealsFor(keep,type)[p]??[]).length)){const generated=generateDay(date,catalog,{...settings,mealTypes:[type]},[...history,...locked.filter(d=>d.date!==date),...days],keep,Math.random,true);setMealsFor(keep,type,mealsFor(generated,type));}}validateDay(keep,settings);days.push(keep)}else days.push(generateDay(date,catalog,settings,[...history,...locked,...days.filter(d=>!d.locked)],previous?.days.find(d=>d.date===date),Math.random,true))}
 const menu:Menu={month,status:'draft',days,settings:structuredClone(settings),updatedAt:new Date().toISOString(),warnings:[]};menu.warnings=menuWarnings(menu,history);return menu;
}
export function validateDay(day:Day,s:Settings){if(day.manual){if(day.manual.kind==='custom'&&peopleFor(s).some(p=>!manualEntries(day.manual as Extract<ManualMeal,{kind:'custom'}>)[p]?.trim()))throw new Error('Completa la comida puntual de todos los comensales.');return;}for(const mealType of selectedMealTypes(s))for(const p of peopleFor(s)){if(mealType==='Comida'&&day.suggestion)continue;const personal=personalFor(day,mealType)[p];if(personal){if(personal.kind==='suggestion')continue;if(personal.kind==='custom'&&!personal.note.trim())throw new Error('Completa la comida puntual.');continue;}const ds=mealsFor(day,mealType)[p]??[];if(!ds.length||ds.some(d=>!d||!allowed(d,p,day.date,s,mealType)))throw new Error(`El ${mealType.toLowerCase()} de ${p} del ${day.date} no cumple las preferencias.`);if(!(ds.length===1&&ds[0].type==='Único')&&!(ds.length===2&&ds[0].type==='Entrante'&&ds[1].type==='Principal'))throw new Error(`Falta completar el ${mealType.toLowerCase()} de ${p}.`)} }
