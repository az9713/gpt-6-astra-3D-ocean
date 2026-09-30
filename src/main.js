import * as THREE from 'three';
import './style.css';
import { createUniforms, createSky, updateSun } from './atmosphere.js';
import { createOcean, waveHeight } from './ocean.js';
import { createYacht } from './yacht.js';
import { createUnderwater, createRain, createLightning } from './objects.js';

const canvas=document.querySelector('#ocean');
const state={sea:.43,timeOfDay:15.5,clouds:.35,rain:false,yacht:true,paused:false,view:'cinematic',sound:false};
const presets={clear:{sea:.43,timeOfDay:15.5,clouds:.35,rain:false},sunset:{sea:.29,timeOfDay:18.45,clouds:.40,rain:false},storm:{sea:.9,timeOfDay:14.0,clouds:.98,rain:true},night:{sea:.30,timeOfDay:0,clouds:.24,rain:false}};
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(error){document.querySelector('#loading').hidden=true;const e=document.querySelector('#error');e.hidden=false;e.textContent='This ocean needs WebGL 2. Please enable hardware acceleration in your browser and reload.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(49,innerWidth/innerHeight,.15,19000);camera.position.set(46,10,97);
const uniforms=createUniforms();
const sky=createSky(uniforms);scene.add(sky);
const ocean=createOcean(uniforms);scene.add(ocean.mesh);
const sun=new THREE.DirectionalLight('#fff2da',2);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;sun.shadow.camera.near=.5;sun.shadow.camera.far=700;sun.shadow.bias=-.00035;sun.shadow.normalBias=.03;scene.add(sun,sun.target);
const hemi=new THREE.HemisphereLight('#aac9ed','#15333e',1);scene.add(hemi);
const yacht=createYacht();scene.add(yacht.group);
const underwater=createUnderwater(uniforms);scene.add(underwater.group);
const rain=createRain(uniforms);scene.add(rain.object);
const lightning=createLightning();scene.add(lightning.group);
const underwaterFog=new THREE.FogExp2('#021b2b',.022);
// Object reflection excludes the sky (the water evaluates the sky analytically).
const reflectionTarget=new THREE.WebGLRenderTarget(768,512,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:THREE.HalfFloatType});
reflectionTarget.texture.colorSpace=THREE.LinearSRGBColorSpace;
const reflectedCamera=camera.clone();
const biasMatrix=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
const reflectionMatrix=new THREE.Matrix4();
const keys=new Set();let drag=null,yaw=0,pitch=0,flightSpeed=16,simTime=0,viewStart=0,lastNow=performance.now(),frames=0,statsAt=lastNow,fps=60,frameTimes=[],totalFrames=0;
let forceFlashUntil=-1,nextLightningAt=7,lightningStart=-100,lastToast=0,toastTimer,introDismissed=false,autoTour=true;
let audioContext=null,oceanGain=null,rainGain=null,audioSource=null;
const lookTarget=new THREE.Vector3(-13,1,-65),tempVec=new THREE.Vector3(),boatForward=new THREE.Vector2();
let boatData=yacht.update(0,state.sea,1);

