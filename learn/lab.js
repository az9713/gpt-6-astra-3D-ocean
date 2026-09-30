const $=selector=>document.querySelector(selector);
const waves=JSON.parse($('#wave-data').textContent);
const sea=$('#lab-sea'),layers=$('#lab-layers'),normals=$('#lab-normals');
const play=$('#lab-play'),readout=$('#wave-readout');
const paths=[...document.querySelectorAll('#components path')];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let time=0,running=false,last=0,frame=0;
function draw({announce=false}={}){
  const scale=.028+Math.pow(Number(sea.value),1.55)*2.65;
  const count=layers.checked?3:1;
  const components=waves.map(()=>[]),sum=[],arrows=[];
  for(let px=12;px<=788;px+=4){
    const x=(px-12)/776*190;
    let height=0,slope=0;
    waves.forEach((w,i)=>{
      const k=2*Math.PI/w.length,omega=Math.sqrt(9.81*k);
      const phase=k*w.dx*x-omega*time+w.phase;
      const h=w.amplitude*scale*Math.sin(phase);
      if(i<count){height+=h;slope+=w.amplitude*scale*k*w.dx*Math.cos(phase);}
      components[i].push(`${px===12?'M':'L'}${px},${(138-h*10).toFixed(2)}`);
    });
    const y=138-height*10;
    sum.push(`${px===12?'M':'L'}${px},${y.toFixed(2)}`);
    if(normals.checked&&(px-12)%64===0){
      // Screen-space perpendicular for this deliberately simplified 2D slice.
      const nx=-slope*10/(776/190),length=Math.hypot(nx,1);
      const dx=nx/length,dy=-1/length,tx=px+dx*25,ty=y+dy*25;
      arrows.push(`<path d="M${px},${y}L${tx},${ty}M${tx-dx*6-dy*3},${ty-dy*6+dx*3}L${tx},${ty}L${tx-dx*6+dy*3},${ty-dy*6-dx*3}"/>`);
    }
  }
  paths.forEach((path,i)=>{path.setAttribute('d',components[i].join(' '));path.style.display=layers.checked?'':'none';});
  $('#wave-sum').setAttribute('d',sum.join(' '));
  $('#normal-arrows').innerHTML=arrows.join('');
  $('#lab-sea-value').value=`${Math.round(Number(sea.value)*100)}%`;
  $('#wave-plot').dataset.time=time.toFixed(3);
  if(announce)readout.textContent=`Height scale ${scale.toFixed(2)}×. ${count===1?'One wave':'Three waves'}. Surface directions ${normals.checked?'shown':'hidden'}.`;
}
function stop(){running=false;last=0;cancelAnimationFrame(frame);play.textContent='Animate waves';play.setAttribute('aria-pressed','false');}
function tick(now){if(!running)return;time+=last?Math.min((now-last)/1000,.05):0;last=now;draw();frame=requestAnimationFrame(tick);}
play.addEventListener('click',()=>{if(running){stop();return;}if(reducedMotion.matches)return;running=true;last=0;play.textContent='Pause waves';play.setAttribute('aria-pressed','true');frame=requestAnimationFrame(tick);});
$('#lab-step').addEventListener('click',()=>{stop();time+=.3;draw({announce:true});});
$('#lab-reset').addEventListener('click',()=>{stop();time=0;sea.value='.43';layers.checked=true;normals.checked=true;draw({announce:true});});
for(const control of [sea,layers,normals])control.addEventListener('input',()=>draw({announce:true}));
function updateMotion(){if(reducedMotion.matches)stop();play.disabled=reducedMotion.matches;$('#motion-note').textContent=reducedMotion.matches?'Reduced motion is enabled. Use the sliders and Step once to inspect still frames.':'Animation is optional. You can inspect the lesson with sliders and Step once.';}
reducedMotion.addEventListener('change',updateMotion);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
if('IntersectionObserver' in window)new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stop();}).observe($('#wave-plot'));
function drawReflection(){const degrees=Number($('#view-angle').value),noV=Math.max(.001,Math.cos(degrees*Math.PI/180));const weight=.0204+.9796*Math.pow(1-noV,5);$('#angle-value').value=`${degrees}°`;$('#reflection-fill').style.width=`${weight*100}%`;$('#reflection-readout').textContent=`${(weight*100).toFixed(1)}% reflected-sky weight; ${((1-weight)*100).toFixed(1)}% water-body weight, before other lighting effects.`;}
$('#view-angle').addEventListener('input',drawReflection);
if(matchMedia('(max-width:900px)').matches)$('.toc').open=false;
draw({announce:true});drawReflection();updateMotion();
