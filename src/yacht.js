import * as THREE from 'three';
import { waveHeight } from './ocean.js';

function cylinderBetween(a,b,r,material) {
 const v=new THREE.Vector3().subVectors(b,a);
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),7),material);
 mesh.position.copy(a).add(b).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return mesh;
}
function rope(points,material,r=.018){return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),28,r,4,false),material);}
function sailGeometry(tack,head,clew,belly){
 const positions=[],uvs=[],indices=[],n=32;
 const T=new THREE.Vector3(...tack),H=new THREE.Vector3(...head),C=new THREE.Vector3(...clew);
 for(let row=0;row<=n;row++){
  const v=row/n;
  for(let col=0;col<=n;col++){
   const u=col/n;const p=T.clone().lerp(C,u).lerp(H,v);
   p.x+=Math.sin(u*Math.PI)*Math.sin((1-v)*Math.PI*.82)*belly;
   positions.push(p.x,p.y,p.z);uvs.push(u,v);
   if(row<n&&col<n){let i=row*(n+1)+col;indices.push(i,i+1,i+n+1,i+1,i+n+2,i+n+1);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function makeCanvasTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d');
 ctx.fillStyle='#eeece2';ctx.fillRect(0,0,512,1024);
 ctx.strokeStyle='#a9a99e';ctx.lineWidth=.6;
 for(let y=0;y<1024;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
 ctx.strokeStyle='#c4c3b8';ctx.lineWidth=2;for(let x=0;x<512;x+=128){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1024);ctx.stroke();}
 ctx.fillStyle='#2e3e4a';ctx.font='bold 38px Arial';ctx.fillText('P  36',160,620);ctx.lineWidth=4;ctx.strokeStyle='#4a626e';ctx.beginPath();ctx.moveTo(215,750);ctx.lineTo(270,750);ctx.moveTo(222,765);ctx.lineTo(262,765);ctx.stroke();
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
export function createYacht() {
 const root=new THREE.Group();root.name='Sailing yacht';
 const white=new THREE.MeshStandardMaterial({color:'#e5e5db',roughness:.35,metalness:.05});
 const hullMat=new THREE.MeshStandardMaterial({color:'#edf0eb',roughness:.27,metalness:.08});
 const navy=new THREE.MeshStandardMaterial({color:'#102531',roughness:.3,metalness:.15});
 const steel=new THREE.MeshStandardMaterial({color:'#acb1b0',roughness:.24,metalness:.85});
 const wood=new THREE.MeshStandardMaterial({color:'#806750',roughness:.72});
 const ropeMat=new THREE.MeshStandardMaterial({color:'#7e8079',roughness:.85});
 const dark=new THREE.MeshStandardMaterial({color:'#10242e',metalness:.4,roughness:.18});
 const rings=[[-7.1,.025,.0],[-6.4,.64,.55],[-5.1,1.19,1.1],[-3.1,1.66,1.62],[-.8,1.86,1.85],[1.8,1.84,1.75],[4.1,1.57,1.4],[5.8,1.30,1.15]];
 const positions=[],indices=[];const sides=26;
 for(let i=0;i<rings.length;i++){
  const [z,width,depth]=rings[i];for(let j=0;j<=sides;j++){const a=(j/sides-.5)*Math.PI;positions.push(Math.sin(a)*width,.95-depth*Math.pow(Math.cos(a),.8),z);}
  if(i<rings.length-1)for(let j=0;j<sides;j++){const k=i*(sides+1)+j;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
 const hull=new THREE.Mesh(geo,hullMat);hull.castShadow=true;hull.receiveShadow=true;root.add(hull);
 // A narrow painted boot stripe reads as a hull at water level.
 for(const side of [-1,1])root.add(rope(rings.map(([z,w,d])=>[side*w*.97,.52,z]),navy,.055));
 const outline=new THREE.Shape();rings.forEach(([z,w],i)=>{if(i===0)outline.moveTo(-w,-z);else outline.lineTo(-w,-z);});[...rings].reverse().forEach(([z,w])=>outline.lineTo(w,-z));outline.closePath();
 const deck=new THREE.Mesh(new THREE.ShapeGeometry(outline),wood);deck.rotation.x=-Math.PI/2;deck.position.y=.96;deck.receiveShadow=true;root.add(deck);
 const transom=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.15,.07),hullMat);transom.position.set(0,.37,5.8);root.add(transom);
 const addBox=(size,pos,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 addBox([.18,2.6,2.8],[0,-1.8,.3],navy);
 addBox([.10,1.5,.85],[0,-1.1,5.4],navy);
 addBox([2.8,.65,4.1],[0,1.23,-.3],white);
 addBox([2.84,.09,4.18],[0,1.6,-.3],white);
 for(let s of [-1,1]){
  addBox([.02,.32,2.5],[s*1.407,1.27,-.8],dark);
  addBox([.45,.3,2.5],[s*1.30,1.11,3.7],white);
  addBox([.41,.05,2.4],[s*1.30,1.29,3.7],wood);
  for(let z=-3;z<=3;z+=1.6){const port=new THREE.Mesh(new THREE.CircleGeometry(.115,16),dark);port.position.set(s*(Math.abs(z)>2?1.59:1.8),.55,z);port.rotation.y=s*Math.PI/2;root.add(port);}
 }
 const hatch=addBox([.85,.035,1.1],[0,1.66,-1.0],dark);hatch.rotation.x=.02;
 addBox([.7,.4,.5],[0,1.12,3.8],white);
 const wheel=new THREE.Mesh(new THREE.TorusGeometry(.42,.027,8,32),steel);wheel.position.set(0,1.8,4.12);wheel.rotation.x=.12;root.add(wheel);
 root.add(cylinderBetween(new THREE.Vector3(0,1.2,4),new THREE.Vector3(0,1.8,4.16),.06,steel));
 for(let a=0;a<6;a++){let f=a/6*Math.PI*2;root.add(cylinderBetween(new THREE.Vector3(0,1.8,4.12),new THREE.Vector3(Math.cos(f)*.4,1.8+Math.sin(f)*.4,4.12),.012,steel));}
 root.add(cylinderBetween(new THREE.Vector3(0,1,-1.7),new THREE.Vector3(0,18,-1.7),.092,white));
 root.add(cylinderBetween(new THREE.Vector3(0,2.5,-1.7),new THREE.Vector3(1.4,2.65,5.0),.075,steel));
 for(const side of [-1,1]){
  root.add(cylinderBetween(new THREE.Vector3(0,9.5,-1.7),new THREE.Vector3(side*1.4,9.5,-1.7),.027,steel));
  root.add(rope([[side*1.65,1,-.8],[side*1.4,9.5,-1.7],[0,17,-1.7]],ropeMat,.013));
  const rails=rings.slice(1).map(([z,w])=>[side*w*.98,1.67,z]);root.add(rope(rails,steel,.018));
  for(let i=1;i<rings.length;i++){const [z,w]=rings[i];root.add(cylinderBetween(new THREE.Vector3(side*w*.98,.98,z),new THREE.Vector3(side*w*.98,1.68,z),.018,steel));}
 }
 root.add(rope([[0,17.8,-1.7],[0,1.12,-6.9]],ropeMat,.014));
 root.add(rope([[0,17.8,-1.7],[0,1.1,5.7]],ropeMat,.014));
 root.add(rope([[1.4,2.65,5],[0,1,3.6]],ropeMat,.019));
 const sailMat=new THREE.MeshStandardMaterial({map:makeCanvasTexture(),color:'#fffef4',emissive:'#7f837d',emissiveIntensity:.12,roughness:.87,metalness:0,side:THREE.DoubleSide});
 const main=new THREE.Mesh(sailGeometry([.1,2.7,-1.7],[.05,17.6,-1.7],[1.5,2.8,4.8],1.2),sailMat);main.castShadow=true;root.add(main);
 const jib=new THREE.Mesh(sailGeometry([.02,1.45,-6.7],[.05,16.7,-1.8],[1.1,2.6,-.1],.85),sailMat);jib.castShadow=true;root.add(jib);
 // Sail battens and reef points provide legible detail in the sail view.
 for(let y=5;y<16;y+=3){const v=(y-2.7)/14.9;const endZ=4.8*(1-v)-1.7*v;root.add(rope([[.13,y,-1.65],[.55*(1-v),y,endZ]],ropeMat,.011));}
 const flag=new THREE.Mesh(new THREE.PlaneGeometry(.65,.3,5,2),new THREE.MeshStandardMaterial({color:'#25394a',side:THREE.DoubleSide}));flag.position.set(.34,17.9,-1.7);root.add(flag);
 const buoy=new THREE.Mesh(new THREE.TorusGeometry(.32,.075,10,28),new THREE.MeshStandardMaterial({color:'#d9d9ce',roughness:.8}));buoy.position.set(-1.3,1.5,5.45);root.add(buoy);
 const world=new THREE.Group();world.add(root);world.position.set(0,0,-18);
 let lastY=0;
 const update=(time,sea,dt)=>{
  world.position.x=Math.sin(time*.008)*13;
  world.position.z=-18-time*1.15;
  const heading=-.28+Math.sin(time*.008)*.08;
  world.rotation.y=heading;
  const {x,z}=world.position;
  const h=waveHeight(x,z,time,sea);
  const sn=Math.sin(heading),cs=Math.cos(heading);
  const pitch=Math.atan((waveHeight(x+sn*5,z+cs*5,time,sea)-waveHeight(x-sn*5,z-cs*5,time,sea))/10);
  const roll=Math.atan((waveHeight(x+cs*1.7,z-sn*1.7,time,sea)-waveHeight(x-cs*1.7,z+sn*1.7,time,sea))/3.4);
  const mix=dt>=1?1:1-Math.exp(-Math.min(dt,.1)*3.0);
  lastY=THREE.MathUtils.lerp(lastY,h+.07,mix);
  root.position.y=lastY;
  root.rotation.x=THREE.MathUtils.lerp(root.rotation.x,-pitch,mix);
  root.rotation.z=THREE.MathUtils.lerp(root.rotation.z,roll-.065-sea*.08,mix);
  flag.rotation.y=Math.sin(time*5)*.18;
  return {x,z,y:lastY,heading};
 };
 return {group:world,hull:root,update};
}



