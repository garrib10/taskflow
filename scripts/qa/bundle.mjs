import { build } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
const output=process.env.TASKFLOW_BUNDLE_OUTPUT??'/private/tmp/taskflow49-bundle';
const production=readdirSync('dist/assets').map(name=>{const b=readFileSync(join('dist/assets',name));return{name,bytes:b.length,gzip:gzipSync(b).length,brotli:brotliCompressSync(b).length,sha256:createHash('sha256').update(b).digest('hex')};});
await build({configFile:resolve('vite.config.ts'),build:{outDir:output,emptyOutDir:true,sourcemap:true},plugins:[{name:'qa-bundle-inventory',generateBundle(_options,bundle){
  const chunks=Object.values(bundle).filter(x=>x.type==='chunk').map(chunk=>({file:chunk.fileName,imports:chunk.imports,dynamicImports:chunk.dynamicImports,modules:Object.entries(chunk.modules).map(([id,info])=>({id:id.replace(process.cwd(),'<repo>'),renderedLength:info.renderedLength,originalLength:info.originalLength}))}));
  this.emitFile({type:'asset',fileName:'inventory.json',source:JSON.stringify({production,chunks},null,2)});
}}]});
console.log(JSON.stringify(production));
