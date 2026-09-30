import * as THREE from 'three';
import { atmosphereGLSL, uniformDeclarations } from './atmosphere.js';

// Deep-water dispersion: angular frequency sqrt(g k). These exact terms are
// shared by CPU buoyancy and the GPU surface, so the hull follows the sea.
export const WAVES = [
 {d:[.92,.39],l:116,a:1.95,q:.60,p:.2},
 {d:[.75,.66],l:63,a:1.04,q:.67,p:2.4},
 {d:[.99,-.14],l:38,a:.56,q:.61,p:5.3},
 {d:[.34,.94],l:24,a:.33,q:.62,p:1.7},
 {d:[.84,-.54],l:16.2,a:.22,q:.56,p:4.1},
 {d:[-.42,.91],l:10.4,a:.14,q:.51,p:3.4},
 {d:[.95,.31],l:7.0,a:.10,q:.48,p:6.3},
 {d:[.64,.77],l:4.5,a:.060,q:.40,p:.7},
 {d:[-.71,.70],l:2.9,a:.030,q:.31,p:4.5},
 {d:[.23,.97],l:1.9,a:.017,q:.22,p:2.0},
].map(w=>({...w,d:new THREE.Vector2(...w.d).normalize(),k:Math.PI*2/w.l,omega:Math.sqrt(9.81*Math.PI*2/w.l)}));
export function waveHeight(x,z,t,sea){
 const scale=.028+Math.pow(sea,1.55)*2.65;
 let px=x,pz=z;
 // Invert horizontal Gerstner displacement before sampling a world position.
 // Contraction is bounded by the summed steepness; four iterations suffice.
 for(let iteration=0;iteration<4;iteration++){
  let ox=0,oz=0;
  for(const w of WAVES){const f=w.k*(w.d.x*px+w.d.y*pz)-w.omega*t+w.p;const c=w.q/Math.max(scale,.2)*w.a*scale*Math.cos(f);ox+=w.d.x*c;oz+=w.d.y*c;}
  px=x-ox;pz=z-oz;
 }
 let h=0;
 for(const w of WAVES)h+=w.a*scale*Math.sin(w.k*(w.d.x*px+w.d.y*pz)-w.omega*t+w.p);
 return h;
}
const waveCalls=WAVES.map(w=>`wave(vec2(${w.d.x.toFixed(6)},${w.d.y.toFixed(6)}),${w.k.toFixed(6)},${w.a.toFixed(6)},${w.q.toFixed(6)},${w.omega.toFixed(6)},${w.p.toFixed(6)},p,dx,dz);`).join('\n');

