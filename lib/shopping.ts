import pilot from './recipes.json';
import {normalize,peopleFor,manualEntries,type Dish,type RecipeDetails,type Menu} from './menu';
export function recipeFor(dish:Dish):RecipeDetails{if(dish.recipe)return structuredClone(dish.recipe);const r=pilot.find(r=>r.id===dish.recipeId);return r?.details?structuredClone(r.details):r?{servings:null,ingredients:r.ingredients.map(name=>({name,quantity:null,unit:''})),steps:r.steps,sourceUrl:r.source,notes:r.notes,reviewed:false}:{servings:null,ingredients:[],steps:[],sourceUrl:'',notes:'',reviewed:false};}
export function shoppingList(menu:Menu,catalog:Dish[],from=menu.month+'-01',to=menu.month+'-31'){
 const rows=new Map<string,{key:string;name:string;quantity:number;unit:string;uses:string[]}>(),pending=new Map<string,{dishId?:number;name:string;reason:string;dates:string[]}>();let portions=0,readyPortions=0;
 const issue=(key:string,name:string,reason:string,date:string,dishId?:number)=>{const old=pending.get(key);if(old){if(!old.dates.includes(date))old.dates.push(date)}else pending.set(key,{dishId,name,reason,dates:[date]})};
 if(menu.status!=='confirmed')return {items:[],pending:[],portions:0,readyPortions:0};
 for(const day of menu.days.filter(d=>d.date>=from&&d.date<=to)){
 if(day.manual){if(day.manual.kind==='custom'){for(const text of new Set(Object.values(manualEntries(day.manual))))issue('manual:'+text,text,'Comida puntual: comprueba si necesita compra.',day.date);}continue;}
 const uses=new Map<number,{dish:Dish;count:number}>();for(const p of peopleFor(menu.settings))for(const snapshot of day.meals[p]??[]){const old=uses.get(snapshot.id);if(old)old.count++;else uses.set(snapshot.id,{dish:catalog.find(d=>d.id===snapshot.id)??snapshot,count:1})}
 for(const {dish,count} of uses.values()){portions+=count;const r=recipeFor(dish);if(!r.servings||!r.ingredients.length){issue('dish:'+dish.id,dish.name,'Faltan ingredientes o raciones: no se pueden calcular sus cantidades.',day.date,dish.id);continue;}if(!r.reviewed)issue('review:'+dish.id,dish.name,'Cantidades incluidas; ingredientes y raciones pendientes de revisión.',day.date,dish.id);let complete=true;
 for(const ing of r.ingredients){if(ing.quantity===null||!ing.unit.trim()){complete=false;issue(`ingredient:${dish.id}:${ing.name}`,`${dish.name}: ${ing.name}`,'Cantidad o unidad sin concretar (por ejemplo, al gusto).',day.date,dish.id);continue;}
 let unit=normalize(ing.unit),amount=ing.quantity*count/r.servings;const map:Record<string,[string,number]>={kg:['g',1000],kilogramo:['g',1000],kilogramos:['g',1000],gramos:['g',1],gramo:['g',1],l:['ml',1000],litro:['ml',1000],litros:['ml',1000],mililitros:['ml',1],unidad:['ud',1],unidades:['ud',1]};if(map[unit]){amount*=map[unit][1];unit=map[unit][0]};const key=normalize(ing.name)+'|'+unit,old=rows.get(key);const use=`${day.date} · ${dish.name} (${count} ${count===1?'persona':'personas'})`;if(old){old.quantity+=amount;old.uses.push(use)}else rows.set(key,{key,name:ing.name,quantity:amount,unit,uses:[use]});
 }if(complete)readyPortions+=count;
 }
 }
 return {items:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'es')),pending:[...pending.values()],portions,readyPortions};
}
