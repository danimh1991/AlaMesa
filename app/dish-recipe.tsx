'use client';
import {useEffect,useRef,useState} from 'react';
import {X,Plus,Pencil,Check,Trash2,BookOpen} from 'lucide-react';
import {recipeFor} from '../lib/shopping';
import {normalize,type Dish,type RecipeDetails} from '../lib/menu';
import references from '../lib/recipes.json';

const fmt=(q:number|null)=>q===null?'':new Intl.NumberFormat('es',{maximumFractionDigits:3}).format(q);

type Props={dish:Dish;editing:boolean;busy:boolean;error:string;onClose:()=>void;onEdit:()=>void;onCancelEdit:()=>void;onSave:(recipe:RecipeDetails)=>Promise<void>};

export default function DishRecipe({dish,editing,busy,error,onClose,onEdit,onCancelEdit,onSave}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const [value,setValue]=useState(()=>recipeFor(dish));
 const [searching,setSearching]=useState(false);
 const [query,setQuery]=useState(dish.name.split(' ')[0]);
 useEffect(()=>{dialog.current?.showModal()},[]);
 function beginEdit(){setValue(recipeFor(dish));setSearching(false);onEdit()}
 function ingredient(index:number,key:string,v:unknown){setValue({...value,ingredients:value.ingredients.map((item,n)=>n===index?{...item,[key]:v}:item),reviewed:false})}
 const results=references.filter(recipe=>normalize(recipe.name).includes(normalize(query))).slice(0,12);
 const detail=recipeFor(dish);

 return <dialog ref={dialog} className="recipe-dialog" onCancel={onClose} onClick={event=>{if(event.target===dialog.current)onClose()}}>
  <div className="dialog-header"><div><p className="eyebrow">VUESTRA RECETA</p><h2>{dish.name}</h2></div><button onClick={onClose} aria-label="Cerrar ficha de receta"><X size={20}/></button></div>
  {!editing?<>
   <p className="footnote">{detail.servings?`Cantidades para ${detail.servings} raciones.`:'Raciones pendientes de indicar.'} {detail.reviewed?'Revisada para la lista de la compra.':'Pendiente de revisión para la compra.'}</p>
   {detail.ingredients.length||detail.steps.length?<div className="recipe-detail"><section><h3>Ingredientes</h3><ul>{detail.ingredients.map((item,n)=><li key={n}>{fmt(item.quantity)} {item.unit} {item.name}{item.notes&&` · ${item.notes}`}</li>)}</ul></section><section><h3>Preparación</h3><ol>{detail.steps.map((step,n)=><li key={n}>{step}</li>)}</ol></section></div>:<div className="empty compact"><BookOpen size={30}/><h3>Todavía no hay receta</h3><p>Añade vuestra forma de prepararlo o utiliza una receta de referencia.</p></div>}
   {detail.notes&&<p className="recipe-note">{detail.notes}</p>}{detail.sourceUrl&&<a href={detail.sourceUrl} target="_blank" rel="noreferrer">Ver fuente original</a>}
   <div className="dialog-actions"><button onClick={onClose}>Cerrar</button><button className="primary" disabled={busy} onClick={beginEdit}><Pencil size={17}/>Editar receta</button></div>
  </>:<form onSubmit={async event=>{event.preventDefault();try{await onSave({...value,steps:value.steps.map(step=>step.trim()).filter(Boolean)})}catch{}}}>
   <p className="footnote">Indica las raciones que producen estas cantidades. La compra ajustará cada plato al número de comensales que lo tengan asignado en el menú.</p>
   <button type="button" onClick={()=>setSearching(!searching)}><BookOpen size={16}/>Buscar receta de referencia</button>
   {searching&&<section className="reference-search"><label>Buscar referencia en español<input value={query} onChange={event=>setQuery(event.target.value)}/></label>{results.map(recipe=><button key={recipe.id} type="button" onClick={()=>{setValue(structuredClone(recipe.details));setSearching(false)}}>{recipe.name}</button>)}{!results.length&&<p>No hay coincidencias en la selección disponible. Puedes escribir vuestra receta.</p>}<p className="footnote">Usar una referencia sustituye solo el borrador de esta ficha. Revisa ingredientes y raciones antes de guardarla.</p></section>}
   <label>Raciones de la receta<input type="number" min="0.1" max="1000" step="any" placeholder="Sin especificar" value={value.servings??''} onChange={event=>setValue({...value,servings:event.target.value?Number(event.target.value):null,reviewed:false})}/></label>
   <h3>Ingredientes para esas raciones</h3><p className="footnote">Separa el nombre de la cantidad: «Arroz», «160», «g». Para «al gusto», deja la cantidad vacía y anótalo en el nombre; aparecerá como pendiente de revisar.</p>
   <datalist id="ingredient-units">{['g','kg','ml','l','ud','diente','cucharada','cucharadita','taza','lata','manojo','pizca'].map(unit=><option key={unit} value={unit}/>)}</datalist>
   {value.ingredients.map((item,n)=><div className="ingredient-row" key={n}><label>Ingrediente {n+1}<input required maxLength={240} value={item.name} onChange={event=>ingredient(n,'name',event.target.value)}/></label><label>Cantidad<input type="number" min="0.001" max="1000000" step="any" value={item.quantity??''} onChange={event=>ingredient(n,'quantity',event.target.value?Number(event.target.value):null)}/></label><label>Unidad<input list="ingredient-units" maxLength={40} value={item.unit} onChange={event=>ingredient(n,'unit',event.target.value)}/></label><button type="button" aria-label={`Quitar ingrediente ${n+1}`} onClick={()=>setValue({...value,ingredients:value.ingredients.filter((_,index)=>index!==n),reviewed:false})}><Trash2 size={16}/></button></div>)}
   <button type="button" disabled={value.ingredients.length>=100} onClick={()=>setValue({...value,ingredients:[...value.ingredients,{name:'',quantity:null,unit:''}],reviewed:false})}><Plus size={16}/>Añadir ingrediente</button>
   <label>Preparación · un paso por línea<textarea rows={7} value={value.steps.join('\n')} onChange={event=>setValue({...value,steps:event.target.value.split('\n')})}/></label>
   <label>Fuente o enlace original<input type="url" value={value.sourceUrl} onChange={event=>setValue({...value,sourceUrl:event.target.value})}/></label>
   <label>Notas<textarea rows={3} maxLength={5000} value={value.notes} onChange={event=>setValue({...value,notes:event.target.value})}/></label>
   <label className="check"><input type="checkbox" disabled={!value.servings||!value.ingredients.length||value.ingredients.some(item=>!item.name.trim())} checked={value.reviewed} onChange={event=>setValue({...value,reviewed:event.target.checked})}/>He revisado ingredientes y raciones para calcular la compra</label>
   {error&&<p className="dialog-error" role="alert">{error}</p>}
   <div className="dialog-actions"><button type="button" onClick={onCancelEdit}>Cancelar edición</button><button className="primary" disabled={busy}><Check size={17}/>Guardar receta</button></div>
  </form>}
 </dialog>;
}
