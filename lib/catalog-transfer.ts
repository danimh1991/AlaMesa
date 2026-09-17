import {catalogDocumentSchema} from './schemas';
import {normalize,type Dish,type State} from './menu';
export function planImport(document:unknown,catalog:Dish[]){const parsed=catalogDocumentSchema.safeParse(document);if(!parsed.success)throw new Error(parsed.error.issues.slice(0,6).map(i=>`${i.path.join('.')}: ${i.message}`).join('\n'));
 const ids=new Set<number>(),newNames=new Set<string>();let next=Math.max(0,...catalog.map(d=>d.id))+1;const changes:{dish:Dish;kind:'new'|'updated'|'unchanged'}[]=[];
 for(const [index,row] of parsed.data.dishes.entries()){if(row.id&&ids.has(row.id))throw new Error(`Fila ${index+1}: id duplicado (${row.id}).`);if(row.id)ids.add(row.id);const old=row.id?catalog.find(d=>d.id===row.id):undefined;if(row.id&&!old)throw new Error(`Fila ${index+1}: el id ${row.id} no existe. Quita el id para crear un plato nuevo.`);const name=normalize(row.name);
 if(!old&&(newNames.has(name)||catalog.some(d=>normalize(d.name)===name)))throw new Error(`Fila ${index+1}: ya existe «${row.name}». Conserva su id para actualizarlo.`);
 if(old&&name!==normalize(old.name)&&catalog.some(d=>d.id!==old.id&&normalize(d.name)===name))throw new Error(`Fila ${index+1}: el nuevo nombre coincide con otro plato.`);newNames.add(name);
 const dish={...old,...row,id:old?.id??next++,recipeId:old?.recipeId} as Dish;changes.push({dish,kind:!old?'new':JSON.stringify(old)===JSON.stringify(dish)?'unchanged':'updated'});
 }
 const names=new Map<string,number>();for(const {dish,kind} of changes){const name=normalize(dish.name);if(names.has(name)&&kind!=='unchanged'&&!catalog.some(d=>d.id===dish.id&&normalize(d.name)===name))throw new Error(`Hay dos filas con el nombre «${dish.name}».`);names.set(name,dish.id)}
 return {changes,summary:{new:changes.filter(c=>c.kind==='new').length,updated:changes.filter(c=>c.kind==='updated').length,unchanged:changes.filter(c=>c.kind==='unchanged').length}};
}
export function applyImport(state:State,plan:ReturnType<typeof planImport>){for(const {dish,kind} of plan.changes)if(kind==='new')state.added=[...(state.added??[]),dish];else if(kind==='updated')state.overrides[dish.id]=dish;}
