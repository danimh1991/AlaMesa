import assert from 'node:assert/strict';
import {initialState} from '../lib/menu';
import {createRecipeInState,deleteRecipeInState,managedRecipes,RecipeApiError,updateRecipeInState,validBearer} from '../lib/recipe-api-core';

const payload={
 recipeId:'api-pollo-horno-manzana-cebolla',name:'Pollo al horno con manzana y cebolla',category:'Pollo',season:'Ambos',complexity:3,
 diners:['Dani','Marta'],mealType:'Comida' as const,type:'Único',review:false,enabled:true,
 recipe:{servings:2,ingredients:[{name:'Traseros de pollo',quantity:2,unit:'ud'}],steps:['Precalentar el horno.'],sourceUrl:'',notes:'Consejo de prueba.',reviewed:false},
};

const state=initialState();
const created=createRecipeInState(state,payload);
assert.ok(created.id>0);
assert.equal(created.recipeId,payload.recipeId);
assert.equal(managedRecipes(state).find(recipe=>recipe.id===created.id)?.name,payload.name);
assert.throws(()=>createRecipeInState(state,payload),(error:unknown)=>error instanceof RecipeApiError&&error.status===409);
assert.throws(()=>createRecipeInState(initialState(),{...payload,season:'Primavera'}),(error:unknown)=>error instanceof RecipeApiError&&error.status===400);
assert.throws(()=>createRecipeInState(initialState(),{...payload,diners:['Desconocido']}),(error:unknown)=>error instanceof RecipeApiError&&error.status===400);

const updatePayload={...payload};Reflect.deleteProperty(updatePayload,'recipeId');
const updated=updateRecipeInState(state,created.id,{...updatePayload,name:'Pollo al horno actualizado'});
assert.equal(updated.name,'Pollo al horno actualizado');
assert.equal(updated.recipeId,payload.recipeId);
assert.throws(()=>updateRecipeInState(state,999999,updatePayload),(error:unknown)=>error instanceof RecipeApiError&&error.status===404);
deleteRecipeInState(state,created.id);
assert.equal(managedRecipes(state).some(recipe=>recipe.id===created.id),false);
assert.throws(()=>deleteRecipeInState(state,created.id),(error:unknown)=>error instanceof RecipeApiError&&error.status===404);

assert.equal(await validBearer(new Request('https://example.test',{headers:{Authorization:'Bearer secreto'}}),'secreto'),true);
assert.equal(await validBearer(new Request('https://example.test',{headers:{Authorization:'Bearer incorrecto'}}),'secreto'),false);
assert.equal(await validBearer(new Request('https://example.test'),'secreto'),false);
assert.equal(await validBearer(new Request('https://example.test',{headers:{Authorization:'Bearer secreto'}}),undefined),false);

console.log('PASS: autenticación, validación, duplicados y CRUD de recetas.');