function toast(message,duration=3600){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),duration);lastToast=performance.now();}
function dismissIntro(){if(!introDismissed){document.querySelector('#intro').classList.add('dismissed');introDismissed=true;}}
function syncUI(preset=null){
 for(const name of ['sea','daytime','clouds']){const el=document.getElementById(name);const value=name==='daytime'?state.timeOfDay:state[name];el.value=value;el.style.setProperty('--progress',`${value/(name==='daytime'?24:1)*100}%`);}
 const names=['Glassy','Gentle','Moderate','Fresh','Rough','Storm'];document.querySelector('#sea-value').textContent=names[Math.min(5,Math.floor(state.sea*6))];
 const totalMinutes=Math.round(state.timeOfDay*60),hour=Math.floor(totalMinutes/60)%24,minute=totalMinutes%60;document.querySelector('#daytime-value').textContent=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
 document.querySelector('#clouds-value').textContent=`${Math.round(state.clouds*100)}%`;
 for(const name of ['rain','yacht'])document.getElementById(name).setAttribute('aria-checked',String(state[name]));
 document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===preset));
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
 document.querySelector('#mode-label').textContent=({cinematic:'CINEMATIC DRIFT',sail:'ALONGSIDE',underwater:'BELOW THE SURFACE',free:'FREE FLIGHT'})[state.view];
 document.querySelector('#wind-label').textContent=`WIND ${Math.round(1+state.sea*31)} KN`;
 document.querySelector('#live-label').textContent=state.paused?'SEA PAUSED':'LIVE SIMULATION';
}
function applyPreset(name){if(!presets[name])return;Object.assign(state,presets[name]);syncUI(name);dismissIntro();if(state.view==='underwater'&&name==='night')toast('Moonlight reaches only a little way below.');}
function readCameraAngles(){tempVec.set(0,0,-1).applyQuaternion(camera.quaternion);yaw=Math.atan2(-tempVec.x,-tempVec.z);pitch=Math.asin(THREE.MathUtils.clamp(tempVec.y,-1,1));}
function setView(view,{immediate=false,notify=true}={}){
 if(!['cinematic','sail','underwater','free'].includes(view))throw new Error(`Unknown camera view: ${view}`);
 state.view=view;viewStart=simTime;autoTour=false;dismissIntro();
 if(view==='free'){readCameraAngles();if(notify)toast('Drag to look · WASD to move · Q / E down and up');}
 if(view==='underwater'&&notify)toast('Below the surface · suspended light and passing life');
 if(view==='cinematic'){autoTour=false;}
 if(immediate&&view!=='free')updateCamera(1,true);
 syncUI();
}
function updateCamera(dt,immediate=false){
 const boat=yacht.group.position;
 if(state.view==='free'){
  const speed=flightSpeed*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1)*dt;
  const forward=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const move=new THREE.Vector3();if(keys.has('KeyW')||keys.has('ArrowUp'))move.add(forward);if(keys.has('KeyS')||keys.has('ArrowDown'))move.sub(forward);if(keys.has('KeyD')||keys.has('ArrowRight'))move.add(right);if(keys.has('KeyA')||keys.has('ArrowLeft'))move.sub(right);if(keys.has('KeyE'))move.y+=1;if(keys.has('KeyQ'))move.y-=1;
  if(move.lengthSq()>0)camera.position.addScaledVector(move.normalize(),speed);
  camera.position.y=THREE.MathUtils.clamp(camera.position.y,-70,450);camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;camera.rotation.z=0;
  return;
 }
 let pos,target;const t=simTime-viewStart;
 if(state.view==='cinematic'){
  const tour=autoTour?Math.min(t/70,1):Math.min(t/180,.4);
  pos=new THREE.Vector3(46-Math.sin(t*.012)*14,10+Math.sin(t*.025)*1.7,boat.z+115-tour*35);
  target=new THREE.Vector3(boat.x-13,1.2+Math.sin(t*.02)*.4,boat.z-47);
  if(autoTour&&t>72){setView('free');return;}
 }else if(state.view==='sail'){
  pos=new THREE.Vector3(boat.x+26+Math.sin(t*.022)*4,6.8+Math.sin(t*.06)*.45,boat.z+29);
  target=new THREE.Vector3(boat.x,6.4,boat.z-.4);
 }else{
  pos=new THREE.Vector3(15+Math.sin(t*.025)*6,-9.3+Math.sin(t*.1)*.45,25-Math.sin(t*.017)*9);
  target=new THREE.Vector3(-7,-3.0,-39);
 }
 const ease=immediate?1:1-Math.exp(-dt*.7);
 camera.position.lerp(pos,ease);lookTarget.lerp(target,ease);camera.lookAt(lookTarget);
}
function updateEnvironment(dt){
 uniforms.uTime.value=simTime;
 uniforms.uCameraXZ.value.set(Math.round(camera.position.x/3)*3,Math.round(camera.position.z/3)*3);
 const light=updateSun(uniforms,state.timeOfDay,sun,hemi,state.sea,state.rain?1:0,state.clouds);
 boatData=yacht.update(simTime,state.sea,dt);yacht.group.visible=state.yacht;
 uniforms.uBoat.value.set(boatData.x,boatData.y,boatData.z);boatForward.set(-Math.sin(boatData.heading),-Math.cos(boatData.heading));uniforms.uBoatDir.value.copy(boatForward);uniforms.uBoatVisible.value=state.yacht?1:0;uniforms.uBoatSpeed.value=1.15;
 sun.position.add(yacht.group.position);sun.target.position.copy(yacht.group.position);
 const below=camera.position.y<waveHeight(camera.position.x,camera.position.z,simTime,state.sea)-.2;
 uniforms.uUnderwater.value=below?1:0;underwater.group.visible=below;scene.fog=below?underwaterFog:null;
 underwaterFog.color.setRGB(.0008,.0205,.0375).multiplyScalar(.25+.75*light.day);hemi.groundColor.set(below?'#073641':'#122833');
 renderer.toneMappingExposure=below?1.12:(1.16+(1-light.day)*.27);
 if(below){hemi.intensity=.6+light.day*1.2;sun.intensity*=.8;}
 underwater.update(simTime,camera);rain.update(simTime,camera,state.rain?1:0);
 if(state.rain&&simTime>nextLightningAt){lightningStart=simTime;nextLightningAt=simTime+11+Math.abs(Math.sin(simTime*53.1))*16;}
 const flashAge=simTime-lightningStart;
 const flash=(state.rain&&flashAge>=0&&flashAge<.72)?(Math.exp(-flashAge*12)+Math.exp(-Math.pow((flashAge-.27)*30,2))*.62):0;
 uniforms.uLightning.value=Math.max(flash,simTime<forceFlashUntil?.9:0);lightning.group.visible=uniforms.uLightning.value>.1&&!below;lightning.material.opacity=Math.min(1,uniforms.uLightning.value*1.2);
 sky.position.copy(camera.position);
 if(oceanGain&&audioContext){oceanGain.gain.setTargetAtTime(state.sound?.06+state.sea*.12:0,audioContext.currentTime,.5);rainGain.gain.setTargetAtTime(state.sound&&state.rain?.08:0,audioContext.currentTime,.5);}
}
function renderReflection(){
 if(!state.yacht||uniforms.uUnderwater.value>.5||camera.position.distanceTo(yacht.group.position)>400){ocean.uniforms.uHasReflection.value=0;return;}
 reflectedCamera.copy(camera);reflectedCamera.position.y=-camera.position.y;
 const direction=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);const target=camera.position.clone().add(direction);target.y=-target.y;
 reflectedCamera.up.set(0,-1,0);reflectedCamera.lookAt(target);reflectedCamera.updateMatrixWorld();reflectedCamera.updateProjectionMatrix();
 reflectionMatrix.copy(biasMatrix).multiply(reflectedCamera.projectionMatrix).multiply(reflectedCamera.matrixWorldInverse);
 ocean.uniforms.uReflectionMatrix.value.copy(reflectionMatrix);ocean.uniforms.uReflection.value=reflectionTarget.texture;ocean.uniforms.uHasReflection.value=1;
 const skyVisible=sky.visible,rainVisible=rain.object.visible,lightningVisible=lightning.group.visible;
 ocean.mesh.visible=false;sky.visible=false;rain.object.visible=false;lightning.group.visible=false;
 renderer.setRenderTarget(reflectionTarget);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(scene,reflectedCamera);renderer.setRenderTarget(null);renderer.setClearColor(0x07131d,1);
 ocean.mesh.visible=true;sky.visible=skyVisible;rain.object.visible=rainVisible;lightning.group.visible=lightningVisible;
}
function render(){renderReflection();renderer.render(scene,camera);totalFrames++;}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);reflectionTarget.setSize(Math.min(768,Math.round(innerWidth*.5)),Math.min(512,Math.round(innerHeight*.5)));}
addEventListener('resize',resize);
function tick(now){
 const elapsed=(now-lastNow)/1000;lastNow=now;const dt=Math.max(0,Math.min(elapsed,.05));
 if(!state.paused)simTime+=dt;
 updateCamera(dt);updateEnvironment(state.paused?0:dt);render();
 frames++;frameTimes.push(elapsed*1000);if(frameTimes.length>240)frameTimes.shift();
 if(now-statsAt>1000){fps=Math.round(frames*1000/(now-statsAt));document.querySelector('#fps-label').textContent=`${fps} FPS`;frames=0;statsAt=now;}
 if(!introDismissed&&simTime>15)dismissIntro();
 requestAnimationFrame(tick);
}

