// Playwright CLI run-code function. Run against the page's current root URL.
// These are browser viewport/touch emulations, not physical-device measurements.
async (page) => {
  const root=page.url().split('?')[0];
  const checks=[],errors=[],failedRequests=[];
  const check=(name,passed,detail=null)=>checks.push({name,passed:Boolean(passed),detail});
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  page.on('requestfailed',request=>failedRequests.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('response',response=>{if(response.status()>=400)failedRequests.push({url:response.url(),status:response.status()});});
  const toggle=page.locator('#panel-toggle');
  const content=page.locator('#panel-content');
  const open=async()=>{if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();};
  const fresh=async(width,height)=>{
    await page.setViewportSize({width,height});
    const response=await page.goto(root);
    await page.waitForFunction(()=>window.oceanQA?.ready,null,{timeout:30000});
    await page.evaluate(()=>oceanQA.setScene({preset:'clear',view:'cinematic',paused:true,simulationTime:12,intro:false}));
    await page.waitForTimeout(1100);
    return response.status();
  };
  const viewports=[[390,844],[320,568],[844,390],[667,375],[568,320],[700,500]];
  for(const [width,height] of viewports){
    const prefix=`${width}x${height}`;
    await fresh(width,height);
    const chip=await toggle.boundingBox();
    check(`${prefix}: initially collapsed, with hidden controls`,await toggle.getAttribute('aria-expanded')==='false'&&await content.isHidden());
    check(`${prefix}: compact Settings target`,chip.width<=116&&chip.height>=44,chip);
    await toggle.click();
    const panel=await page.locator('.control-panel').boundingBox();
    const camera=await page.locator('.view-controls').boundingBox();
    check(`${prefix}: panel stays on screen above camera controls`,panel.x>=0&&panel.x+panel.width<=width&&panel.y>=0&&panel.y+panel.height<=camera.y,{panel,camera});
    check(`${prefix}: Settings targets are at least 44px`,await page.locator('#panel-content button, #panel-content input, #panel-toggle').evaluateAll(items=>items.every(item=>{const b=item.getBoundingClientRect();return b.width>=44&&b.height>=44;})));
    await page.locator('#yacht').click();
    check(`${prefix}: bottom switch is reachable by scrolling`,await page.evaluate(()=>!oceanQA.state().yacht));
    const heading=await toggle.boundingBox();
    check(`${prefix}: heading stays visible while content scrolls`,heading.y>=panel.y&&heading.y+heading.height<=panel.y+panel.height);
    await toggle.click();
    check(`${prefix}: closes without resetting conditions`,await content.isHidden()&&await page.evaluate(()=>!oceanQA.state().yacht));
  }
  await fresh(390,844);
  await toggle.focus();
  await page.keyboard.press('Tab');
  check('Collapsed controls are excluded from keyboard tab order',await page.evaluate(()=>document.activeElement?.dataset.view==='cinematic'));
  await toggle.focus();await page.keyboard.press('Space');
  check('Space opens Settings without pausing/resuming the ocean',await toggle.getAttribute('aria-expanded')==='true'&&await page.evaluate(()=>oceanQA.state().paused));
  check('Disclosure has a stable accessible name and controlled region',await toggle.getAttribute('aria-controls')==='panel-content'&&await page.getByRole('button',{name:'Settings',exact:true}).count()===1);
  for(const [id,value,key] of [['sea','0.87','sea'],['daytime','5.25','timeOfDay'],['clouds','0.72','clouds']]){
    await page.locator('#'+id).fill(value);
    check(`${id}: input updates simulation`,await page.evaluate(({key,value})=>oceanQA.state()[key]===Number(value),{key,value}));
  }
  await page.locator('#sea').focus();await page.keyboard.press('ArrowRight');
  check('Range keyboard input changes the value',await page.evaluate(()=>oceanQA.state().sea===.88));
  await page.keyboard.press('Escape');
  check('Escape from a slider closes and restores Settings focus',await content.isHidden()&&await toggle.evaluate(el=>el===document.activeElement));
  await open();await page.locator('#rain').click();
  check('Rain switch updates state and aria-checked',await page.evaluate(()=>oceanQA.state().rain)&&await page.locator('#rain').getAttribute('aria-checked')==='true');
  for(const [preset,sea,time,rain] of [['storm',.9,14,true],['night',.30,0,false],['sunset',.29,18.45,false],['clear',.43,15.5,false]]){
    await page.locator(`[data-preset="${preset}"]`).click();
    check(`${preset}: preset retains its original behavior`,await page.evaluate(({sea,time,rain})=>{const s=oceanQA.state();return s.sea===sea&&s.timeOfDay===time&&s.rain===rain;},{sea,time,rain}));
  }
  await page.getByRole('button',{name:/Below/}).click();
  check('Outside tap closes Settings and still changes camera',await content.isHidden()&&await page.evaluate(()=>oceanQA.state().view==='underwater'));
  await open();await page.setViewportSize({width:844,height:390});
  check('Portrait-to-landscape rotation preserves the open panel',await toggle.getAttribute('aria-expanded')==='true');
  await page.setViewportSize({width:1440,height:900});
  check('Desktop starts expanded after mobile resize',await toggle.getAttribute('aria-expanded')==='true');
  await toggle.click();await page.setViewportSize({width:390,height:844});
  check('Mobile disclosure preference survives a desktop resize',await toggle.getAttribute('aria-expanded')==='true');
  await page.setViewportSize({width:1440,height:900});
  check('Desktop disclosure preference survives a mobile resize',await content.isHidden());
  await fresh(1440,900);
  check('Desktop initial panel retains its 242px layout',await toggle.getAttribute('aria-expanded')==='true'&&(await page.locator('.control-panel').boundingBox()).width===242);
  await page.getByRole('button',{name:'Storm',exact:true}).click();
  check('Desktop preset remains usable',await page.evaluate(()=>oceanQA.state().rain&&oceanQA.state().sea===.9));
  await page.getByRole('button',{name:/Fly/}).click();await page.locator('#ocean').focus();await page.keyboard.press('Escape');
  check('Desktop Escape outside Settings still returns to Drift',await page.evaluate(()=>oceanQA.state().view==='cinematic'));
  await page.getByRole('button',{name:'Show keyboard controls',exact:true}).click();
  check('Help still opens',await page.locator('#help').evaluate(el=>el.open));
  await page.keyboard.press('Escape');
  check('Help Escape closes only the dialog',await page.locator('#help').evaluate(el=>!el.open)&&await toggle.getAttribute('aria-expanded')==='true');
  await fresh(390,844);
  // Chromium's trusted emulated touch events exercise the native touch path.
  // CSS viewport and touch input are emulated on a desktop browser.
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await page.evaluate(()=>{window.__controlsTouchSeen=false;document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')window.__controlsTouchSeen=true;},{once:true});});
  const tap=async locator=>{
    await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await tap(toggle);
  check('Emulated touch opens Settings',await toggle.getAttribute('aria-expanded')==='true'&&await page.evaluate(()=>window.__controlsTouchSeen));
  const range=page.locator('#sea');await range.scrollIntoViewIfNeeded();const b=await range.boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*.43,y:b.y+b.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width*.8,y:b.y+b.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  check('Native slider responds to an emulated touch drag',await page.evaluate(()=>oceanQA.state().sea>.7),await page.evaluate(()=>oceanQA.state().sea));
  await tap(page.locator('#rain'));
  check('Emulated touch toggles Rain',await page.evaluate(()=>oceanQA.state().rain));
  await tap(toggle);
  check('Emulated touch closes Settings',await content.isHidden());
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();
  check('No document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
  check('WebGL scene remains finite',await page.evaluate(()=>oceanQA.diagnostics().webgl2&&oceanQA.diagnostics().finite));
  check('No browser errors',errors.length===0,errors);
  check('No failed assets or HTTP errors',failedRequests.length===0,failedRequests);
  return {checkedAt:new Date().toISOString(),root,provenance:'Headless desktop Chrome; emulated CSS viewports and Chromium touch input. No physical-device or mobile performance claim.',browser:await page.evaluate(()=>navigator.userAgent),viewports,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed),checks};
}
