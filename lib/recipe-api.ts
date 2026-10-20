import type {State} from './menu';
import {readState,saveState} from './storage';
import {createRecipeInState,deleteRecipeInState,managedRecipes,RecipeApiError,updateRecipeInState} from './recipe-api-core';
export {RecipeApiError,recipeCreateSchema,recipeUpdateSchema,validBearer} from './recipe-api-core';

export async function listManagedRecipes(offset=0,limit=100){
 const {state}=await readState({dishes:true});
 const all=managedRecipes(state);
 return {recipes:all.slice(offset,offset+limit),total:all.length,offset,limit};
}

export async function getManagedRecipe(id:number){
 const {state}=await readState({dishes:true});
 return managedRecipes(state).find(recipe=>recipe.id===id)??null;
}

export async function createManagedRecipe(input:unknown){
 return mutate(state=>{const recipe=createRecipeInState(state,input);return {value:recipe,ids:[recipe.id]}});
}

export async function updateManagedRecipe(id:number,input:unknown){
 return mutate(state=>({value:updateRecipeInState(state,id,input),ids:[id]}));
}

export async function deleteManagedRecipe(id:number){
 return mutate(state=>({value:deleteRecipeInState(state,id),ids:[id]}));
}

async function mutate<T>(change:(state:State)=>Promise<{value:T;ids:number[]}>|{value:T;ids:number[]}){
 for(let attempt=0;attempt<3;attempt++){
  const {state,revision}=await readState({dishes:true});
  const changed=await change(state);
  try{await saveState(state,revision,{dishes:changed.ids});return changed.value}
  catch(error){if(!(error instanceof Error&&error.message==='CONFLICT'))throw error;if(attempt===2)throw new RecipeApiError(409,'Hay cambios más recientes. Vuelve a intentarlo.')}
 }
 throw new Error('Unreachable');
}
