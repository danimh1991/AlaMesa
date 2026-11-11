import {z} from 'zod';
import type {RecipeDetails} from './menu';
import {normalize} from './menu';
import type {Recipe} from './recipes';

const ingredient=z.object({name:z.string().trim().min(1).max(240),quantity:z.number().positive().max(1000000).nullable(),unit:z.string().trim().max(40).nullable(),available:z.boolean(),optional:z.boolean()}).strict();
const step=z.object({order:z.number().int(),instruction:z.string().trim().min(1).max(5000),minutes:z.number().int().positive().nullable(),temperatureCelsius:z.number().int().nullable(),visualCue:z.string().trim().max(1000).nullable()}).strict();
export const agentRecipeSchema=z.object({title:z.string().trim().min(1).max(180),summary:z.string().trim().min(1).max(2000),novelty:z.string().trim().min(1).max(2000),servings:z.number().int().positive().max(1000),totalMinutes:z.number().int().positive().max(10080),difficulty:z.enum(['facil','media','avanzada']),ingredients:z.array(ingredient).min(1).max(100),equipment:z.array(z.string().trim().min(1).max(200)).max(50),steps:z.array(step).min(1).max(100),missingIngredients:z.array(z.string().trim().min(1).max(240)).max(100),warnings:z.array(z.string().trim().min(1).max(1000)).max(50),conservation:z.string().trim().min(1).max(2000)}).strict();
export type AgentRecipe=z.infer<typeof agentRecipeSchema>;
type RecipeOptions={category:string;type?:Recipe['type'];season?:Recipe['season']};

export function recipeDetailsForAgent(recipe:AgentRecipe):RecipeDetails{
 const notes=[recipe.summary,`Qué la hace especial: ${recipe.novelty}`,recipe.equipment.length?`Utensilios: ${recipe.equipment.join(', ')}.`:'',recipe.warnings.length?`Avisos: ${recipe.warnings.join(' ')}`:'',`Conservación: ${recipe.conservation}`].filter(Boolean).join('\n\n');
 return {servings:recipe.servings,ingredients:recipe.ingredients.map(item=>({name:item.name,quantity:item.quantity,unit:item.unit??'',...(item.optional?{notes:'Opcional'}:{})})),steps:[...recipe.steps].sort((a,b)=>a.order-b.order).map(item=>[item.instruction,item.minutes?`${item.minutes} min`:null,item.temperatureCelsius?`${item.temperatureCelsius} °C`:null,item.visualCue].filter(Boolean).join(' · ')),sourceUrl:'',notes,reviewed:true};
}

export function localRecipeFromAgent(recipe:AgentRecipe,options:RecipeOptions):Recipe{
 return {id:`agent-${crypto.randomUUID()}`,name:recipe.title,originalName:recipe.title,category:options.category,type:options.type??'Único',season:options.season??'Ambos',complexity:recipe.difficulty==='facil'?1:recipe.difficulty==='media'?3:5,ingredients:recipe.ingredients.map(item=>[item.quantity,item.unit,item.name,item.optional?'(opcional)':''].filter(value=>value!==null&&value!=='').join(' ')),steps:recipeDetailsForAgent(recipe).steps,notes:recipe.summary,source:'',providerUrl:'',provider:'Creada para ti',servings:recipe.servings,details:recipeDetailsForAgent(recipe)};
}

export function suggestCategory(recipe:AgentRecipe,categories:string[]){
 const text=normalize(`${recipe.title} ${recipe.summary} ${recipe.ingredients.map(item=>item.name).join(' ')}`);
 const rules:[string,string[]][]=[['Pollo',['pollo','pavo']],['Pescado',['pescado','salmon','merluza','bacalao','atun','trucha']],['Carne',['carne','ternera','cerdo','cordero','conejo']],['Legumbres',['lenteja','garbanzo','alubia','judia','legumbre']],['Pasta',['pasta','espagueti','macarron','fideo','lasana']],['Arroz',['arroz','risotto','paella']],['Verduras',['verdura','calabacin','berenjena','calabaza','brocoli','coliflor']]];
 for(const [candidate,words] of rules){const actual=categories.find(category=>normalize(category)===normalize(candidate));if(actual&&words.some(word=>text.includes(normalize(word))))return actual;}
 return categories[0]??'Verduras';
}
