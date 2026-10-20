
import {searchRecipes} from '../../../lib/recipe-provider';
import {createManagedRecipe,listManagedRecipes,validBearer} from '../../../lib/recipe-api';
import {apiError,apiJson,parseJson,preflight,recipeApiToken,rejectOrigin} from '../../../lib/recipe-api-http';

export async function GET(request:Request){
 const rejected=rejectOrigin(request);if(rejected)return rejected;
 const params=new URL(request.url).searchParams;
 if(params.has('q')){
  const query=(params.get('q')??'').trim(),offset=Number(params.get('offset')??0);
  if(query.length<2||query.length>100||!Number.isSafeInteger(offset)||offset<0||offset>100000)return apiJson(request,{error:'Escribe entre 2 y 100 caracteres para buscar.'},400);
  try{return apiJson(request,await searchRecipes(query,offset))}catch(error){return apiJson(request,{error:error instanceof Error?error.message:'No se ha podido buscar.'},503)}
 }
 const offset=Number(params.get('offset')??0),limit=Number(params.get('limit')??100);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)return apiJson(request,{error:'Paginación no válida.'},400);
 try{return apiJson(request,await listManagedRecipes(offset,limit))}catch(error){return apiError(request,error)}
}

export async function POST(request:Request){
 const rejected=rejectOrigin(request);if(rejected)return rejected;
 const token=recipeApiToken();if(!token)return apiJson(request,{error:'La escritura de recetas no está configurada.'},503);
 if(!await validBearer(request,token))return apiJson(request,{error:'Token no válido o ausente.'},401,{'WWW-Authenticate':'Bearer'});
 try{return apiJson(request,{recipe:await createManagedRecipe(await parseJson(request))},201)}catch(error){return apiError(request,error)}
}

export function OPTIONS(request:Request){return preflight(request)}
