import {z} from 'zod';
import {askRecipeAgent,RecipeAgentError} from '../../../lib/recipe-agent';

const input=z.object({prompt:z.string().trim().min(3,'Cuéntanos un poco más sobre la receta que te apetece.').max(8000)}).strict();
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request:Request){
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origen no permitido.'},403);
 let body:z.infer<typeof input>;try{const raw=await request.text();if(new TextEncoder().encode(raw).length>20000)return json({error:'La petición es demasiado larga.'},413);body=input.parse(JSON.parse(raw))}catch(error){return json({error:error instanceof z.ZodError?error.issues[0]?.message:'No hemos entendido la petición.'},400)}
 try{return json({recipe:await askRecipeAgent(body.prompt,{purpose:'interactive-recipe'})})}
 catch(error){if(error instanceof RecipeAgentError)return json({error:error.message},503);console.error('Recipe creator',error);return json({error:'No hemos podido crear la receta ahora mismo. Prueba de nuevo en unos minutos.'},503)}
}