export function createOcean(uniforms,quality='high') {
 const segments=quality==='high'?380:260;
 const g=new THREE.PlaneGeometry(2,2,segments,segments);g.rotateX(-Math.PI/2);
 const p=g.attributes.position;
 for(let i=0;i<p.count;i++) {
  let x=p.getX(i),z=p.getZ(i);const r=Math.max(Math.abs(x),Math.abs(z));
  const scale=105+Math.pow(r,3.0)*9200;
  p.setXYZ(i,x*scale,0,z*scale);
 }
 g.computeBoundingSphere();
 const rippleSlots=12;
 const ripples=Array.from({length:rippleSlots},()=>new THREE.Vector4(0,0,-1000,0));
 const u={...uniforms,uRipples:{value:ripples},uReflection:{value:new THREE.Texture()},uReflectionMatrix:{value:new THREE.Matrix4()},uHasReflection:{value:0}};
 const material=new THREE.ShaderMaterial({
  uniforms:u,side:THREE.DoubleSide,
  vertexShader:uniformDeclarations+`
   varying vec3 vWorld,vNormal;
   varying float vBreaking;
   void wave(vec2 dir,float k,float amp,float steep,float freq,float phase,inout vec3 p,inout vec3 dx,inout vec3 dz){
    float scale=.028+pow(uSea,1.55)*2.65;
    float wavelength=6.28318530718/k;
    float distanceFade=1.0-smoothstep(wavelength*11.0,wavelength*34.0,length(position.xz+uCameraXZ-cameraPosition.xz));
    float a=amp*scale*distanceFade;
    float f=k*dot(dir,position.xz+uCameraXZ)-freq*uTime+phase;
    float s=sin(f),c=cos(f);
    float q=steep/(max(scale,.2));
    p.xz+=q*a*dir*c;p.y+=a*s;
    dx+=vec3(-q*a*k*dir.x*dir.x*s,a*k*dir.x*c,-q*a*k*dir.x*dir.y*s);
    dz+=vec3(-q*a*k*dir.x*dir.y*s,a*k*dir.y*c,-q*a*k*dir.y*dir.y*s);
   }
   void main(){
    vec3 p=vec3(position.x+uCameraXZ.x,0.0,position.z+uCameraXZ.y);
    vec3 dx=vec3(1,0,0),dz=vec3(0,0,1);
    ${waveCalls}
    vNormal=normalize(cross(dz,dx));
    vBreaking=1.0-(dx.x*dz.z-dx.z*dz.x);
    vWorld=p;
    gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);
   }`,
  fragmentShader:uniformDeclarations+`
   uniform vec4 uRipples[12];
   uniform sampler2D uReflection;
   uniform mat4 uReflectionMatrix;
   uniform float uHasReflection;
   varying vec3 vWorld,vNormal;
   varying float vBreaking;
   `+atmosphereGLSL+`
   void detailWave(vec2 d,float k,float amp,float speed,vec2 p,inout vec2 grad,float fade){
     grad+=d*cos(dot(d,p)*k-uTime*speed)*amp*fade;
   }
   void main(){
    vec3 V=normalize(cameraPosition-vWorld);
    float dist=length(cameraPosition-vWorld);
    vec2 p=vWorld.xz;
    float wind=.10+uSea*.90;
    vec2 grad=vec2(0.0);
    vec2 detailP=p+vec2(noise2(p*.17+2.0),noise2(p*.21+19.0))*.85;
    float f1=1.0-smoothstep(70.0,320.0,dist);
    float f2=1.0-smoothstep(18.0,150.0,dist);
    float f3=1.0-smoothstep(8.0,60.0,dist);
    detailWave(normalize(vec2(.93,.37)),4.2,.045,3.8,detailP,grad,f1);
    detailWave(normalize(vec2(.64,.77)),6.6,.046,4.9,detailP,grad,f1);
    detailWave(normalize(vec2(-.41,.91)),10.5,.028,6.7,detailP,grad,f2);
    detailWave(normalize(vec2(.95,-.3)),15.8,.023,8.6,detailP,grad,f2);
    detailWave(normalize(vec2(.33,.94)),25.5,.017,11.5,detailP,grad,f3);
    detailWave(normalize(vec2(-.76,.65)),39.0,.012,14.2,detailP,grad,f3);
    // Analytic, finite-duration impulses: no frame-dependent feedback solver.
    float rippleFoam=0.0;
    for(int i=0;i<12;i++){
      float age=uTime-uRipples[i].z;
      if(age>0.0&&age<9.0){
       vec2 rp=p-uRipples[i].xy;float r=length(rp);float front=r-age*3.5;
       float envelope=exp(-front*front*.7)*exp(-age*.6)*uRipples[i].w;
       grad+=rp/max(r,.1)*cos(front*6.0)*envelope*.22;
       rippleFoam+=envelope*.05;
      }
    }
    vec2 rel=p-uBoat.xz;
    vec2 forward=normalize(uBoatDir);
    float along=-dot(rel,forward);
    float across=dot(rel,vec2(-forward.y,forward.x));
    float wakeLength=clamp(uBoatSpeed*22.0,10.0,100.0);
    float wakeMask=smoothstep(1.0,5.0,along)*(1.0-smoothstep(wakeLength*.5,wakeLength,along))*uBoatVisible;
    float wing=abs(across)-along*.23;
    float wEnvelope=exp(-wing*wing/(.45+max(along,0.0)*.055))*wakeMask;
    grad+=vec2(-forward.y,forward.x)*sin(wing*4.1-uTime*2.0)*wEnvelope*.16;
    float trail=exp(-across*across/(.8+max(along,0.0)*.065))*wakeMask;
    vec3 N=normalize(vNormal+vec3(-grad.x*wind*.66,0,-grad.y*wind*.66));
    if(!gl_FrontFacing) N=-N;
    float NoV=clamp(dot(N,V),.001,1.0);
    float fresnel=.0204+.9796*pow(1.0-NoV,5.0);
    vec3 rd=reflect(-V,N);rd.y=max(rd.y,.003);
    vec3 reflected=atmosphere(normalize(rd),false);
    float day=smoothstep(-.13,.14,uSun.y);
    float surfaceLight=.73+.27*dot(N,uSun);
    float shadow=1.0-cloudField(p+uSun.xz*(1500.0/max(uSun.y,.05))+vec2(uTime*7.5,uTime*2.0))*uClouds*.48*day;
    // Absorption dominates the body. Transmission is confined to thin crests.
    vec3 deep=mix(vec3(.0015,.006,.012),vec3(.002,.031,.058),day);
    deep*=surfaceLight*shadow;
    float crest=smoothstep(.35,2.3,vWorld.y)*pow(1.0-NoV,1.7);
    float backlight=pow(max(dot(V,-uSun),0.0),3.0);
    deep+=vec3(.002,.091,.10)*crest*(.2+.8*backlight)*day*(1.0-uRain*.6);
    vec3 col=mix(deep,reflected*.86,fresnel);
    vec3 H=normalize(V+uSun);
    float rough=mix(.015,.056,uSea);
    float alpha=rough*rough;
    float nh=max(dot(N,H),0.0);
    float denom=nh*nh*(alpha-1.0)+1.0;
    float D=alpha/(PI*denom*denom+.000002);
    float spec=min(D*.009,24.0)*max(dot(N,uSun),0.0);
    col+=uSunColor*spec*day*(1.0-uRain*.94)*shadow;
    vec3 moon=normalize(vec3(-.52,.30,-.74));
    float moonSpec=pow(max(dot(reflect(-moon,N),V),0.0),750.0)*1.1;
    col+=vec3(.16,.25,.40)*moonSpec*(1.0-day)*(1.0-uRain*.9);
    if(uHasReflection>.5){
     vec4 projected=uReflectionMatrix*vec4(vWorld,1.0);
     vec2 uv=projected.xy/projected.w;
     uv+=N.xz*.0045*(1.0-smoothstep(15.0,140.0,dist));
     if(uv.x>0.0&&uv.x<1.0&&uv.y>0.0&&uv.y<1.0){vec4 refl=texture2D(uReflection,uv);col=mix(col,refl.rgb,refl.a*fresnel*.75);}
    }
    float foamNoise=fbm(p*.62+vec2(uTime*.3,-uTime*.16));
    float threshold=mix(.34,.19,uSea);
    float crestGrain=noise2(vec2(dot(p,vec2(.92,.39))*.48,dot(p,vec2(-.39,.92))*2.4)+vec2(uTime*.12,0));
    float whitecap=smoothstep(threshold,threshold+.065,vBreaking)*smoothstep(.47,.72,foamNoise)*smoothstep(.35,.65,crestGrain)*smoothstep(.25,.75,uSea);
    whitecap*=smoothstep(.20,1.25,vWorld.y)*(1.0-smoothstep(300.0,1600.0,dist));
    float wakeFoam=(wEnvelope*.23+trail*.20)*smoothstep(.3,.7,foamNoise);
    float bowX=along+5.9,bowZ=abs(across)-1.15;
    float bow=exp(-bowX*bowX*1.8)*exp(-bowZ*bowZ*2.0)*uBoatVisible;
    float foam=clamp(whitecap+wakeFoam+bow*.43+rippleFoam,0.0,.90);
    vec3 foamColor=mix(vec3(.038,.055,.075),vec3(.43,.55,.60),day)*shadow;
    col=mix(col,foamColor,foam);
    float fog=1.0-exp(-dist*.000075*(1.0+uRain*14.0));
    vec3 horizon=atmosphere(normalize(vec3(-V.x,.009,-V.z)),false);
    col=mix(col,horizon,fog*(.74+uRain*.12));
    if(uUnderwater>.5){
     float window=pow(max(dot(normalize(vec3(N.x,-abs(N.y),N.z)),V),0.0),2.0);
     vec3 under=vec3(.003,.075,.11)*(.22+.78*day);
     col=mix(under,reflected,window*.72);
     col+=vec3(.0,.04,.045)*sin(p.x*.4+p.y*.5+uTime)*.2;
     col=mix(col,underwaterAmbient(normalize(vWorld-cameraPosition)),1.0-exp(-dist*.012));
    }
    col+=uLightning*vec3(.15,.2,.27);
    gl_FragColor=vec4(max(col,vec3(0)),1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`
 });
 const mesh=new THREE.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=0;
 let nextRipple=0;
 return {mesh,material,uniforms:u,addRipple(x,z,time,strength=1){ripples[nextRipple].set(x,z,time,THREE.MathUtils.clamp(strength,0,2));nextRipple=(nextRipple+1)%rippleSlots;},dispose(){g.dispose();material.dispose();}};
}






