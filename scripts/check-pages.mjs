import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
assert.deepEqual((await readdir(dist)).sort(), ['.nojekyll', 'app.js', 'index.html', 'model.js', 'styles.css']);
const html = await readFile(join(dist, 'index.html'), 'utf8');
const app = await readFile(join(dist, 'app.js'), 'utf8');
const styles = await readFile(join(dist, 'styles.css'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
const imports = [...app.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
const urls = [...styles.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(match => match[1]);
for (const base of ['https://example.github.io/', 'https://example.github.io/hourly-services/']) {
  for (const ref of [...references, ...imports, ...urls]) {
    if (/^(?:https?:|data:|#)/.test(ref)) continue;
    assert.ok(!ref.startsWith('/'), `Root-relative URL does not support a project site: ${ref}`);
    const resolved = new URL(ref, base);
    assert.ok(resolved.href.startsWith(base), `Reference escapes the project base: ${ref}`);
    if (ref === './') continue;
    assert.ok((await stat(join(dist, ref))).size > 0, `Missing or empty deployment asset: ${ref}`);
  }
}
assert.ok(html.includes('type="module"'), 'The application must load as an ES module');
assert.ok(!/127\.0\.0\.1|localhost/.test(html + app + styles), 'The deployment contains a local server URL');
console.log('GitHub Pages check passed: complete static assets; URLs work at / and /hourly-services/.');
