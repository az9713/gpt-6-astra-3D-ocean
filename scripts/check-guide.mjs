import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n');
const html=read('learn/index.html');
const manifest=JSON.parse(read('learn/snippets.json'));
const ocean=read('src/ocean.js'),objects=read('src/objects.js');
let checks=0;
for(const example of manifest.examples){
  const lines=read(example.path).split('\n').slice(example.first-1,example.last);
  const indent=Math.min(...lines.filter(line=>line.trim()).map(line=>line.match(/^ */)[0].length));
  assert.equal(example.text,lines.map(line=>line.slice(indent)).join('\n'),`${example.id} must match its source lines`);
  assert.ok(html.includes(`data-snippet="${example.id}"`));checks++;
}
assert.equal(manifest.examples.length,7);checks++;
const packages=JSON.parse(read('package.json'));
for(const text of [`Three.js ${packages.dependencies.three}`,`Vite ${packages.devDependencies.vite}`]){assert.ok(html.includes(text),text);checks++;}
assert.ok(ocean.includes("quality==='high'?380:260")&&html.includes('145,161 vertices and 288,800 triangles'));checks++;
assert.equal([...ocean.matchAll(/ \{d:\[/g)].length,10);assert.ok(html.includes('Ten waves'));checks++;
assert.equal([...ocean.matchAll(/    detailWave\(/g)].length,6);assert.ok(html.includes('Six additional short waves'));checks++;
assert.ok(objects.includes('const count=2400,')&&html.includes('2,400 short line segments'));checks++;
assert.ok(objects.includes('const count=96;')&&html.includes('96 fish'));checks++;
const waves=JSON.parse(html.match(/<script id="wave-data" type="application\/json">([^<]+)<\/script>/)[1]);
assert.deepEqual(waves.map(w=>w.length),[116,63,38]);assert.deepEqual(waves.map(w=>w.amplitude),[1.95,1.04,.56]);checks++;
assert.ok(html.includes('Simplified teaching example')&&html.includes('It omits sideways motion, distance filtering, and 3D shading.'));checks++;
assert.ok(!html.includes('{{'));checks++;
console.log(`Guide source verification: ${checks} checks passed.`);
