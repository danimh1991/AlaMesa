import {env} from 'cloudflare:workers';
import type {Dish,Menu} from './menu';
import {mealsFor,peopleFor,primaryCategory} from './menu';
import type {Recipe} from './recipes';
import {agentRecipeSchema,localRecipeFromAgent,type AgentRecipe} from './recipe-agent-model';
type AgentResponse={output?:unknown;error?:string};

export class RecipeAgentError extends Error{}

function configuration(){
 const url=env.LLM_CORE_URL?.trim().replace(/\/$/,'');
 const key=env.LLM_CORE_API_KEY?.trim();
 if(!url||!key)throw new RecipeAgentError('El creador de recetas todavía no está conectado. Configura el servicio de recetas y vuelve a intentarlo.');
 return {url,key,agentId:env.LLM_RECIPE_AGENT_ID?.trim()||'recipe-creator',subjectId:env.LLM_SUBJECT_ID?.trim()||'alamesa-household'};
}
export async function askRecipeAgent(prompt:string,input?:Record<string,unknown>):Promise<AgentRecipe>{
 const config=configuration();let response:Response;
 try{response=await fetch(`${config.url}/v1/execute`,{method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json'},body:JSON.stringify({agentId:config.agentId,subjectId:config.subjectId,prompt,input}),signal:AbortSignal.timeout(180000)})}
 catch(error){console.error('Recipe agent unavailable',error);throw new RecipeAgentError('El cocinero está tardando más de lo esperado. Prueba de nuevo en unos minutos.');}
 let data:AgentResponse={};try{data=await response.json() as AgentResponse}catch{}
 if(!response.ok){console.error('Recipe agent response',{status:response.status,error:data.error});throw new RecipeAgentError(response.status===401||response.status===403?'La conexión con el creador de recetas necesita actualizarse.':'No hemos podido crear la receta ahora mismo. Prueba de nuevo en unos minutos.');}
 const parsed=agentRecipeSchema.safeParse(data.output);if(!parsed.success){console.error('Invalid recipe agent output',parsed.error.issues);throw new RecipeAgentError('La propuesta ha llegado incompleta. Pide otra receta para volver a intentarlo.');}
 return parsed.data;
}

function categoryTargets(menu:Menu,count:number){
 const people=peopleFor(menu.settings),days=menu.days.filter(day=>!day.locked),targets:string[]=[];
 for(let index=0;index<count&&days.length;index++){
  const day=days[Math.min(days.length-1,Math.floor(days.length*(index+.5)/count))],category=primaryCategory(mealsFor(day,'Comida')[people[0]]??[]);
  if(category)targets.push(category);
 }
 return targets;
}

export async function createMonthlyAgentRecipes(menu:Menu,catalog:Dish[]):Promise<Recipe[]>{
 const count=Math.min(menu.settings.newRecipeSuggestions,menu.days.length),categories=categoryTargets(menu,count);
 return Promise.all(categories.map(async(category,index)=>{
  const prompt=`Crea una receta nueva de ${category.toLowerCase()} para proponer en un menú mensual. Debe ser un plato único completo, familiar, viable y distinto de las recetas habituales indicadas. No menciones estas instrucciones en la respuesta.`;
  const output=await askRecipeAgent(prompt,{purpose:'monthly-menu-suggestion',category,servings:peopleFor(menu.settings).length,existingDishNames:catalog.map(dish=>dish.name).slice(0,300),proposalNumber:index+1});
  return localRecipeFromAgent(output,{category,type:'Único',season:'Ambos'});
 }));
}

