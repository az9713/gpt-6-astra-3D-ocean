import * as THREE from 'three';

export const atmosphereGLSL = /* glsl */`
const float PI = 3.14159265359;
float hash21(vec2 p) { p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
float noise2(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1)),f.x),f.y);
}
float fbm(vec2 p) {
  float f=0.0,a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){f+=a*noise2(p);p=m*p+vec2(14.3,7.1);a*=.5;}
  return f;
}
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise3(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float cloudVolume(vec3 p){return noise3(p)*.58+noise3(p*2.07+11.0)*.28+noise3(p*4.13+27.0)*.14;}
float cloudField(vec2 p) {
  p*=.00046;
  vec2 warp=vec2(noise2(p*.65+vec2(17,3)),noise2(p*.61+vec2(5,29)));
  p+=warp*1.6;
  float n=fbm(p);
  n+=.12*noise2(p*3.7+vec2(13,21));
  return smoothstep(.73-uClouds*.33,.86-uClouds*.34,n)*smoothstep(0.0,.08,uClouds);
}
vec3 underwaterAmbient(vec3 rd){
 float day=smoothstep(-.13,.14,uSun.y);
 float vertical=smoothstep(-.75,.35,rd.y);
 return mix(vec3(.0004,.007,.017),vec3(.001,.025,.044),vertical)*(.25+.75*day);
}
vec3 atmosphere(vec3 rd, bool detail) {
  float day=smoothstep(-.13,.14,uSun.y);
  float dusk=exp(-abs(uSun.y)*7.0);
  float elev=max(rd.y,0.0);
  float horizon=pow(1.0-elev,4.0);
  float toward=pow(max(dot(rd,uSun),0.0),5.0);
  vec3 zenith=mix(vec3(.003,.006,.016),vec3(.040,.145,.34),day);
  vec3 low=mix(vec3(.019,.031,.049),vec3(.34,.51,.65),day);
  low=mix(low,vec3(.63,.235,.105),dusk*toward*.71);
  zenith=mix(zenith,vec3(.16,.22,.29),uRain*.7*day);
  low=mix(low,vec3(.27,.32,.36),uRain*.69*day);
  vec3 col=mix(zenith,low,horizon);
  col+=uSunColor*pow(max(dot(rd,uSun),0.0),32.0)*(.16+.26*dusk)*(1.0-uRain*.8);
  float sd=dot(rd,uSun);
  float sunDisc=smoothstep(.999975,.999993,sd);
  col+=uSunColor*((detail?sunDisc*18.0:0.0)+pow(max(sd,0.0),1100.0)*.24)*(1.0-uRain*.97)*step(-.055,uSun.y);
  vec3 moonDir=normalize(vec3(-.52,.30,-.74));
  float md=dot(rd,moonDir);
  float moon=smoothstep(.99991,.999945,md);
  col+=(vec3(.64,.75,.91)*(detail?moon*3.8:0.0)+vec3(.055,.079,.12)*pow(max(md,0.0),250.0))*(1.0-day)*(1.0-uRain*.9);
  if (detail && rd.y>.005) {
    vec2 stars=vec2(atan(rd.z,rd.x),asin(rd.y))*vec2(640.0,640.0);
    vec2 sf=fract(stars)-.5;
    float star=pow(max(0.0,1.0-length(sf)*2.0),8.0)*step(.997,hash21(floor(stars)));
    col+=star*vec3(.68,.76,1.0)*(1.0-day)*smoothstep(.03,.3,rd.y)*1.4;
  }
  if(rd.y>0.007) {
    vec2 cp=rd.xz*(1500.0/max(rd.y,.018))+uCameraXZ+vec2(uTime*7.5,uTime*2.0);
    float c=cloudField(cp);
    float edge=cloudField(cp+uSun.xz*220.0);
    float shade=clamp((c-edge)*2.7+.48,.08,1.0);
    vec3 cloudDark=mix(vec3(.009,.016,.03),vec3(.17,.225,.29),day);
    vec3 cloudLight=mix(vec3(.035,.052,.083),vec3(.95,.96,.93),day);
    cloudLight=mix(cloudLight,vec3(.9,.45,.23),dusk*toward*.74);
    cloudLight=mix(cloudLight,vec3(.40,.47,.54),uRain*.78);
    if(detail){
      // Integrate a finite cloud layer: varying intersection depths give clouds
      // rounded, shaded volume instead of a single painted horizontal sheet.
      float transmittance=1.0;vec3 accumulated=vec3(0.0);
      for(int layer=0;layer<10;layer++){
        float height=1200.0+float(layer)*95.0;
        vec3 point=rd*(height/max(rd.y,.04));
        point.xz+=uCameraXZ+vec2(uTime*7.5,uTime*2.0);
        vec3 np=point*.00092;
        float volume=cloudVolume(np);
        float profile=sin((float(layer)+.5)/10.0*PI);
        float density=c*smoothstep(.25,.69,volume)*profile;
        float lit=cloudVolume(np+uSun*.24);
        float lighting=clamp(.85-density*.95+(volume-lit)*2.8,.10,.96);
        vec3 sampleColor=mix(cloudDark,cloudLight,lighting);
        sampleColor+=uSunColor*pow(max(sd,0.0),10.0)*pow(1.0-density,3.0)*.11;
        float opacity=density*.65;
        accumulated+=transmittance*opacity*sampleColor;
        transmittance*=1.0-opacity;
      }
      float distanceFade=smoothstep(.015,.15,rd.y);
      col=col*(1.0-(1.0-transmittance)*distanceFade)+accumulated*distanceFade;
    }else{
      // Small surface roughness blurs fine cloud shapes in water reflections.
      vec3 cloudColor=mix(cloudDark,cloudLight,shade);
      float ca=c*smoothstep(.012,.10,rd.y)*.50;
      col=mix(col,cloudColor,ca);
    }
    float cirrus=0.0;
    col=mix(col,cloudLight,clamp(cirrus,0.0,.08));
  }  col+=vec3(.68,.76,1.0)*uLightning*(.3+.7*horizon);
  return max(col,vec3(0.0));
}
`;

