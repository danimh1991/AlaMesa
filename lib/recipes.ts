import recipes from './recipes.json';
import {generateDay,allowed,normalize,people,type Menu,type Dish,type State,type Day} from './menu';
export type Recipe={id:string;name:string;category:string;type:string;season:string;complexity:number;ingredients:string[];steps:string[];notes:string;originalName:string;source:string;providerUrl:string;provider?:string;details?:import('./menu').RecipeDetails};
export const pilot=recipes as Recipe[];
export function addSuggestions(menu:Menu,catalog:Dish[],menus:Record<string,Menu>,previous?:Menu){
 // Keep slot decisions across regeneration, including rejections and manual edits.
 if(previous?.recipeSlots){menu.recipeSlots=previous.recipeSlots;return menu;}
 const alreadyTried=new Set(Object.values(menus).flatMap(m=>m.days.flatMap(d=>d.suggestion?[d.suggestion]:[])));
 const eligible=pilot.filter(r=>!catalog.some(d=>d.recipeId===r.id||normalize(d.name)===normalize(r.name))&&!alreadyTried.has(r.id)&&allowed({...r,id:0,person:'Ambos',review:false},'Dani',menu.month+'-01',menu.settings));
 const targets=[Math.floor(menu.days.length*.25),Math.floor(menu.days.length*.75)];menu.recipeSlots=[];
 for(const target of targets){const choices=menu.days.filter(d=>!d.locked&&!menu.recipeSlots!.includes(d.date));const day=choices.sort((a,b)=>Math.abs(menu.days.indexOf(a)-target)-Math.abs(menu.days.indexOf(b)-target))[0];if(!day||!eligible.length)continue;
 const index=Math.floor(Math.random()*eligible.length),recipe=eligible.splice(index,1)[0];
 day.suggestion=recipe.id;day.locked=true;day.meals={Dani:[],Marta:[]};day.manual={kind:'custom',Dani:recipe.name,Marta:recipe.name};menu.recipeSlots.push(day.date);
 }
 return menu;
}
export function acceptRecipe(state:State,catalog:Dish[],body:{recipeId:string;dish:Omit<Dish,'id'|'recipeId'>;month?:string;date?:string}){
 const recipe=pilot.find(r=>r.id===body.recipeId);if(!recipe)throw new Error('Receta desconocida.');
 const existing=catalog.find(d=>d.recipeId===recipe.id);
 if((existing&&!body.month)||(!existing&&catalog.some(d=>normalize(d.name)===normalize(body.dish.name))))throw new Error('Esta receta ya está en vuestros platos.');
 if(Boolean(body.month)!==Boolean(body.date))throw new Error('Indica el mes y el día juntos.');
 const dish: Dish=existing??{...body.dish,id:Math.max(0,...catalog.map(d=>d.id))+1,recipeId:recipe.id,recipe:recipe.details};
 let replacement:Day|undefined;const menu=body.month?state.menus[body.month]:undefined;
 if(body.month){if(!menu||menu.status!=='draft')throw new Error('Abre el mes como borrador antes de aceptar la receta.');const day=menu.days.find(d=>d.date===body.date);if(!day||day.suggestion!==recipe.id)throw new Error('La propuesta de ese día ha cambiado.');if(dish.enabled===false||dish.type==='Guarnición')throw new Error('Para ese día elige un plato disponible de tipo único, entrante o principal.');
 const history=Object.values(state.menus).filter(m=>m.month!==menu.month&&m.status==='confirmed').flatMap(m=>m.days).concat(menu.days.filter(d=>d.date!==day.date));
 replacement={date:day.date,locked:true,meals:{Dani:[],Marta:[]}};
 for(const p of people){if(dish.person!=='Ambos'&&dish.person!==p){replacement.meals[p]=generateDay(day.date,catalog,menu.settings,history).meals[p];continue;}
 if(!allowed(dish,p,day.date,menu.settings))throw new Error('La temporada elegida no encaja con este mes.');
 if(dish.type==='Único')replacement.meals[p]=[dish];else{const candidates=[{...dish,person:'Ambos'},...catalog.filter(d=>d.person==='Ambos'||d.person===p).filter(d=>d.type===(dish.type==='Entrante'?'Principal':'Entrante')).map(d=>({...d,person:'Ambos'}))];replacement.meals[p]=generateDay(day.date,candidates,menu.settings,history).meals.Dani.map(d=>d.id===dish.id?dish:catalog.find(x=>x.id===d.id)!);}
 }
 }
 if(!existing)state.added=[...(state.added??[]),dish];if(menu&&replacement){menu.days[menu.days.findIndex(d=>d.date===replacement!.date)]=replacement;menu.updatedAt=new Date().toISOString();}
}

export function suggestForDay(menu:Menu,catalog:Dish[],date:string){
 if(menu.status!=='draft')throw new Error('Abre el menú para editarlo.');
 const index=menu.days.findIndex(d=>d.date===date);
 if(index<0)throw new Error('Día no encontrado.');
 const day=menu.days[index];
 if(day.locked&&!day.suggestion)throw new Error('Desbloquea el día para proponer una receta nueva.');
 const used=new Set(menu.days.flatMap(d=>d.suggestion?[d.suggestion]:[]));
 const eligible=pilot.filter(r=>!used.has(r.id)&&!catalog.some(d=>d.recipeId===r.id||normalize(d.name)===normalize(r.name))&&allowed({...r,id:0,person:'Ambos',review:false},'Dani',date,menu.settings));
 if(!eligible.length)throw new Error('No quedan recetas nuevas para esta temporada que no estén ya en vuestro catálogo o propuestas en este mes.');
 const recipe=eligible[Math.floor(Math.random()*eligible.length)];
 menu.days[index]={date,locked:true,suggestion:recipe.id,meals:{Dani:[],Marta:[]},manual:{kind:'custom',Dani:recipe.name,Marta:recipe.name}};
 menu.recipeSlots=[...new Set([...(menu.recipeSlots??[]),date])];
}
