import ts from '../node_modules/typescript/lib/typescript.js';
import fs from 'node:fs';
const root=new URL('../',import.meta.url),out=new URL('../.sites-runtime/test-recipe-api/',import.meta.url);
for(const name of ['lib/menu','lib/schemas','lib/catalog','lib/recipe-api-core','tests/recipe-api.test']){
 const source=fs.readFileSync(new URL(name+'.ts',root),'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 code=code.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(match,quote,path)=>path.endsWith('.json')?`from ${quote}${path}${quote} with {type:'json'}`:`from ${quote}${path}.mjs${quote}`);
 const destination=new URL(name+'.mjs',out);fs.mkdirSync(new URL('./',destination),{recursive:true});fs.writeFileSync(destination,code);
}
fs.copyFileSync(new URL('lib/catalog.json',root),new URL('lib/catalog.json',out));
await import('../.sites-runtime/test-recipe-api/tests/recipe-api.test.mjs');