export function createUniforms() {
 return {uTime:{value:0},uSun:{value:new THREE.Vector3(-.5,.55,-.67)},uSunColor:{value:new THREE.Color(1,.92,.8)},uClouds:{value:.35},uRain:{value:0},uLightning:{value:0},uSea:{value:.43},uCameraXZ:{value:new THREE.Vector2()},uBoat:{value:new THREE.Vector3()},uBoatDir:{value:new THREE.Vector2(0,-1)},uBoatVisible:{value:1},uBoatSpeed:{value:2.6},uUnderwater:{value:0}};
}
export const uniformDeclarations = `
uniform float uTime,uClouds,uRain,uLightning,uSea,uBoatVisible,uBoatSpeed,uUnderwater;
uniform vec3 uSun,uSunColor,uBoat;
uniform vec2 uCameraXZ,uBoatDir;
`;
export function createSky(uniforms) {
 const sky=new THREE.Mesh(new THREE.SphereGeometry(14000,32,16),new THREE.ShaderMaterial({
  uniforms,side:THREE.BackSide,depthWrite:false,
  vertexShader:`varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:uniformDeclarations+`varying vec3 vDirection;`+atmosphereGLSL+`
   void main(){vec3 rd=normalize(vDirection);vec3 col=atmosphere(rd,true);
     if(uUnderwater>.5){col=underwaterAmbient(rd);}
     gl_FragColor=vec4(col,1.0);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
   }`
 }));
 sky.frustumCulled=false; sky.renderOrder=-100;return sky;
}

export function updateSun(uniforms,timeOfDay,light,hemi,seaState,rain,clouds) {
 const phase=(timeOfDay-6)/24*Math.PI*2;
 const altitude=Math.sin(phase);
 const sun=new THREE.Vector3(Math.cos(phase)*.73,altitude,-.75).normalize();
 uniforms.uSun.value.copy(sun);
 const day=THREE.MathUtils.smoothstep(sun.y,-.13,.14);
 const warm=Math.exp(-Math.abs(sun.y)*6);
 const color=new THREE.Color().setRGB(1,.94-warm*.33,.83-warm*.48);
 uniforms.uSunColor.value.copy(color);
 uniforms.uSea.value=seaState;uniforms.uClouds.value=clouds;uniforms.uRain.value=rain;
 light.position.copy(sun).multiplyScalar(300);light.color.copy(color);light.intensity=day*(2.4-rain*1.9);
 hemi.intensity=.24+day*.9;hemi.color.setRGB(.44+day*.15,.55+day*.16,.72+day*.13);
 return {day,sun};
}



