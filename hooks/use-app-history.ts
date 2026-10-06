'use client';

import {useCallback,useRef,useState,useSyncExternalStore} from 'react';

const STATE_KEY='__alaMesaNavigationV1';
const CHANGE_EVENT='ala-mesa-navigation';

type StoredNavigation<T>={version:1;session:string;index:number;value:T};
type PendingBack<T>={session:string;value:T}|null;

function stored<T>(state:unknown):StoredNavigation<T>|null{
 if(!state||typeof state!=='object')return null;
 const candidate=(state as Record<string,unknown>)[STATE_KEY];
 if(!candidate||typeof candidate!=='object')return null;
 const entry=candidate as Partial<StoredNavigation<T>>;
 return entry.version===1&&typeof entry.session==='string'&&typeof entry.index==='number'&&'value' in entry?entry as StoredNavigation<T>:null;
}

function withStored<T>(state:unknown,entry:StoredNavigation<T>){
 return {...(state&&typeof state==='object'?state:{}),[STATE_KEY]:entry};
}

export function useAppHistory<T>(initial:T){
 const [base]=useState(initial);
 const pendingBack=useRef<PendingBack<T>>(null);

 const install=useCallback(()=>{
  const existing=stored<T>(window.history.state);
  if(existing)return existing;
  const entry:StoredNavigation<T>={version:1,session:crypto.randomUUID(),index:0,value:base};
  window.history.replaceState(withStored(window.history.state,entry),'');
  return entry;
 },[base]);

 const subscribe=useCallback((notify:()=>void)=>{
  install();
  const onPopState=(event:PopStateEvent)=>{
   const next=stored<T>(event.state);
   const pending=pendingBack.current;
   if(next&&pending&&pending.session===next.session){
    pendingBack.current=null;
    const replaced={...next,value:pending.value};
    window.history.replaceState(withStored(window.history.state,replaced),'');
   }else pendingBack.current=null;
   notify();
  };
  window.addEventListener('popstate',onPopState);
  window.addEventListener(CHANGE_EVENT,notify);
  return()=>{window.removeEventListener('popstate',onPopState);window.removeEventListener(CHANGE_EVENT,notify)};
 },[install]);

 const getSnapshot=useCallback(()=>stored<T>(window.history.state)?.value??base,[base]);
 const getServerSnapshot=useCallback(()=>base,[base]);
 const value=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
 const changed=()=>window.dispatchEvent(new Event(CHANGE_EVENT));

 const push=useCallback((next:T|((current:T)=>T))=>{
  const current=install();
  const resolved=typeof next==='function'?(next as (current:T)=>T)(current.value):next;
  if(JSON.stringify(resolved)===JSON.stringify(current.value))return;
  const entry:StoredNavigation<T>={version:1,session:current.session,index:current.index+1,value:resolved};
  window.history.pushState(withStored(window.history.state,entry),'');
  changed();
 },[install]);

 const replace=useCallback((next:T|((current:T)=>T))=>{
  const current=install();
  const resolved=typeof next==='function'?(next as (current:T)=>T)(current.value):next;
  window.history.replaceState(withStored(window.history.state,{...current,value:resolved}),'');
  changed();
 },[install]);

 const back=useCallback((steps=1,replacement?:T)=>{
  const current=install();
  const distance=Math.min(Math.max(1,steps),current.index);
  if(!distance){if(replacement!==undefined)replace(replacement);return}
  pendingBack.current=replacement===undefined?null:{session:current.session,value:replacement};
  window.history.go(-distance);
 },[install,replace]);

 return {value,push,replace,back};
}
