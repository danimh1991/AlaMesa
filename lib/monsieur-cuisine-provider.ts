import {normalize,type Dish} from './menu';
import type {Recipe} from './recipes';
import {MonsieurCuisineClient} from './importers/monsieur-cuisine/client.mjs';
import {mapMonsieurCuisineRecipe} from './importers/monsieur-cuisine/mapper.mjs';

export const MONSIEUR_CUISINE_PROVIDER_URL='https://www.monsieur-cuisine.com/es/recipe';

type SearchRecipe={id?:unknown;name?:unknown;categories?:{name?:unknown}[]};

function usefulSummary(summary:SearchRecipe){
 const name=normalize(String(summary.name??'')),categories=(summary.categories??[]).map(category=>normalize(String(category.name??'')));
 return !!name&&!name.startsWith('*')&&!categories.some(category=>/^(postres|resposteria|bebidas|mermeladas y jaleas)$/.test(category))&&!/\b(bizcocho|tarta|galleta|helado|batido|zumo|flan|natillas|mousse|brownie|cupcake|magdalena|chocolate|cacao|cake|sorbete|granizado|merengue|panna cotta|postre|dulce)\b/.test(name);
}

function ingredientText(ingredient:{name:string;quantity:number|null;unit:string;notes?:string}){
 const amount=ingredient.quantity===null?'':String(Math.round(ingredient.quantity*1000)/1000).replace('.',',');
 return [amount,ingredient.unit,ingredient.name,ingredient.notes&&`(${ingredient.notes})`].filter(Boolean).join(' ');
}

export function fromMonsieurCuisine(detail:Record<string,unknown>):Recipe|null{
 try{
  const dish=mapMonsieurCuisineRecipe(detail,{id:1,diners:['import']});
  if(dish.type==='Guarnición')return null;
  const recipe=dish.recipe;
  if(!recipe||!dish.recipeId||!recipe.steps.length||recipe.ingredients.some((ingredient:{name:string})=>ingredient.name.startsWith('Ingrediente Monsieur Cuisine #')))return null;
  return {id:dish.recipeId,name:dish.name,originalName:dish.name,category:dish.category,type:dish.type,season:dish.season,complexity:dish.complexity,ingredients:recipe.ingredients.map(ingredientText),steps:recipe.steps,notes:recipe.notes,source:recipe.sourceUrl,providerUrl:MONSIEUR_CUISINE_PROVIDER_URL,provider:'Monsieur Cuisine',details:recipe,servings:recipe.servings,originalIngredients:recipe.originalIngredients};
 }catch(error){console.error('Monsieur Cuisine mapper',error instanceof Error?error.message:'Invalid recipe');return null}
}

export async function refreshMonsieurCuisine(previous:Recipe[],catalog:Dish[],target=50):Promise<Recipe[]>{
 const client=new MonsieurCuisineClient(),first=await client.getSearchPage(1,{officialOnly:true});
 const excludedIds=new Set([...previous.map(recipe=>recipe.id),...catalog.flatMap(dish=>dish.recipeId?[dish.recipeId]:[])]),names=new Set([...previous.map(recipe=>normalize(recipe.name)),...catalog.map(dish=>normalize(dish.name))]);
 const recipes:Recipe[]=[],visited=new Set<number>(),pages=[first];
 while(pages.length<Math.min(first.totalPage,12)){let page;do{page=1+Math.floor(Math.random()*first.totalPage)}while(visited.has(page));visited.add(page);try{pages.push(await client.getSearchPage(page,{officialOnly:true}))}catch(error){console.error('Monsieur Cuisine page',page,error instanceof Error?error.message:'Unavailable')}}
 for(const page of pages){
  const summaries=(page.recipes as SearchRecipe[]).filter(usefulSummary).filter(summary=>{const id=`monsieur-cuisine-${Number(summary.id)}`;return !excludedIds.has(id)&&!names.has(normalize(String(summary.name??'')))});
  for(let start=0;start<summaries.length&&recipes.length<target;start+=3){
   const batch=await Promise.all(summaries.slice(start,start+3).map(async summary=>{try{return fromMonsieurCuisine(await client.getRecipe(Number(summary.id)))}catch(error){console.error('Monsieur Cuisine recipe',summary.id,error instanceof Error?error.message:'Unavailable');return null}}));
   for(const recipe of batch){if(!recipe||excludedIds.has(recipe.id)||names.has(normalize(recipe.name)))continue;recipes.push(recipe);excludedIds.add(recipe.id);names.add(normalize(recipe.name));if(recipes.length===target)break}
  }
  if(recipes.length===target)break;
 }
 if(recipes.length!==target)throw new Error(`Monsieur Cuisine solo ha proporcionado ${recipes.length} de ${target} recetas válidas. Conservamos la selección anterior; inténtalo de nuevo.`);
 return recipes;
}
