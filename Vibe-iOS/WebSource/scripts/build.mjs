import fs from 'node:fs/promises';
const files={'index.html':'text/html; charset=utf-8','app.js':'text/javascript; charset=utf-8','style.css':'text/css; charset=utf-8','cinema.html':'text/html; charset=utf-8','cinema.js':'text/javascript; charset=utf-8','cinema.css':'text/css; charset=utf-8'};
const assets={};for(const [name,type]of Object.entries(files))assets['/'+name]={type,body:await fs.readFile('public/'+name,'utf8')};
const worker=await fs.readFile('server/worker.mjs','utf8');
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await fs.writeFile('dist/server/index.js','const ASSETS='+JSON.stringify(assets)+';\n'+await fs.readFile('server/cinema.mjs','utf8')+'\n'+worker);
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built self-contained Worker with embedded app assets.');

await fs.cp('drizzle','dist/.openai/drizzle',{recursive:true});
