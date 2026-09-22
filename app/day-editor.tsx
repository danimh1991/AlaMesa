'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,X,RefreshCw,Sparkles,Search} from 'lucide-react';
import {allowed,manualEntries,mealsFor,normalize,personalFor,type Diner,type Day,type Dish,type ManualMeal,type MealType,type Settings} from '../lib/menu';
import {pendingRecipe,type Recipe} from '../lib/recipes';

type Mode='out'|'tupper'|'custom'|'dish';
type DayMode='people'|'empty'|'dish';
type Edit={mode:Mode|'generate'|'suggest';person:string;mealType:MealType;note?:string;dishId?:number};
type Props={day:Day;diners:Diner[];mealTypes:MealType[];catalog:Dish[];settings:Settings;busy:boolean;error:string;onClose:()=>void;onSave:(value:ManualMeal)=>Promise<void>;onSharedDish:(dishId:number,mealType:MealType)=>Promise<void>;onPerson:(edit:Edit)=>Promise<string|undefined>;onRecipe:(recipe:Recipe,person:string,mealType:MealType)=>void};
const key=(type:MealType,person:string)=>`${type}:${person}`;

export default function DayEditor({day,diners,mealTypes,catalog,settings,busy,error,onClose,onSave,onSharedDish,onPerson,onRecipe}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const [dayMode,setDayMode]=useState<DayMode>(day.manual?.kind==='empty'?'empty':'people');
 const [note,setNote]=useState(day.manual&&day.manual.kind!=='custom'?day.manual.note:'');
 const [modes,setModes]=useState<Record<string,Mode>>(()=>Object.fromEntries(mealTypes.flatMap(type=>diners.map(p=>{const personal=personalFor(day,type)[p.id];return [key(type,p.id),personal&&personal.kind!=='suggestion'&&personal.kind!=='empty'?personal.kind:day.manual?.kind==='out'?'out':'custom']}))));
 const [notes,setNotes]=useState<Record<string,string>>(()=>Object.fromEntries(mealTypes.flatMap(type=>diners.map(p=>{const personal=personalFor(day,type)[p.id],current=(mealsFor(day,type)[p.id]??[]).map(d=>d.name).join(' + ');return [key(type,p.id),personal?.kind==='suggestion'?personal.recipe.name:personal?personal.note:day.manual?.kind==='custom'?manualEntries(day.manual)[p.id]??'':current]}))));
 const [generated,setGenerated]=useState<Record<string,string>>({});
 const [queries,setQueries]=useState<Record<string,string>>({});
 const [selectedDishes,setSelectedDishes]=useState<Record<string,number|undefined>>({});
 const [sharedQuery,setSharedQuery]=useState('');
 const [sharedDishId,setSharedDishId]=useState<number>();
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

 const sharedOptions=sharedDishOptions(sharedQuery),sharedSelected=catalog.find(d=>d.id===sharedDishId);
 return <dialog className="day-editor" ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===dialog.current&&!busy)onClose()}}>
  <div className="dialog-header"><div><p className="eyebrow">{new Date(day.date+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p><h2>Editar menú del día</h2></div><button aria-label="Cerrar edición del día" disabled={busy} onClick={onClose}><X size={20}/></button></div>
  <label>¿Qué hacemos este día?<select value={dayMode} disabled={busy} onChange={e=>setDayMode(e.target.value as DayMode)}><option value="people">Editar por comensal</option><option value="empty">Dejar sin planificar</option><option value="dish">Selección manual</option></select></label>
  {dayMode==='empty'?<form onSubmit={async e=>{e.preventDefault();try{await onSave({kind:'empty',note:note.trim()})}catch{}}}><label>Nota opcional<textarea maxLength={240} rows={2} placeholder="Puedes dejarlo vacío" value={note} onChange={e=>setNote(e.target.value)}/></label><p className="footnote">No se asignarán platos a este día.</p><button className="primary" disabled={busy}><Check size={17}/>Guardar día</button></form>:
  dayMode==='dish'?<form className="shared-dish-form" onSubmit={async e=>{e.preventDefault();if(!sharedSelected){setMessage('Busca y selecciona un plato antes de guardar.');return}setMessage('');try{await onSharedDish(sharedSelected.id,sharedSelected.mealType)}catch{}}}><div className="manual-dish-picker"><label>Buscar un plato para todos<div className="manual-dish-search"><Search size={17}/><input disabled={busy} autoComplete="off" placeholder="Escribe el nombre del plato" value={sharedQuery} onChange={e=>{setSharedQuery(e.target.value);setSharedDishId(undefined)}}/></div></label>{sharedSelected&&<p className="selected-dish"><Check size={15}/><span><strong>{sharedSelected.name}</strong><small>{sharedSelected.mealType} · {sharedSelected.category} · {sharedSelected.type}</small></span></p>}{sharedQuery.trim()&&!sharedSelected&&<div className="manual-dish-results">{sharedOptions.length?sharedOptions.map(d=><button type="button" key={d.id} onClick={()=>{setSharedDishId(d.id);setSharedQuery(d.name)}}><strong>{d.name}</strong><small>{d.mealType} · {d.category} · {d.type}</small></button>):<p>No hay platos compatibles para todos con esta búsqueda.</p>}</div>}</div><button className="primary shared-dish-save" disabled={busy||!sharedSelected}><Check size={17}/>Guardar para todos</button></form>:
  <div className="meal-type-editors">{mealTypes.map(type=><section className="meal-type-editor" key={type}><h3>{type}</h3>{diners.map(p=>{
   const k=key(type,p.id),mode=modes[k],personal=personalFor(day,type)[p.id],shared=type==='Comida'?pendingRecipe(day):undefined,suggestion=personal?.kind==='suggestion'?personal.recipe:shared,options=dishOptions(type,p.id,queries[k]??''),selected=catalog.find(d=>d.id===selectedDishes[k]);
   return <section className="person-editor" key={p.id}><h4>{p.name}</h4><p className="current-meal">{description(type,p.id)}</p>
    {suggestion&&<button disabled={busy} onClick={()=>onRecipe(suggestion,p.id,type)}>Ver y aceptar para {p.name}</button>}
    <form onSubmit={e=>{e.preventDefault();if(mode==='dish'&&!selectedDishes[k]){setMessage('Busca y selecciona un plato antes de guardar.');return}void change({person:p.id,mealType:type,mode,note:notes[k],dishId:selectedDishes[k]})}}>
     <label>Opción para {p.name}<select disabled={busy} value={mode} onChange={e=>{const nextMode=e.target.value as Mode;setModes({...modes,[k]:nextMode});if(nextMode==='tupper'||nextMode==='out')setNotes(old=>({...old,[k]:''}));setGenerated(old=>{const next={...old};delete next[k];return next})}}><option value="tupper">Tupper</option><option value="out">Fuera</option><option value="custom">Comida puntual</option><option value="dish">Selección manual</option></select></label>
     {mode==='dish'?<div className="manual-dish-picker"><label>Buscar en nuestros platos<div className="manual-dish-search"><Search size={17}/><input disabled={busy} autoComplete="off" placeholder="Escribe el nombre del plato" value={queries[k]??''} onChange={e=>{setQueries({...queries,[k]:e.target.value});setSelectedDishes({...selectedDishes,[k]:undefined})}}/></div></label>{selected&&<p className="selected-dish"><Check size={15}/><span><strong>{selected.name}</strong><small>{selected.category} · {selected.type}</small></span></p>}{(queries[k]??'').trim()&&!selected&&<div className="manual-dish-results">{options.length?options.map(d=><button type="button" key={d.id} onClick={()=>{setSelectedDishes({...selectedDishes,[k]:d.id});setQueries({...queries,[k]:d.name})}}><strong>{d.name}</strong><small>{d.category} · {d.type}</small></button>):<p>No hay platos compatibles con esta búsqueda.</p>}</div>}</div>:
     <label>{generated[k]||mode==='custom'?'Qué va a comer':'Nota opcional'}<input required={mode==='custom'} readOnly={!!generated[k]} disabled={busy} maxLength={240} value={notes[k]??''} onChange={e=>setNotes({...notes,[k]:e.target.value})}/></label>}
     <div className="person-actions"><button disabled={busy||(mode==='dish'&&!selectedDishes[k])}>Guardar {mode==='out'?'fuera':mode==='tupper'?'tupper':mode==='dish'?'selección':'comida puntual'}</button>{mode==='custom'&&<><button type="button" disabled={busy} onClick={()=>void change({person:p.id,mealType:type,mode:'generate'})}><RefreshCw size={16}/>Generar plato</button><button type="button" disabled={busy} onClick={()=>void change({person:p.id,mealType:type,mode:'suggest'})}><Sparkles size={16}/>Pedir receta</button></>}</div>
    </form>
   </section>})}</section>)}</div>}
  {dayMode!=='empty'&&<p className="footnote">La selección manual busca platos compatibles de vuestro catálogo y conserva sus ingredientes para la lista de la compra. Generar plato y pedir receta están disponibles en Comida puntual.</p>}
  {message&&<p className="message success" role="status">{message}</p>}{error&&<p className="dialog-error" role="alert">{error}</p>}<div className="dialog-actions"><button disabled={busy} onClick={onClose}>Cerrar</button></div>
 </dialog>;
}