for(const name of ['sea','daytime','clouds'])document.getElementById(name).addEventListener('input',e=>{state[name==='daytime'?'timeOfDay':name]=Number(e.target.value);dismissIntro();syncUI();});
for(const name of ['rain','yacht'])document.getElementById(name).addEventListener('click',()=>{state[name]=!state[name];dismissIntro();syncUI();});
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>applyPreset(b.dataset.preset)));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelector('#panel-toggle').addEventListener('click',()=>{const panel=document.querySelector('.control-panel');const collapsed=panel.classList.toggle('collapsed');document.querySelector('#panel-toggle').setAttribute('aria-expanded',String(!collapsed));document.querySelector('#panel-icon').textContent=collapsed?'+':'−';});
const help=document.querySelector('#help');document.querySelector('#info-toggle').addEventListener('click',()=>help.showModal());help.addEventListener('click',e=>{if(e.target===help)help.close();});
document.querySelector('#brand').addEventListener('click',e=>{e.preventDefault();Object.assign(state,presets.clear);simTime=0;setView('cinematic',{immediate:true,notify:false});autoTour=true;introDismissed=false;document.querySelector('#intro').classList.remove('dismissed');syncUI('clear');});
canvas.addEventListener('pointerdown',e=>{canvas.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(state.view==='free'){yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch-dy*.003,-Math.PI*.47,Math.PI*.47);}else if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>7){setView('free',{notify:false});yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch-dy*.003,-Math.PI*.47,Math.PI*.47);toast('Free flight · WASD to move · Q / E down and up');}drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<7){const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1),camera);const hit=new THREE.Vector3();if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit)&&hit.distanceTo(camera.position)<400)ocean.addRipple(hit.x,hit.z,simTime);}drag=null;});
canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('wheel',e=>{if(state.view==='free'){e.preventDefault();flightSpeed=THREE.MathUtils.clamp(flightSpeed*Math.exp(-e.deltaY*.001),2,120);if(performance.now()-lastToast>600)toast(`Flight speed ${Math.round(flightSpeed)} m/s`,1100);}},{passive:false});
addEventListener('keydown',e=>{
 const input=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');if(input||help.open)return;
 if(e.code==='Space'&&/^(BUTTON|A)$/.test(document.activeElement?.tagName||''))return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);
 if(e.repeat)return;
 if(e.code==='KeyF')setView('free');if(e.code==='KeyH')help.showModal();if(e.code==='Space'){state.paused=!state.paused;syncUI();toast(state.paused?'The sea is paused':'The sea is moving');}if(e.code==='Escape')setView('cinematic',{notify:false});
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();drag=null;});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('Graphics context interrupted. Reload to return to the ocean.',15000);});
async function toggleSound(){
 if(!audioContext){
  audioContext=new (window.AudioContext||window.webkitAudioContext)();const buffer=audioContext.createBuffer(1,audioContext.sampleRate*4,audioContext.sampleRate);const data=buffer.getChannelData(0);let last=0;
  for(let i=0;i<data.length;i++){last=(last+Math.random()*.04-.02)/1.02;data[i]=last*3.5;}
  audioSource=audioContext.createBufferSource();audioSource.buffer=buffer;audioSource.loop=true;
  const low=audioContext.createBiquadFilter();low.type='lowpass';low.frequency.value=850;const high=audioContext.createBiquadFilter();high.type='highpass';high.frequency.value=1800;
  oceanGain=audioContext.createGain();oceanGain.gain.value=0;rainGain=audioContext.createGain();rainGain.gain.value=0;audioSource.connect(low).connect(oceanGain).connect(audioContext.destination);audioSource.connect(high).connect(rainGain).connect(audioContext.destination);audioSource.start();
 }
 await audioContext.resume();state.sound=!state.sound;
 document.querySelector('#sound-toggle').setAttribute('aria-label',state.sound?'Mute ocean sound':'Enable ocean sound');document.querySelector('#sound-toggle').innerHTML=state.sound?'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5ZM15 8q5 4 0 8m3-11q8 7 0 14"/></svg>':'<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4V5ZM16 9l5 6m0-6-5 6"/></svg>';
}
document.querySelector('#sound-toggle').addEventListener('click',()=>toggleSound().catch(error=>toast(`Sound unavailable: ${error.message}`)));

