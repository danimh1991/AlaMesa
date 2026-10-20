import {env} from 'cloudflare:workers';
import {RecipeApiError} from './recipe-api';

const methods='GET, POST, PUT, DELETE, OPTIONS';

export function allowedOrigin(request:Request){
 const origin=request.headers.get('origin');
 if(!origin)return null;
 if(origin===new URL(request.url).origin)return origin;
 const configured=(env.RECIPE_API_ALLOWED_ORIGINS??'').split(',').map(value=>value.trim()).filter(Boolean);
 return configured.includes(origin)?origin:false;
}

export function apiJson(request:Request,data:unknown,status=200,extra:HeadersInit={}){
 const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8',...extra});
 const origin=allowedOrigin(request);if(origin)headers.set('Access-Control-Allow-Origin',origin);
 headers.set('Vary','Origin');
 return new Response(status===204?null:JSON.stringify(data),{status,headers});
}

export function preflight(request:Request){
 const origin=allowedOrigin(request);
 if(origin===false)return apiJson(request,{error:'Origen no permitido.'},403);
 const headers:HeadersInit={'Access-Control-Allow-Methods':methods,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'};
 return apiJson(request,null,204,headers);
}

export function rejectOrigin(request:Request){return allowedOrigin(request)===false?apiJson(request,{error:'Origen no permitido.'},403):null}

export async function parseJson(request:Request){
 const type=request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
 if(type!=='application/json')throw new RecipeApiError(415,'Content-Type debe ser application/json.');
 const body=await request.text();
 if(new TextEncoder().encode(body).length>100000)throw new RecipeApiError(413,'El cuerpo supera el límite de 100 KB.');
 try{return JSON.parse(body)}catch{throw new RecipeApiError(400,'El cuerpo no contiene JSON válido.')}
}

export function apiError(request:Request,error:unknown){
 if(error instanceof RecipeApiError){const details=(error as RecipeApiError&{details?:unknown}).details;return apiJson(request,{error:error.message,...(details?{details}:{})},error.status)}
 console.error('Recipe API',error);
 return apiJson(request,{error:'No se ha podido completar la operación.'},503);
}

export function recipeApiToken(){return env.RECIPE_API_TOKEN}
