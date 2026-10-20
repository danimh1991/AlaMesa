import {deleteManagedRecipe,getManagedRecipe,updateManagedRecipe,validBearer} from '../../../../lib/recipe-api';
import {apiError,apiJson,parseJson,preflight,recipeApiToken,rejectOrigin} from '../../../../lib/recipe-api-http';

type Context={params:Promise<{id:string}>};
async function numericId(context:Context){const value=(await context.params).id;return /^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null}

export async function GET(request:Request,context:Context){
 const rejected=rejectOrigin(request);if(rejected)return rejected;
 const id=await numericId(context);if(id===null)return apiJson(request,{error:'Identificador no válido.'},400);
 try{const recipe=await getManagedRecipe(id);return recipe?apiJson(request,{recipe}):apiJson(request,{error:'Receta no encontrada.'},404)}catch(error){return apiError(request,error)}
}

export async function PUT(request:Request,context:Context){
 const rejected=rejectOrigin(request);if(rejected)return rejected;
 const token=recipeApiToken();if(!token)return apiJson(request,{error:'La escritura de recetas no está configurada.'},503);
 if(!await validBearer(request,token))return apiJson(request,{error:'Token no válido o ausente.'},401,{'WWW-Authenticate':'Bearer'});
 const id=await numericId(context);if(id===null)return apiJson(request,{error:'Identificador no válido.'},400);
 try{return apiJson(request,{recipe:await updateManagedRecipe(id,await parseJson(request))})}catch(error){return apiError(request,error)}
}

export async function DELETE(request:Request,context:Context){
 const rejected=rejectOrigin(request);if(rejected)return rejected;
 const token=recipeApiToken();if(!token)return apiJson(request,{error:'La escritura de recetas no está configurada.'},503);
 if(!await validBearer(request,token))return apiJson(request,{error:'Token no válido o ausente.'},401,{'WWW-Authenticate':'Bearer'});
 const id=await numericId(context);if(id===null)return apiJson(request,{error:'Identificador no válido.'},400);
 try{await deleteManagedRecipe(id);return apiJson(request,null,204)}catch(error){return apiError(request,error)}
}

export function OPTIONS(request:Request){return preflight(request)}