// Deliberately small automation API. It never accesses network or persistent data.
window.oceanQA={
 ready:true,
 state:()=>({...state,simulationTime:simTime}),
 setScene(options={}){
  if(options.preset&&presets[options.preset])Object.assign(state,presets[options.preset]);
  const sea=options.sea??options.seaState;if(sea!==undefined)state.sea=THREE.MathUtils.clamp(Number(sea),0,1);
  const day=options.timeOfDay??options.time;if(day!==undefined)state.timeOfDay=THREE.MathUtils.clamp(Number(day),0,24);
  if(options.clouds!==undefined)state.clouds=THREE.MathUtils.clamp(Number(options.clouds),0,1);
  for(const key of ['rain','yacht','paused'])if(options[key]!==undefined)state[key]=Boolean(options[key]);
  if(Number.isFinite(options.simulationTime))simTime=Math.max(0,options.simulationTime);
  if(options.view)setView(options.view,{immediate:options.immediate!==false,notify:false});
  if(options.intro!==undefined){introDismissed=!options.intro;document.querySelector('#intro').classList.toggle('dismissed',!options.intro);}
  syncUI(options.preset);updateEnvironment(1);if(options.view&&options.immediate!==false)updateCamera(1,true);updateEnvironment(1);render();return this.state();
 },
 setView(view,options={}){setView(view,{immediate:true,notify:false,...options});updateEnvironment(.1);render();return this.state();},
 setCamera(position,target){state.view='free';autoTour=false;camera.position.fromArray(position);if(target)camera.lookAt(new THREE.Vector3(...target));readCameraAngles();syncUI();updateEnvironment(.1);render();},
 step(seconds=1/60){const capped=THREE.MathUtils.clamp(Number(seconds)||0,0,.1);simTime+=capped;updateCamera(capped);updateEnvironment(capped);render();return this.diagnostics();},
 ripple(x=0,z=0,strength=1){ocean.addRipple(x,z,simTime,strength);},
 lightning(){forceFlashUntil=simTime+.6;updateEnvironment(0);render();},
 diagnostics(){const sorted=[...frameTimes].sort((a,b)=>a-b);return {state:this.state(),camera:camera.position.toArray(),rotation:camera.rotation.toArray(),fps,frameMsMedian:sorted[Math.floor(sorted.length*.5)]??0,frameMsP95:sorted[Math.floor(sorted.length*.95)]??0,totalFrames,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),underwater:uniforms.uUnderwater.value===1,webgl2:renderer.capabilities.isWebGL2,finite:camera.position.toArray().every(Number.isFinite)&&Number.isFinite(simTime)};},
 waveHeight:(x,z)=>waveHeight(x,z,simTime,state.sea),
 canvas,
};
resize();syncUI('clear');updateCamera(1,true);updateEnvironment(.1);render();requestAnimationFrame(tick);
requestAnimationFrame(()=>{document.querySelector('#loading').classList.add('done');setTimeout(()=>document.querySelector('#loading').remove(),1000);});




