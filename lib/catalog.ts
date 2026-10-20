import seed from './catalog.json';
import {normalizeDish,type Dish,type State} from './menu';

export function catalogFor(state:State):Dish[]{
 const deleted=new Set(state.deletedDishIds??[]);
 return [...seed,...(state.added??[])]
  .filter(dish=>!deleted.has(dish.id))
  .map(dish=>normalizeDish(state.overrides[dish.id]??dish)) as Dish[];
}
