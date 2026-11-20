import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const files = ['index.html', 'styles.css', 'app.js', 'model.js', '.nojekyll'];
// Read all sources before replacing the generated deployment directory.
const contents = await Promise.all(files.map(file => readFile(join(root, file))));
const destination = join(root, 'dist');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await Promise.all(files.map((file, index) => writeFile(join(destination, file), contents[index])));
console.log(`Built dist/: ${files.join(', ')}`);
