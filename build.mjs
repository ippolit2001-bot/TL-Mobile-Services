import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('./', import.meta.url);
const dist = new URL('./dist/', root);
await rm(dist, {recursive:true, force:true});
await mkdir(dist, {recursive:true});
for (const name of ['index.html','styles.css','app.js','model.js','.nojekyll','assets']) {
  await cp(new URL(name,root), new URL(name,dist), {recursive:true});
}
console.log(`Static site ready: ${fileURLToPath(dist)}`);
