'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,X,RefreshCw,Sparkles,Search} from 'lucide-react';
import {allowed,manualEntries,mealsFor,normalize,personalFor,type Diner,type Day,type Dish,type ManualMeal,type MealType,type Settings} from '../lib/menu';
import {pendingRecipe,type Recipe} from '../lib/recipes';

type Mode='out'|'tupper'|'custom'|'dish';
type DayMode='people'|'empty'|'dish';
type Edit={mode:Mode|'generate'|'suggest';person:string;mealType:MealType;note?:string;dishId?:number;dishIds?:number[]};
type Props={day:Day;diners:Diner[];mealTypes:MealType[];catalog:Dish[];settings:Settings;busy:boolean;error:string;onClose:()=>void;onSave:(value:ManualMeal)=>Promise<void>;onSharedDish:(dishIds:number[],mealType:MealType)=>Promise<void>;onPerson:(edit:Edit)=>Promise<string|undefined>;onRecipe:(recipe:Recipe,person:string,mealType:MealType)=>void};
const key=(type:MealType,person:string)=>`${type}:${person}`;

export default function DayEditor({day,diners,mealTypes,catalog,settings,busy,error,onClose,onSave,onSharedDish,onPerson,onRecipe}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const [dayMode,setDayMode]=useState<DayMode>(day.manual?.kind==='empty'?'empty':'people');
 const [note,setNote]=useState(day.manual&&day.manual.kind!=='custom'?day.manual.note:'');
 const [modes,setModes]=useState<Record<string,Mode>>(()=>Object.fromEntries(mealTypes.flatMap(type=>diners.map(p=>{const personal=personalFor(day,type)[p.id];return [key(type,p.id),personal&&personal.kind!=='suggestion'&&personal.kind!=='empty'?personal.kind:day.manual?.kind==='out'?'out':'custom']}))));
 const [notes,setNotes]=useState<Record<string,string>>(()=>Object.fromEntries(mealTypes.flatMap(type=>diners.map(p=>{const personal=personalFor(day,type)[p.id],current=(mealsFor(day,type)[p.id]??[]).map(d=>d.name).join(' + ');return [key(type,p.id),personal?.kind==='suggestion'?personal.recipe.name:personal?personal.note:day.manual?.kind==='custom'?manualEntries(day.manual)[p.id]??'':current]}))));
 const [generated,setGenerated]=useState<Record<string,string>>({});
 const [queries,setQueries]=useState<Record<string,string>>({});
 const [selectedDishes,setSelectedDishes]=useState<Record<string,number[]>>(()=>Object.fromEntries(mealTypes.flatMap(type=>diners.map(p=>[key(type,p.id),(mealsFor(day,type)[p.id]??[]).filter(d=>d.type!=='Guarnición').map(d=>d.id)]))));
 const [sharedQuery,setSharedQuery]=useState('');
 const [sharedDishIds,setSharedDishIds]=useState<number[]>([]);
 const [message,setMessage]=useState('');
 useEffect(()=>{dialog.current?.showModal()},[]);

 async function change(edit:Edit){
  setMessage('');
  try{
   const meal=await onPerson(edit),k=key(edit.mealType,edit.person);
   if(edit.mode==='generate'&&meal){setGenerated(old=>({...old,[k]:meal}));setNotes(old=>({...old,[k]:meal}))}
   setMessage(`${edit.mealType} de ${diners.find(p=>p.id===edit.person)?.name} guardada. Las demás se han conservado.`);
  }catch{}
 }
 function description(type:MealType,person:string){
  const personal=personalFor(day,type)[person],shared=type==='Comida'?pendingRecipe(day):undefined,suggestion=personal?.kind==='suggestion'?personal.recipe:shared;
  if(suggestion)return 'Por probar: '+suggestion.name;
  if(personal)return personal.kind==='out'?'Fuera'+(personal.note?' · '+personal.note:''):personal.kind==='tupper'?'Tupper'+(personal.note?' · '+personal.note:''):personal.kind==='custom'?personal.note:'Sin planificar';
  return (mealsFor(day,type)[person]??[]).map(d=>d.name).join(' + ')||'Sin planificar';
 }
 function dishOptions(type:MealType,person:string,query:string){
  const q=normalize(query);
  if(!q)return [];
  return catalog.filter(d=>d.type!=='Guarnición'&&allowed(d,person,day.date,settings,type)&&normalize(d.name).includes(q)).sort((a,b)=>normalize(a.name).startsWith(q)===normalize(b.name).startsWith(q)?a.name.localeCompare(b.name,'es'):normalize(a.name).startsWith(q)?-1:1).slice(0,8);
 }
 function sharedDishOptions(query:string){
  const q=normalize(query);
  if(!q)return [];
  return catalog.filter(d=>d.type!=='Guarnición'&&mealTypes.includes(d.mealType)&&diners.every(p=>allowed(d,p.id,day.date,settings,d.mealType))&&normalize(d.name).includes(q)).sort((a,b)=>normalize(a.name).startsWith(q)===normalize(b.name).startsWith(q)?a.name.localeCompare(b.name,'es'):normalize(a.name).startsWith(q)?-1:1).slice(0,8);
 }
 function addDish(ids:number[],dish:Dish){
  if(dish.type==='Único')return [dish.id];
  return [...ids.filter(id=>{const current=catalog.find(d=>d.id===id);return current&&current.type!=='Único'&&current.type!==dish.type}),dish.id].sort((a,b)=>(catalog.find(d=>d.id===a)?.type==='Entrante'?-1:1)-(catalog.find(d=>d.id===b)?.type==='Entrante'?-1:1));
 }
 function complete(ids:number[]){const dishes=ids.map(id=>catalog.find(d=>d.id===id)).filter((d):d is Dish=>!!d);return dishes.length===1&&dishes[0].type==='Único'||dishes.length===2&&dishes.some(d=>d.type==='Entrante')&&dishes.some(d=>d.type==='Principal')}

 const sharedSelected=sharedDishIds.map(id=>catalog.find(d=>d.id===id)).filter((d):d is Dish=>!!d),sharedMealType=sharedSelected[0]?.mealType,sharedOptions=sharedDishOptions(sharedQuery).filter(d=>!sharedMealType||d.mealType===sharedMealType);
 return <dialog className="day-editor" ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===dialog.current&&!busy)onClose()}}>
  <div className="dialog-header"><div><p className="eyebrow">{new Date(day.date+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p><h2>Editar menú del día</h2></div><button aria-label="Cerrar edición del día" disabled={busy} onClick={onClose}><X size={20}/></button></div>
  <label>¿Qué hacemos este día?<select value={dayMode} disabled={busy} onChange={e=>setDayMode(e.target.value as DayMode)}><option value="people">Editar por comensal</option><option value="empty">Dejar sin planificar</option><option value="dish">Selección manual</option></select></label>
  {dayMode==='empty'?<form onSubmit={async e=>{e.preventDefault();try{await onSave({kind:'empty',note:note.trim()})}catch{}}}><label>Nota opcional<textarea maxLength={240} rows={2} placeholder="Puedes dejarlo vacío" value={note} onChange={e=>setNote(e.target.value)}/></label><p className="footnote">No se asignarán platos a este día.</p><button className="primary" disabled={busy}><Check size={17}/>Guardar día</button></form>:
  dayMode==='dish'?<form className="shared-dish-form" onSubmit={async e=>{e.preventDefault();if(!complete(sharedDishIds)||!sharedMealType){setMessage('Selecciona un plato único o la combinación de entrante y principal.');return}setMessage('');try{await onSharedDish(sharedDishIds,sharedMealType)}catch{}}}><div className="manual-dish-picker"><label>Buscar platos para todos<div className="manual-dish-search"><Search size={17}/><input disabled={busy} autoComplete="off" placeholder={sharedSelected.some(d=>d.type==='Entrante')?'Busca el plato principal':'Escribe el nombre del plato'} value={sharedQuery} onChange={e=>setSharedQuery(e.target.value)}/></div></label>{sharedSelected.map(d=><p className="selected-dish" key={d.id}><Check size={15}/><span><strong>{d.name}</strong><small>{d.mealType} · {d.category} · {d.type}</small></span><button type="button" aria-label={`Quitar ${d.name}`} onClick={()=>setSharedDishIds(ids=>ids.filter(id=>id!==d.id))}><X size={15}/></button></p>)}{sharedQuery.trim()&&<div className="manual-dish-results">{sharedOptions.length?sharedOptions.map(d=><button type="button" key={d.id} onClick={()=>{setSharedDishIds(ids=>addDish(ids,d));setSharedQuery('')}}><strong>{d.name}</strong><small>{d.mealType} · {d.category} · {d.type}</small></button>):<p>No hay platos compatibles para todos con esta búsqueda.</p>}</div>}{sharedSelected.length===1&&sharedSelected[0].type!=='Único'&&<p className="footnote">Añade también {sharedSelected[0].type==='Entrante'?'un plato principal':'un entrante'}.</p>}</div><button className="primary shared-dish-save" disabled={busy||!complete(sharedDishIds)}><Check size={17}/>Guardar para todos</button></form>:
  <div className="meal-type-editors">{mealTypes.map(type=><section className="meal-type-editor" key={type}><h3>{type}</h3>{diners.map(p=>{
   const k=key(type,p.id),mode=modes[k],personal=personalFor(day,type)[p.id],shared=type==='Comida'?pendingRecipe(day):undefined,suggestion=personal?.kind==='suggestion'?personal.recipe:shared,selectedIds=selectedDishes[k]??[],selected=selectedIds.map(id=>catalog.find(d=>d.id===id)).filter((d):d is Dish=>!!d),options=dishOptions(type,p.id,queries[k]??'').filter(d=>!selectedIds.includes(d.id));
   return <section className="person-editor" key={p.id}><h4>{p.name}</h4><p className="current-meal">{description(type,p.id)}</p>
    {suggestion&&<button disabled={busy} onClick={()=>onRecipe(suggestion,p.id,type)}>Ver y aceptar para {p.name}</button>}
    <form onSubmit={e=>{e.preventDefault();if(mode==='dish'&&!complete(selectedIds)){setMessage('Selecciona un plato único o la combinación de entrante y principal.');return}void change({person:p.id,mealType:type,mode,note:notes[k],dishIds:selectedIds})}}>
     <label>Opción para {p.name}<select disabled={busy} value={mode} onChange={e=>{const nextMode=e.target.value as Mode;setModes({...modes,[k]:nextMode});if(nextMode==='tupper'||nextMode==='out')setNotes(old=>({...old,[k]:''}));setGenerated(old=>{const next={...old};delete next[k];return next})}}><option value="tupper">Tupper</option><option value="out">Fuera</option><option value="custom">Comida puntual</option><option value="dish">Selección manual</option></select></label>
     {mode==='dish'?<div className="manual-dish-picker"><label>Buscar en nuestros platos<div className="manual-dish-search"><Search size={17}/><input disabled={busy} autoComplete="off" placeholder={selected.some(d=>d.type==='Entrante')&&!selected.some(d=>d.type==='Principal')?'Busca el plato principal':'Escribe el nombre del plato'} value={queries[k]??''} onChange={e=>setQueries({...queries,[k]:e.target.value})}/></div></label>{selected.map(d=><p className="selected-dish" key={d.id}><Check size={15}/><span><strong>{d.name}</strong><small>{d.category} · {d.type}</small></span><button type="button" aria-label={`Quitar ${d.name}`} onClick={()=>setSelectedDishes({...selectedDishes,[k]:selectedIds.filter(id=>id!==d.id)})}><X size={15}/></button></p>)}{(queries[k]??'').trim()&&<div className="manual-dish-results">{options.length?options.map(d=><button type="button" key={d.id} onClick={()=>{setSelectedDishes({...selectedDishes,[k]:addDish(selectedIds,d)});setQueries({...queries,[k]:''})}}><strong>{d.name}</strong><small>{d.category} · {d.type}</small></button>):<p>No hay platos compatibles con esta búsqueda.</p>}</div>}{selected.length===1&&selected[0].type!=='Único'&&<p className="footnote">Añade también {selected[0].type==='Entrante'?'un plato principal':'un entrante'}.</p>}</div>:
     <label>{generated[k]||mode==='custom'?'Qué va a comer':'Nota opcional'}<input required={mode==='custom'} readOnly={!!generated[k]} disabled={busy} maxLength={240} value={notes[k]??''} onChange={e=>setNotes({...notes,[k]:e.target.value})}/></label>}
     <div className="person-actions"><button disabled={busy||(mode==='dish'&&!complete(selectedIds))}>Guardar {mode==='out'?'fuera':mode==='tupper'?'tupper':mode==='dish'?'selección':'comida puntual'}</button>{mode==='custom'&&<><button type="button" disabled={busy} onClick={()=>void change({person:p.id,mealType:type,mode:'generate'})}><RefreshCw size={16}/>Generar plato</button><button type="button" disabled={busy} onClick={()=>void change({person:p.id,mealType:type,mode:'suggest'})}><Sparkles size={16}/>Pedir receta</button></>}</div>
    </form>
   </section>})}</section>)}</div>}
  {dayMode!=='empty'&&<p className="footnote">La selección manual busca platos compatibles de vuestro catálogo y conserva sus ingredientes para la lista de la compra. Generar plato y pedir receta están disponibles en Comida puntual.</p>}
  {message&&<p className="message success" role="status">{message}</p>}{error&&<p className="dialog-error" role="alert">{error}</p>}<div className="dialog-actions"><button disabled={busy} onClick={onClose}>Cerrar</button></div>
 </dialog>;
}
