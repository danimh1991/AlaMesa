import ts from '../node_modules/typescript/lib/typescript.js';
import fs from 'node:fs';
const root=new URL('../',import.meta.url),out=new URL('../.sites-runtime/test-build/',import.meta.url);
for(const name of ['lib/menu','lib/recipes','lib/recipe-search-index','lib/recipe-provider','lib/shopping','tests/recipe-workflows.test']){
 const text=fs.readFileSync(new URL(name+'.ts',root),'utf8');
 let code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 code=code.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(m,q,path)=>path.endsWith('.json')?`from ${q}${path}${q} with {type:'json'}`:`from ${q}${path}.mjs${q}`);
 const dest=new URL(name+'.mjs',out);fs.mkdirSync(new URL('./',dest),{recursive:true});fs.writeFileSync(dest,code);
}
fs.copyFileSync(new URL('lib/recipes.json',root),new URL('lib/recipes.json',out));
for(const file of fs.readdirSync(new URL('lib/recipe-search-index/',root))){const destination=new URL('lib/recipe-search-index/'+file,out);fs.mkdirSync(new URL('./',destination),{recursive:true});fs.copyFileSync(new URL('lib/recipe-search-index/'+file,root),destination)}
await import('../.sites-runtime/test-build/tests/recipe-workflows.test.mjs');
