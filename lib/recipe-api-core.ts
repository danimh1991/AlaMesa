import {z} from 'zod';
import {dishSchema} from './schemas';
import {catalogFor} from './catalog';
import {normalize,peopleFor,type Dish,type State} from './menu';

const recipeId=z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/,'El recipeId contiene caracteres no permitidos.');
export const recipeCreateSchema=dishSchema.omit({id:true,recipeId:true}).extend({
 recipeId:recipeId.optional(),
 recipe:dishSchema.shape.recipe.unwrap(),
}).strict();
export const recipeUpdateSchema=recipeCreateSchema.omit({recipeId:true}).strict();
export type RecipeCreate=z.infer<typeof recipeCreateSchema>;
export type RecipeUpdate=z.infer<typeof recipeUpdateSchema>;

export class RecipeApiError extends Error{
 constructor(public status:number,message:string){super(message)}
}

export function managedRecipes(state:State){return catalogFor(state).filter(dish=>dish.recipe!==undefined).map(withRecipeId)}

export function createRecipeInState(state:State,input:unknown){
 const parsed=recipeCreateSchema.safeParse(input);
 if(!parsed.success)throw validationError(parsed.error);
 const catalog=catalogFor(state),generatedId=parsed.data.recipeId??`api-${crypto.randomUUID()}`;
 assertContext(parsed.data,state);
 const sameName=catalog.find(dish=>normalize(dish.name)===normalize(parsed.data.name));
 if(sameName?.recipe)throw new RecipeApiError(409,'Ya existe una receta con ese nombre.');
 assertUnique(catalog,parsed.data.name,generatedId,sameName?.id);
 const id=sameName?.id??Math.max(0,...catalog.map(dish=>dish.id),...(state.deletedDishIds??[]))+1;
 const recipe:Dish={...parsed.data,id,recipeId:generatedId};
 if(sameName)state.overrides[id]=recipe;
 else state.added=[...(state.added??[]),recipe];
 return recipe;
}

export function updateRecipeInState(state:State,id:number,input:unknown){
 const parsed=recipeUpdateSchema.safeParse(input);
 if(!parsed.success)throw validationError(parsed.error);
 const catalog=catalogFor(state),existing=managedRecipes(state).find(dish=>dish.id===id);
 if(!existing)throw new RecipeApiError(404,'Receta no encontrada.');
 assertContext(parsed.data,state);
 assertUnique(catalog,parsed.data.name,existing.recipeId!,id);
 const recipe:Dish={...parsed.data,id,recipeId:existing.recipeId};
 const added=(state.added??[]).findIndex(dish=>dish.id===id);
 if(added>=0)state.added=(state.added??[]).map(dish=>dish.id===id?recipe:dish);
 else state.overrides[id]=recipe;
 return recipe;
}

export function deleteRecipeInState(state:State,id:number){
 const existing=managedRecipes(state).find(recipe=>recipe.id===id);
 if(!existing)throw new RecipeApiError(404,'Receta no encontrada.');
 state.added=(state.added??[]).filter(dish=>dish.id!==id);
 delete state.overrides[id];
 return existing;
}

function assertContext(recipe:RecipeCreate|RecipeUpdate,state:State){
 const categories=Object.keys(state.settings.categoryRanges);
 if(!categories.some(category=>normalize(category)===normalize(recipe.category)))throw new RecipeApiError(400,'La categoría no existe en Preferencias.');
 const diners=new Set(peopleFor(state.settings));
 if(recipe.diners.some(person=>!diners.has(person)))throw new RecipeApiError(400,'Algún comensal no existe en Preferencias.');
}

function assertUnique(catalog:Dish[],name:string,generatedId:string,exceptId?:number){
 if(catalog.some(dish=>dish.id!==exceptId&&normalize(dish.name)===normalize(name)))throw new RecipeApiError(409,'Ya existe un plato con ese nombre.');
 if(catalog.some(dish=>dish.id!==exceptId&&dish.recipe&&withRecipeId(dish).recipeId===generatedId))throw new RecipeApiError(409,'Ya existe una receta con ese recipeId.');
}

function withRecipeId(dish:Dish):Dish{return dish.recipeId?dish:{...dish,recipeId:`dish-${dish.id}`}}

function validationError(error:z.ZodError){
 const details=error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message}));
 const result=new RecipeApiError(400,'Los datos enviados no son válidos.') as RecipeApiError&{details?:typeof details};
 result.details=details;return result;
}

export async function validBearer(request:Request,secret:string|undefined){
 if(!secret)return false;
 const match=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
 if(!match)return false;
 const [actual,expected]=await Promise.all([digest(match[1]),digest(secret)]);
 if(actual.length!==expected.length)return false;
 let difference=0;for(let index=0;index<actual.length;index++)difference|=actual[index]^expected[index];
 return difference===0;
}

async function digest(value:string){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
