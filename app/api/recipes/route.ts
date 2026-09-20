import {getChatGPTUser} from '../../chatgpt-auth';
import {searchRecipes} from '../../../lib/recipe-provider';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 if(!await getChatGPTUser())return json({error:'Inicia sesión para descubrir recetas.'},401);
 const params=new URL(request.url).searchParams,query=(params.get('q')??'').trim(),offset=Number(params.get('offset')??0);
 if(query.length<2||query.length>100||!Number.isSafeInteger(offset)||offset<0||offset>100000)return json({error:'Escribe entre 2 y 100 caracteres para buscar.'},400);
 try{return json(await searchRecipes(query,offset))}catch(e){return json({error:e instanceof Error?e.message:'No se ha podido buscar.'},503)}
}
