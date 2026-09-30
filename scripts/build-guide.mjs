import { readFileSync, writeFileSync } from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8').replaceAll('\r\n','\n');
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const sources=new Map();
const source=path=>{if(!sources.has(path))sources.set(path,read(path));return sources.get(path);};
const ref=/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA||'')?process.env.GITHUB_SHA:'main';
const examples={
  mesh:['src/ocean.js',' const segments=quality', ' g.computeBoundingSphere();'],
  wave:['src/ocean.js','    float a=amp*scale*distanceFade;', '    p.xz+=q*a*dir*c;p.y+=a*s;'],
  scale:['src/ocean.js','    float scale=.028+pow(uSea,1.55)*2.65;', '    float scale=.028+pow(uSea,1.55)*2.65;'],
  normal:['src/ocean.js','    vNormal=normalize(cross(dz,dx));', '    vBreaking=1.0-(dx.x*dz.z-dx.z*dz.x);'],
  fresnel:['src/ocean.js','    float NoV=clamp(dot(N,V),.001,1.0);', '    vec3 reflected=atmosphere(normalize(rd),false);'],
  foam:['src/ocean.js','    float threshold=mix(.34,.19,uSea);', '    float whitecap=smoothstep(threshold,threshold+.065,vBreaking)*smoothstep(.47,.72,foamNoise)*smoothstep(.35,.65,crestGrain)*smoothstep(.25,.75,uSea);'],
  clock:['src/main.js',' const elapsed=(now-lastNow)/1000;', ' if(!state.paused)simTime+=dt;'],
};
const manifest=[];
function snippet(id){
  const [path,start,end]=examples[id]||[];
  if(!path)throw new Error(`Unknown guide snippet: ${id}`);
  const lines=source(path).split('\n');
  const first=lines.findIndex(line=>line.startsWith(start));
  const last=lines.findIndex((line,index)=>index>=first&&line.startsWith(end));
  if(first<0||last<first)throw new Error(`Guide source anchor moved: ${id}`);
  const selected=lines.slice(first,last+1);
  const indent=Math.min(...selected.filter(line=>line.trim()).map(line=>line.match(/^ */)[0].length));
  const text=selected.map(line=>line.slice(indent)).join('\n');
  manifest.push({id,path,first:first+1,last:last+1,text});
  const url=`https://github.com/az9713/gpt-6-astra-3D-ocean/blob/${ref}/${path}#L${first+1}-L${last+1}`;
  return `<figure class="code-example" data-snippet="${id}"><figcaption><span>Actual source · ${id==='mesh'||id==='clock'?'JavaScript':'GLSL'}</span><a href="${url}">${path} · lines ${first+1}–${last+1}</a></figcaption><pre tabindex="0" aria-label="${id} code excerpt"><code>${escape(text)}</code></pre></figure>`;
}
let page=read('learn/template.html').replace(/\{\{snippet:(\w+)\}\}/g,(_,id)=>snippet(id));
// The teaching plot uses the first three actual wave definitions; it deliberately
// omits horizontal Gerstner displacement, distance filtering and all 3D rendering.
const matches=[...source('src/ocean.js').matchAll(/\{d:\[([^,]+),([^\]]+)\],l:([^,]+),a:([^,]+),q:([^,]+),p:([^}]+)\}/g)];
if(matches.length!==10)throw new Error('Expected ten source wave definitions; review the guide.');
const waves=matches.slice(0,3).map(m=>{const dx=Number(m[1]),dz=Number(m[2]),length=Number(m[3]);return {dx:dx/Math.hypot(dx,dz),length,amplitude:Number(m[4]),phase:Number(m[6])};});
page=page.replace('{{wave-data}}',JSON.stringify(waves));
if(/\{\{/.test(page))throw new Error('Unresolved guide template token.');
writeFileSync(new URL('learn/index.html',root),page);
writeFileSync(new URL('learn/snippets.json',root),JSON.stringify({sourceRef:ref,examples:manifest},null,2)+'\n');
console.log(`Guide built: ${manifest.length} exact source excerpts, ${waves.length} teaching waves.`);
