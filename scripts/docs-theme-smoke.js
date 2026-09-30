// Open the site root, then run with Playwright CLI. Contrast checks cover text
// on computed solid surfaces; the photographic journey hero is reviewed visually.
async (page) => {
  const root=page.url().replace(/(?:learn|journey)\/(?:#.*)?$/,'');
  const checks=[],errors=[],failedRequests=[];
  const check=(name,passed,detail=null)=>checks.push({name,passed:Boolean(passed),detail});
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('requestfailed',request=>failedRequests.push(request.url()));
  page.on('response',response=>{if(response.status()>=400)failedRequests.push(`${response.status()} ${response.url()}`);});
  const reports=[];
  const loadImages=()=>page.locator('img').evaluateAll(images=>Promise.all(images.map(async image=>{image.loading='eager';await image.decode();})));
  for(const doc of ['learn','journey']){
    // The requested default must stay dark even when the OS prefers light.
    await page.emulateMedia({colorScheme:'light',reducedMotion:'reduce'});
    await page.setViewportSize({width:1440,height:1000});
    const response=await page.goto(root+doc+'/');
    await page.waitForFunction(()=>document.querySelector('#wave-sum, #combined-wave')?.getAttribute('d'));
    await loadImages();
    check(`${doc}: HTTP 200`,response.status()===200);
    check(`${doc}: dark default overrides light OS preference`,await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme==='dark'));
    await page.locator('details').evaluateAll(items=>items.forEach(item=>item.open=true));
    const report=await page.evaluate(()=>{
      const rgba=text=>{const values=text.match(/[\d.]+/g)?.map(Number)||[];return [values[0]||0,values[1]||0,values[2]||0,values[3]??1];};
      const over=(front,back)=>[0,1,2].map(i=>front[i]*front[3]+back[i]*(1-front[3])).concat(1);
      const lum=color=>color.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
      const background=element=>{const ancestors=[];for(let e=element;e;e=e.parentElement)ancestors.unshift(e);let color=[255,255,255,1],image=false;for(const e of ancestors){const s=getComputedStyle(e);if(s.backgroundImage!=='none')image=true;color=over(rgba(s.backgroundColor),color);}return {color,image};};
      const failures=[],brightSurfaces=[];let measured=0,minimum=Infinity,imageText=0;
      for(const element of document.body.querySelectorAll('*')){
        if(!element.getClientRects().length||['SCRIPT','STYLE','TITLE','DESC','NOSCRIPT'].includes(element.tagName.toUpperCase()))continue;
        const s=getComputedStyle(element);if(s.visibility==='hidden')continue;
        const ownText=[...element.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent.trim()).join(' ').trim();
        if(!ownText)continue;
        const bg=background(element);if(bg.image){imageText++;continue;}
        const foreground=rgba(element.tagName.toLowerCase()==='text'?s.fill:s.color);
        let opacity=1;for(let e=element;e;e=e.parentElement)opacity*=Number(getComputedStyle(e).opacity);
        foreground[3]*=opacity;
        const contrast=ratio(over(foreground,bg.color),bg.color);
        const large=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700);
        const threshold=large?3:4.5;
        measured++;minimum=Math.min(minimum,contrast);
        if(contrast+.01<threshold)failures.push({tag:element.tagName,text:ownText.slice(0,65),contrast:Number(contrast.toFixed(2)),threshold});
        if(lum(bg.color)>.2)brightSurfaces.push({tag:element.tagName,text:ownText.slice(0,50)});
      }
      const root=getComputedStyle(document.documentElement);
      return {measured,minimumContrast:Number(minimum.toFixed(2)),failures,brightSurfaces,imageText,paper:root.getPropertyValue('--paper').trim(),ink:root.getPropertyValue('--ink').trim(),accent:root.getPropertyValue('--accent').trim()};
    });
    reports.push({doc,...report});
    check(`${doc}: text meets AA contrast on solid surfaces`,report.failures.length===0,report);
    check(`${doc}: text surfaces stay dark`,report.brightSurfaces.length===0,report.brightSurfaces);
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`output/dark-${doc}-desktop.png`});
    const lesson=page.locator(doc==='learn'?'.lab':'.wave-lab');
    await lesson.scrollIntoViewIfNeeded();await page.screenshot({path:`output/dark-${doc}-lesson.png`});
    if(doc==='learn'){
      await page.locator('#lab-sea').fill('0.8');await page.getByRole('button',{name:'Step once',exact:true}).click();
      check('Guide lesson and reduced motion remain usable',await page.locator('#lab-play').isDisabled()&&(await page.locator('#lab-sea-value').textContent())==='80%');
      await page.locator('#view-angle').fill('85');check('Reflection lesson still responds',(await page.locator('#reflection-readout').textContent()).startsWith('64.1%'));
    }else{
      await page.locator('#lesson-sea').fill('0.8');check('Journey wave lesson still responds',(await page.locator('#lesson-value').textContent())==='80%');
    }
    for(const [width,height] of [[390,844],[320,568],[844,390]]){
      await page.setViewportSize({width,height});await page.reload();await page.waitForFunction(()=>document.querySelector('#wave-sum, #combined-wave')?.getAttribute('d'));
      await loadImages();
      check(`${doc} ${width}x${height}: no page overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      check(`${doc} ${width}x${height}: navigation panel stays dark`,await page.locator('.toc').evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(20, 39, 50)'));
      if(width===390){await page.screenshot({path:`output/dark-${doc}-mobile.png`});await lesson.scrollIntoViewIfNeeded();await page.screenshot({path:`output/dark-${doc}-mobile-lesson.png`});}
    }
  }
  check('Both documents share the same palette',reports.every(r=>r.paper===reports[0].paper&&r.ink===reports[0].ink&&r.accent===reports[0].accent));
  check('No browser errors',errors.length===0,errors);check('No failed requests',failedRequests.length===0,failedRequests);
  await page.emulateMedia({colorScheme:null,reducedMotion:null});
  return {checkedAt:new Date().toISOString(),root,provenance:'Headless desktop Chrome; emulated viewports, light OS preference and reduced motion. Solid-surface contrast audit, not a complete accessibility certification.',passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed),reports,checks};
}
