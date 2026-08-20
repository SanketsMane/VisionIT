const puppeteer=require('puppeteer'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await puppeteer.launch({headless:'new',args:['--no-sandbox']});
  const p=await (await b.createBrowserContext()).newPage();
  await p.setViewport({width:1500,height:950,deviceScaleFactor:2});
  await p.goto('http://localhost:3000/login',{waitUntil:'domcontentloaded'}); await wait(3000);
  await p.type('input[type="email"]','contactsanket1@gmail.com');
  await p.type('input[type="password"]',process.env.SEED_OWNER_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForFunction(()=>location.pathname.includes('dashboard'),{timeout:30000});
  await wait(3500);
  const info=await p.evaluate(()=>{
    const el=document.querySelector('button[aria-label^="Theme"]');
    const r=el.getBoundingClientRect();
    const cx=r.left+r.width/2, cy=r.top+r.height/2;
    const top=document.elementFromPoint(cx,cy);
    return {
      rect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
      topElement: top ? top.tagName+'.'+(top.className||'').toString().slice(0,60) : 'none',
      isTheButtonOrChild: el.contains(top),
      disabled: el.disabled,
    };
  });
  console.log('  rect:',JSON.stringify(info.rect));
  console.log('  element at its centre:',info.topElement);
  console.log('  that element is the button (or inside it):',info.isTheButtonOrChild?'yes ✓':'NO — something is covering it ✗');
  console.log('  disabled:',info.disabled);
  await b.close();
})();
