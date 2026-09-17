'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,LockKeyhole,X} from 'lucide-react';
import {manualEntries,type Diner,type Day,type ManualMeal} from '../lib/menu';
export default function DayEditor({day,diners,busy,error,onClose,onSave}:{day:Day;diners:Diner[];busy:boolean;error:string;onClose:()=>void;onSave:(value:ManualMeal)=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [kind,setKind]=useState<ManualMeal['kind']>(day.manual?.kind??'custom');
 const [entries,setEntries]=useState<Record<string,string>>(()=>Object.fromEntries(diners.map(p=>[p.id,day.manual?.kind==='custom'?manualEntries(day.manual)[p.id]??'':(day.meals[p.id]??[]).map(d=>d.name).join(' + ')])));
 const [same,setSame]=useState(new Set(Object.values(entries)).size<=1);
 const [note,setNote]=useState(day.manual&&day.manual.kind!=='custom'?day.manual.note:'');
 useEffect(()=>{dialog.current?.showModal()},[]);
 return <dialog ref={dialog} onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose()}}><form onSubmit={async e=>{e.preventDefault();const manual:ManualMeal=kind==='custom'?{kind,entries:Object.fromEntries(diners.map(p=>[p.id,(entries[same?diners[0].id:p.id]??'').trim()]))}:{kind,note:note.trim()};try{await onSave(manual)}catch{}}}>
 <div className="dialog-header"><div><p className="eyebrow">{new Date(day.date+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p><h2>Editar comida del día</h2></div><button type="button" aria-label="Cerrar edición del día" onClick={onClose}><X size={20}/></button></div>
 <label>¿Qué hacemos este día?<select value={kind} onChange={e=>setKind(e.target.value as ManualMeal['kind'])}><option value="custom">Comida puntual / tupper</option><option value="out">Comemos fuera</option><option value="empty">Dejar sin planificar</option></select></label>
 {kind==='custom'?<><label className="check"><input type="checkbox" checked={same} onChange={e=>setSame(e.target.checked)}/>La misma comida para todos</label>{(same?diners.slice(0,1):diners).map(p=><label key={p.id}>{same?'¿Qué vais a comer?':'Comida de '+p.name}<textarea required maxLength={240} rows={3} value={entries[p.id]??''} onChange={e=>setEntries({...entries,[p.id]:e.target.value})}/></label>)}<p className="footnote">Esta anotación es solo para este día. No añade un plato al catálogo ni cuenta en la rotación automática.</p></>:<><label>Nota opcional<textarea maxLength={240} rows={2} placeholder={kind==='out'?'Por ejemplo: comida en casa de amigos':'Puedes dejarlo vacío'} value={note} onChange={e=>setNote(e.target.value)}/></label><p className="footnote">No se asignarán platos a este día.</p></>}
 <div className="manual-info"><LockKeyhole size={16}/><span>Se bloqueará este día para conservarlo al regenerar el mes.</span></div><p className="footnote">Para volver a una propuesta automática, desbloquea el día y pulsa refrescar.</p>
 {error&&<p className="dialog-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}><Check size={17}/>Guardar día</button></div>
 </form></dialog>
}
