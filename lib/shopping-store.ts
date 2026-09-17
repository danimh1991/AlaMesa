import {normalize,type State,type Dish,type Menu,type ShoppingStore} from './menu';
import {shoppingList} from './shopping';
export function basket(state:State):ShoppingStore{return state.shopping??={items:[],included:{}}}
export function addProduct(state:State,input:{name:string;quantity:number|null;unit:string},uses:string[]=[]){
 const store=basket(state);let {name,quantity,unit}=input;unit=normalize(unit);
 const units:Record<string,[string,number]>={kg:['g',1000],l:['ml',1000],gramos:['g',1],litros:['ml',1000],unidad:['ud',1],unidades:['ud',1]};
 if(units[unit]){if(quantity!==null)quantity*=units[unit][1];unit=units[unit][0]}
 const old=store.items.find(i=>!i.checked&&normalize(i.name)===normalize(name)&&i.unit===unit&&i.quantity!==null&&quantity!==null);
 if(old){old.quantity!+=quantity!;old.uses=[...new Set([...old.uses,...uses])]}
 else store.items.push({id:crypto.randomUUID(),name,quantity,unit,checked:false,uses});
}
export function includeMenu(state:State,menu:Menu,catalog:Dish[],from=menu.month+'-01',to=menu.month+'-31'){
 if(menu.status!=='confirmed')throw new Error('Confirma el menú antes de añadirlo a la compra.');
 const store=basket(state);
 for(const day of menu.days.filter(d=>d.date>=from&&d.date<=to)){
  const list=shoppingList({...menu,days:[day]},catalog);
  for(const item of list.items){
   const key=day.date+'|'+item.key,previous=store.included[key]??0;
   if(item.quantity>previous){addProduct(state,{name:item.name,quantity:item.quantity-previous,unit:item.unit},item.uses);store.included[key]=item.quantity}
  }
 }
}
