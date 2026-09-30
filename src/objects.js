import * as THREE from 'three';

export function createUnderwater(uniforms) {
 const group=new THREE.Group();group.visible=false;
 const fishGeo=new THREE.SphereGeometry(1,10,6);fishGeo.scale(1,.32,.19);
 const fishMat=new THREE.MeshStandardMaterial({color:'#9bb6bb',roughness:.30,metalness:.18});
 const count=96;const fish=new THREE.InstancedMesh(fishGeo,fishMat,count);fish.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(fish);
 const tailGeo=new THREE.BufferGeometry();tailGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.85,0,0,-1.42,.45,0,-1.42,-.45,0],3));tailGeo.computeVertexNormals();
 const tails=new THREE.InstancedMesh(tailGeo,new THREE.MeshStandardMaterial({color:'#456773',roughness:.6,side:THREE.DoubleSide}),count);tails.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(tails);
 const eyeGeo=new THREE.SphereGeometry(.038,5,4);const eyes=new THREE.InstancedMesh(eyeGeo,new THREE.MeshBasicMaterial({color:'#09171b'}),count);group.add(eyes);
 const seeds=Array.from({length:count},(_,i)=>({phase:i*2.39996,speed:.65+(Math.sin(i*7.17)+1)*.35,scale:.28+((i*137)%100)/120,school:i<62?0:1}));
 const dummy=new THREE.Object3D();const eyeDummy=new THREE.Object3D();
 const shaftMat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  vertexShader:`varying vec2 vUv; varying vec3 vPos;void main(){vUv=uv;vPos=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vPos,1.0);}`,
  fragmentShader:`uniform float uTime;uniform vec3 uSun;varying vec2 vUv;varying vec3 vPos;void main(){float edge=pow(sin(vUv.x*3.14159),3.0);float vertical=sin(vUv.y*3.14159);float shimmer=.65+.35*sin(vPos.x*.37+uTime*.5+sin(vPos.z*.31));float day=smoothstep(-.13,.14,uSun.y);gl_FragColor=vec4(.12,.37,.43,edge*vertical*shimmer*.052*day);}`});
 const shafts=[];
 const shaftUp=new THREE.Vector3(0,1,0),shaftLight=new THREE.Vector3();
 for(let i=0;i<12;i++){const mesh=new THREE.Mesh(new THREE.ConeGeometry(3+i%3,58,12,1,true),shaftMat);mesh.position.set((i%4-1.5)*14,-26,-22-Math.floor(i/4)*20);mesh.rotation.z=-.21;group.add(mesh);shafts.push(mesh);}
 const pos=new Float32Array(340*3);
 for(let i=0;i<340;i++){pos[i*3]=(Math.sin(i*19.17)*.5)*120;pos[i*3+1]=-2-(i*1.78)%55;pos[i*3+2]=(Math.cos(i*7.331)*.5)*130;}
 const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
 const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:'#719eac',size:.055,transparent:true,opacity:.28,depthWrite:false}));group.add(particles);
 return {group,update(time,camera){
   if(!group.visible)return;
   shaftLight.copy(uniforms.uSun.value);shaftLight.x*=.75;shaftLight.z*=.75;shaftLight.y=Math.sqrt(Math.max(.1,1-shaftLight.x*shaftLight.x-shaftLight.z*shaftLight.z));
   for(let i=0;i<shafts.length;i++){const shaft=shafts[i];shaft.quaternion.setFromUnitVectors(shaftUp,shaftLight);shaft.position.set((i%4-1.5)*14,0,-22-Math.floor(i/4)*20).addScaledVector(shaftLight,-29);}
   for(let i=0;i<count;i++){
    const s=seeds[i];const t=time*.065*s.speed+s.phase;
    const cx=s.school===0?-9:25,cz=s.school===0?-30:-59;
    dummy.position.set(cx+Math.sin(t)*15+Math.sin(i*2.3)*4,-9-Math.floor(i/12)*1.7+Math.sin(time*.2+i)*.5,cz+Math.cos(t)*9);
    dummy.rotation.set(Math.sin(time*2+i)*.025,Math.atan2(Math.sin(t)*9,Math.cos(t)*15),Math.sin(time*.7+i)*.04);
    dummy.scale.setScalar(s.scale);dummy.updateMatrix();fish.setMatrixAt(i,dummy.matrix);
    dummy.rotation.y+=Math.sin(time*5*s.speed+i)*.17;dummy.updateMatrix();tails.setMatrixAt(i,dummy.matrix);
    eyeDummy.position.set(.65,.09,.16).multiplyScalar(s.scale).applyEuler(dummy.rotation).add(dummy.position);eyeDummy.scale.setScalar(s.scale);eyeDummy.updateMatrix();eyes.setMatrixAt(i,eyeDummy.matrix);
   }
   fish.instanceMatrix.needsUpdate=true;tails.instanceMatrix.needsUpdate=true;eyes.instanceMatrix.needsUpdate=true;
   particles.position.x=camera.position.x;particles.position.z=camera.position.z;particles.rotation.y=time*.002;
  }};
}

export function createRain(uniforms){
 const count=2400,positions=new Float32Array(count*6),seeds=[];
 for(let i=0;i<count;i++)seeds.push({x:(Math.sin(i*132.32)*.5)*100,z:(Math.cos(i*173.12)*.5)*100,y:(i*.731)%50,l:.65+(i%8)*.15});
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const material=new THREE.LineBasicMaterial({color:'#b9cad4',transparent:true,opacity:.2,depthWrite:false});
 const lines=new THREE.LineSegments(g,material);lines.frustumCulled=false;lines.visible=false;
 return {object:lines,update(time,camera,intensity){
  lines.visible=intensity>.01&&camera.position.y>0;if(!lines.visible)return;
  lines.position.set(camera.position.x,camera.position.y-15,camera.position.z);
  for(let i=0;i<count;i++){const s=seeds[i];const y=((s.y-time*28)%50+50)%50;const j=i*6;positions[j]=s.x+y*.19;positions[j+1]=y;positions[j+2]=s.z;positions[j+3]=s.x+(y-s.l)*.19;positions[j+4]=y-s.l;positions[j+5]=s.z;}
  g.attributes.position.needsUpdate=true;material.opacity=.16*intensity;
 }};
}
export function createLightning(){
 const group=new THREE.Group();const material=new THREE.LineBasicMaterial({color:'#d8e4ff',transparent:true,opacity:1,toneMapped:false});
 const points=[];for(let i=0;i<=18;i++)points.push(new THREE.Vector3(300+Math.sin(i*23.1)*17,600-i*31,-1250+Math.sin(i*17.3)*9));
 const bolt=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);group.add(bolt);
 for(let b=0;b<3;b++){const start=points[b*4+4],ps=[start];for(let i=1;i<=6;i++)ps.push(new THREE.Vector3(start.x+i*13+Math.sin(i*14)*7,start.y-i*18,start.z));group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ps),material));}
 group.visible=false;return {group,material};
}


