'use client';
import {useEffect,useMemo,useState,useRef} from 'react';
import {Download,Plus,Pencil,Trash2,Check,X} from 'lucide-react';
import {shoppingList} from '../lib/shopping';
import type {Dish,Menu,ShoppingStore,ShoppingItem} from '../lib/menu';
import {downloadText} from './catalog-transfer';
const number=(n:number)=>new Intl.NumberFormat('es',{maximumFractionDigits:3}).format(n);
export default function Shopping({initialMonth,menus,catalog,store,busy,onAction,onEdit}:{initialMonth:string;menus:Record<string,Menu>;catalog:Dish[];store?:ShoppingStore;busy:boolean;onAction:(a:Record<string,unknown>)=>Promise<unknown>;onEdit:(dish:Dish)=>void}){
 const confirmed=Object.values(menus).filter(m=>m.status==='confirmed').sort((a,b)=>b.month.localeCompare(a.month));
 const [month,setMonth]=useState(menus[initialMonth]?.status==='confirmed'?initialMonth:confirmed[0]?.month??'');
 const menu=menus[month]?.status==='confirmed'?menus[month]:confirmed[0];
 const end=menu?new Date(Date.UTC(Number(menu.month.slice(0,4)),Number(menu.month.slice(5)),0)).toISOString().slice(0,10):'';
 const [from,setFrom]=useState(menu?menu.month+'-01':''),[to,setTo]=useState(end);
 useEffect(()=>{setFrom(menu?menu.month+'-01':'');setTo(end)},[menu?.month,end]);
 const list=useMemo(()=>menu?shoppingList(menu,catalog,from,to):null,[menu,catalog,from,to]);
 const [edit,setEdit]=useState<ShoppingItem|null>(null),[name,setName]=useState(''),[quantity,setQuantity]=useState(''),[unit,setUnit]=useState('');
 const [editing,setEditing]=useState(false),[formError,setFormError]=useState('');const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(editing)dialog.current?.showModal();else dialog.current?.close()},[editing]);
 const items=store?.items??[];
 function start(item?:ShoppingItem){setEdit(item??null);setName(item?.name??'');setQuantity(item?.quantity?.toString()??'');setUnit(item?.unit??'');setFormError('');setEditing(true)}
 async function action(a:Record<string,unknown>){try{await onAction(a)}catch{}}
 function exportList(){downloadText('lista-de-la-compra.txt',['LISTA DE LA COMPRA',...items.map(i=>`${i.checked?'[x]':'[ ]'} ${i.name}: ${i.quantity===null?'Cantidad pendiente':number(i.quantity)} ${i.unit}`),'','DATOS PENDIENTES DEL MENÚ SELECCIONADO',...(list?.pending??[]).map(p=>`${p.name}: ${p.reason} (${p.dates.join(', ')})`)].join('\n'),'text/plain;charset=utf-8')}
 return <>
 <div className="catalog-actions"><button className="primary" disabled={busy} onClick={()=>start()}><Plus size={17}/>Añadir producto</button><button onClick={exportList} disabled={!items.length}><Download size={17}/>Exportar lista</button></div>
 <p className="footnote">La lista y las marcas se guardan. Las nuevas cantidades se suman a los productos pendientes del mismo nombre y unidad; lo comprado queda separado. Puedes editar cualquier producto sin cambiar la receta.</p>
 <dialog ref={dialog} aria-labelledby="shopping-dialog-title" onCancel={e=>{if(busy)e.preventDefault();else setEditing(false)}} onClick={e=>{if(e.target===dialog.current&&!busy)setEditing(false)}}>{editing&&<><div className="dialog-header"><h2 id="shopping-dialog-title">{edit?'Editar producto':'Añadir producto'}</h2><button aria-label="Cerrar" disabled={busy} onClick={()=>setEditing(false)}><X size={20}/></button></div><form onSubmit={async e=>{e.preventDefault();try{await onAction({action:edit?'shopping-update':'shopping-add',...(edit?{id:edit.id}:{}),product:{name,quantity:quantity?Number(quantity):null,unit}});setEditing(false)}catch(e){setFormError(e instanceof Error?e.message:'No se ha podido guardar.')}}}>
 <label>Producto<input required maxLength={240} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Cantidad<input type="number" min="0.001" max="1000000" step="any" placeholder="Sin especificar" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
 <label>Unidad<input maxLength={40} placeholder="ud, g, ml…" value={unit} onChange={e=>setUnit(e.target.value)}/></label>
 {formError&&<p className="dialog-error" role="alert">{formError}</p>}<div className="dialog-actions"><button type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancelar</button><button className="primary" disabled={busy}>{edit?'Guardar cambios':'Añadir'}</button></div></form></>}</dialog>
 <div className="shopping-section-heading"><h2 className="shopping-title">Pendiente de comprar · {items.filter(i=>!i.checked).length}</h2><button disabled={busy||!items.some(i=>!i.checked)} onClick={()=>void action({action:'shopping-check-all'})}><Check size={17}/>Marcar todo como comprado</button></div>
 {!items.length&&<div className="empty compact"><h3>Tu lista está vacía</h3><p>Añade cualquier producto o incorpora las cantidades de un menú confirmado.</p></div>}
 {[false,true].map(checked=><section key={String(checked)}>{checked&&items.some(i=>i.checked)&&<div className="shopping-section-heading"><h2 className="shopping-title">Comprado</h2><button disabled={busy} onClick={()=>void action({action:'shopping-clear-checked'})}><Trash2 size={17}/>Limpiar comprados</button></div>}<div className="shopping-list">{items.filter(i=>i.checked===checked).map(i=><div className="shopping-item" key={i.id}>
 <label><input type="checkbox" disabled={busy} checked={i.checked} onChange={e=>void action({action:'shopping-check',id:i.id,checked:e.target.checked})}/><span className={i.checked?'bought':''}>{i.name}</span><strong>{i.quantity===null?'Sin cantidad':number(i.quantity)} {i.unit}</strong></label>
 <div className="shopping-row-actions"><button aria-label={'Editar '+i.name} disabled={busy} onClick={()=>start(i)}><Pencil size={15}/>Editar</button><button aria-label={'Eliminar '+i.name} disabled={busy} onClick={()=>void action({action:'shopping-remove',id:i.id})}><Trash2 size={15}/>Eliminar</button></div>
 {i.uses.length>0&&<details><summary>Ver platos y días</summary>{i.uses.map(u=><p key={u}>{u}</p>)}</details>}</div>)}</div></section>)}
 {menu&&list?<section className="shopping-pending"><h2>Añadir desde un menú</h2><div className="filters shopping-filters"><label>Menú confirmado<select value={menu.month} onChange={e=>setMonth(e.target.value)}>{confirmed.map(m=><option key={m.month}>{m.month}</option>)}</select></label><label>Desde<input type="date" min={menu.month+'-01'} max={end} value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" min={from} max={end} value={to} onChange={e=>setTo(e.target.value)}/></label><button disabled={busy||!from||!to||from>to} onClick={()=>void action({action:'shopping-include',month:menu.month,from,to})}><Plus size={17}/>Añadir cantidades nuevas</button></div>
 <p>Al confirmar un menú se añaden sus cantidades automáticamente. Este botón incorpora menús anteriores o ingredientes completados después, sin duplicar lo ya añadido, incluso con periodos solapados.</p>
 <p className="footnote">Se incorporan solo cantidades nuevas o aumentos. Si reduces una receta o cambias el menú, ajusta la lista manualmente para respetar lo que ya has editado o comprado. Los productos eliminados no se recuperan al añadir otra vez el mismo periodo.</p>
 <p>{list.readyPortions} de {list.portions} raciones con cantidades completas.</p>
 {list.pending.length>0&&<><h3>Datos pendientes</h3><p>Las cantidades disponibles pueden añadirse aunque la receta esté pendiente de revisión.</p>{list.pending.map((p,n)=><div key={n}><span><strong>{p.name}</strong><small>{p.reason} {p.dates.join(', ')}</small></span>{p.dishId&&catalog.some(d=>d.id===p.dishId)&&<button onClick={()=>onEdit(catalog.find(d=>d.id===p.dishId)!)}>Editar receta</button>}</div>)}</>}
 </section>:<p className="footnote">Cuando confirmes un menú, sus ingredientes se añadirán a esta lista.</p>}
 </>;
}
