export type Person = 'Dani'|'Marta';
export type Dish = {id:number;name:string;category:string;season:string;complexity:number;person:string;type:string;review:boolean;enabled?:boolean;family?:string};
export type Settings = {days:number[];summerMonths:number[];repeatDays:number};
export type ManualMeal = {kind:'custom';Dani:string;Marta:string}|{kind:'out'|'empty';note:string};
export type Day = {date:string;meals:Record<Person,Dish[]>;locked:boolean;manual?:ManualMeal};
export type Menu = {month:string;status:'draft'|'confirmed';days:Day[];settings:Settings;updatedAt:string;warnings:string[]};
export type State = {settings:Settings;menus:Record<string,Menu>;overrides:Record<string,Dish>;added?:Dish[]};
export const defaults:Settings={days:[1,2,3,4,5],summerMonths:[6,7,8,9],repeatDays:21};
export const initialState=():State=>({settings:structuredClone(defaults),menus:{},overrides:{}});
export const people:Person[]=['Dani','Marta'];
export function normalize(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
export function family(d:Dish){
 if(d.family?.trim())return normalize(d.family);
 const n=normalize(d.name);
 const groups=[['pasta','espaguet','macarron','rigatoni','tagliatelle','ravioli','noodle','pasta'],['arroz','arroz','paella','risotto'],['berenjena','berenjena'],['pollo','pollo','jamoncito','contramuslo','alita'],['lentejas','lenteja'],['garbanzos','garbanzo'],['judias','fabada','fabes','judion'],['solomillo','solomillo'],['ternera','filete de ternera','filetes de ternera','entrecot'],['emperador','emperador','pez espada']];
 for(const [key,...words] of groups)if(words.some(w=>n.includes(w)))return key;
 return n.split(' ').slice(0,2).join(' ');
}
export function monthDates(month:string,days:number[]){const [y,m]=month.split('-').map(Number);const out:string[]=[];for(let d=1;d<=new Date(Date.UTC(y,m,0)).getUTCDate();d++){const dt=new Date(Date.UTC(y,m-1,d));if(days.includes(dt.getUTCDay()))out.push(`${month}-${String(d).padStart(2,'0')}`)}return out}
export function allowed(d:Dish,p:Person,date:string,s:Settings){const summer=s.summerMonths.includes(Number(date.slice(5,7)));return d.enabled!==false&&(d.person==='Ambos'||d.person===p)&&(d.season==='Ambos'||d.season===(summer?'Verano':'Invierno'))}
// Base spacing applies to level 3; simple meals can return sooner.
export function repeatInterval(d:Dish,s:Settings){return s.repeatDays*[0.4,0.7,1,1.6,2.3][Math.max(0,Math.min(4,d.complexity-1))]}
export function normalizeSettings(s:Settings):Settings{return {days:s.days??defaults.days,summerMonths:s.summerMonths??defaults.summerMonths,repeatDays:s.repeatDays??defaults.repeatDays}}
function distance(a:string,b:string){return Math.abs(Date.parse(a)-Date.parse(b))/86400000}
function week(date:string){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
export function generateDay(date:string,catalog:Dish[],s:Settings,history:Day[],old?:Day,random= Math.random):Day {
 const day:Day={date,locked:false,meals:{Dani:[],Marta:[]}};
 // Sharing is a preference, not a quota: only a substantial rotation benefit
 // or missing compatible common meals justifies cooking two different menus.
 const extraPreparationPenalty=45;
 // Gumbel sampling gives every eligible dish a chance (weight = 1 / complexity).
 // Share the draw between people so randomness does not create extra cooking.
 const noise=new Map(catalog.map(d=>[d.id,12*Math.log(-Math.log(Math.max(1e-9,Math.min(1-1e-9,random()))))+12*Math.log(d.complexity)]));
 type Choice={meal:Dish[];score:number};
 const best={} as Record<Person,Choice>;
 const scores={} as Record<Person,Map<number,number>>;
 function choices(valid:Dish[],score:(d:Dish)=>number):Choice[]{
  const unique=valid.filter(d=>d.type==='Único').map(d=>({meal:[d],score:score(d)}));
  const starters=valid.filter(d=>d.type==='Entrante').map(d=>({d,score:score(d)})).sort((a,b)=>a.score-b.score).slice(0,5);
  const mains=valid.filter(d=>d.type==='Principal').map(d=>({d,score:score(d)})).sort((a,b)=>a.score-b.score).slice(0,8);
  const combos=starters.flatMap(a=>mains.filter(b=>b.d.id!==a.d.id).map(b=>({meal:[a.d,b.d],score:(a.score+b.score)/2+2+(a.d.category===b.d.category?14:0)})));
  return [...unique,...combos].sort((a,b)=>a.score-b.score);
 }
 for(const p of people){
  const valid=catalog.filter(d=>allowed(d,p,date,s));
  const ids=new Map<number,number>(),names=new Map<string,number>(),families=new Map<string,number>(),groups=new Map<string,number>();
  const add=<K,>(map:Map<K,number>,key:K,n:number)=>map.set(key,(map.get(key)??0)+n);
  const targetWeek=week(date);
  for(const h of history){const gap=distance(date,h.date);if(gap>120)continue;const meals=h.meals[p];for(const meal of new Map(meals.map(x=>[normalize(x.name),x])).values()){
    const penalty=140*Math.exp(-gap/(repeatInterval(meal,s)/2));
    add(ids,meal.id,penalty);add(names,normalize(meal.name),penalty);
   }
   if(gap<8)for(const f of new Set(meals.map(family)))add(families,f,(8-gap)*7);
   const groupPenalty=(gap<=3?(4-gap)*6:0)+(targetWeek===week(h.date)?10:0);
   if(groupPenalty)for(const g of new Set(meals.map(x=>x.category)))add(groups,g,groupPenalty);
  }
  const score=(d:Dish)=>{
   let value=noise.get(d.id)!+Math.max(ids.get(d.id)??0,names.get(normalize(d.name))??0)+(families.get(family(d))??0)+(groups.get(d.category)??0);
   if(old?.meals[p].some(x=>x.id===d.id))value+=500;
   return value;
  };
  scores[p]=new Map(valid.map(d=>[d.id,score(d)]));
  const options=choices(valid,d=>scores[p].get(d.id)!);
  if(!options.length)throw new Error(`No hay una comida completa para ${p} el ${date}. Revisa los platos disponibles y su temporada.`);
  best[p]=options[0];
 }
 const common=catalog.filter(d=>scores.Dani.has(d.id)&&scores.Marta.has(d.id));
 const shared=choices(common,d=>(scores.Dani.get(d.id)!+scores.Marta.get(d.id)!)/2)[0];
 const share=shared&&shared.score<=(best.Dani.score+best.Marta.score)/2+extraPreparationPenalty;
 for(const p of people)day.meals[p]=(share?shared.meal:best[p].meal).map(d=>({...d}));
 return day;
}
export function menuWarnings(menu:Menu,history:Day[]){const warnings:string[]=[];let repeats=0;const seen=[...history];for(const day of menu.days){for(const p of people)for(const dish of day.meals[p])if(seen.some(h=>distance(day.date,h.date)<repeatInterval(dish,menu.settings)&&h.meals[p].some(x=>x.id===dish.id||normalize(x.name)===normalize(dish.name))))repeats++;seen.push(day)}if(repeats)warnings.push(`Hay ${repeats} asignaciones repetidas antes de la separación orientativa de su complejidad. Es una preferencia; puedes cambiar esos días.`);if(menu.days.some(d=>people.some(p=>d.meals[p].some(x=>x.review))))warnings.push('El menú incluye platos marcados para revisión en vuestro Excel. Comprueba sus datos antes de confirmar.');return warnings}
export function generateMenu(month:string,catalog:Dish[],settings:Settings,menus:Record<string,Menu>,previous?:Menu):Menu{
 const history=Object.values(menus).filter(m=>m.month!==month&&m.status==='confirmed').flatMap(m=>m.days);
 const days:Day[]=[];const locked=previous?.days.filter(d=>d.locked&&monthDates(month,settings.days).includes(d.date))??[];
 for(const date of monthDates(month,settings.days)){const keep=locked.find(d=>d.date===date);if(keep){validateDay(keep,settings);days.push(keep)}else days.push(generateDay(date,catalog,settings,[...history,...locked,...days.filter(d=>!d.locked)],previous?.days.find(d=>d.date===date)))}
 const menu:Menu={month,status:'draft',days,settings:structuredClone(settings),updatedAt:new Date().toISOString(),warnings:[]};menu.warnings=menuWarnings(menu,history);return menu;
}
export function validateDay(day:Day,s:Settings){if(day.manual){if(day.manual.kind==='custom'&&(!day.manual.Dani.trim()||!day.manual.Marta.trim()))throw new Error('Completa la comida puntual de los dos.');return;}for(const p of people){const ds=day.meals[p];if(!ds.length||ds.some(d=>!allowed(d,p,day.date,s)))throw new Error(`La comida de ${p} del ${day.date} no cumple las preferencias.`);if(!(ds.length===1&&ds[0].type==='Único')&&!(ds.length===2&&ds[0].type==='Entrante'&&ds[1].type==='Principal'))throw new Error(`Falta completar la comida de ${p}.`)} }
