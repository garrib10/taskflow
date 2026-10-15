/* Browser-owned timing, isolated synthetic storage, no CI latency gates.
 * Run sequentially against a built preview; see docs/v2-performance-regression.md.
 */
const { chromium, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const { writeFileSync, mkdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve, join } = require('node:path');
const baseURL = process.env.TASKFLOW_QA_URL ?? 'http://127.0.0.1:4189';
const output = resolve(process.env.TASKFLOW_QA_OUTPUT ?? '/private/tmp/taskflow49-performance');
const profile = process.env.TASKFLOW_QA_PROFILE === '1';
const trace = process.env.TASKFLOW_QA_TRACE === '1';
const runs = Number(process.env.TASKFLOW_QA_RUNS ?? 10);
const tiers = (process.env.TASKFLOW_QA_TIERS ?? '20,100,300').split(',').map(Number);
const widths = (process.env.TASKFLOW_QA_WIDTHS ?? '1280,390').split(',').map(Number);
const summary = values => { const s=[...values].sort((a,b)=>a-b);return {median:(s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2,min:s[0],max:s.at(-1),samples:values}; };
function browserProbe({raw,expected,tracing}) {
  localStorage.setItem('taskflow-board',raw); localStorage.removeItem('taskflow-view-preferences');
  window.__qaTracing=tracing;
  window.__taskflowQA={commits:[],renders:[],calls:[],writes:[],longTasks:[],samples:[]};
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){const start=performance.now();try{return original.call(this,key,value);}finally{if(key==='taskflow-board')window.__taskflowQA.writes.push({ms:performance.now()-start,bytes:new TextEncoder().encode(value).length});}};
  new PerformanceObserver(list=>window.__taskflowQA.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
  window.__qaStartup=new Promise(resolve=>{
    const observer=new MutationObserver(check);observer.observe(document,{childList:true,subtree:true});
    function check(){if(document.querySelectorAll('.task-card').length===expected&&document.querySelector('.shell-create-task:not(:disabled)')){observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now())));}}
    document.addEventListener('DOMContentLoaded',check,{once:true});
  });
}
async function arm(page,{event,selector,kind,data}) {
  await page.evaluate(({event,selector,kind,data})=>{
    const q=window.__taskflowQA; q.commits=[];q.renders=[];q.calls=[];q.writes=[];q.longTasks=[];
    window.__qaResult=new Promise((resolve,reject)=>{
      let start,checking=false;
      const timeout=setTimeout(()=>{observer.disconnect();document.removeEventListener(event,onEvent,true);reject(new Error(`QA observable state timed out: ${kind}`));},10000);
      const correct=()=>{
        const active=document.activeElement, dialog=document.querySelector('[role="dialog"]:not([inert])');
        if(kind==='cards')return JSON.stringify([...document.querySelectorAll('.task-card')].map(n=>n.id.slice(5)))===JSON.stringify(data.ids)&&(!data.count||document.querySelector('.toolbar-result-count')?.textContent.includes(data.count))&&(!data.status||document.querySelector('#status-filter')?.value===data.status);
        if(kind==='open')return !!dialog&&dialog.contains(active)&&dialog.querySelector('h2')?.textContent===data.title;
        if(kind==='close')return !dialog&&active?.getAttribute('aria-label')===`Open task ${data.title}`;
        if(kind==='mode')return document.querySelector('#task-ordering-mode')?.value==='manual'&&JSON.parse(localStorage.getItem('taskflow-board')).board.columns.every(c=>Array.isArray(c.manualOrder));
        if(kind==='edit')return !dialog&&[...document.querySelectorAll('[data-task-title]')].some(n=>n.textContent===data.title)&&JSON.parse(localStorage.getItem('taskflow-board')).board.columns.flatMap(c=>c.tasks).some(t=>t.id===data.id&&t.title===data.title);
        if(kind==='move')return !!document.querySelector(`.stage-done #task-${data.id}`)&&document.querySelector('[aria-label="Board updates"]')?.textContent.includes('Moved')&&active?.id===`move-task-${data.id}`;
        if(kind==='child')return !!dialog&&[...dialog.querySelectorAll('button')].some(n=>n.textContent==='QA child')&&JSON.parse(localStorage.getItem('taskflow-board')).board.columns.flatMap(c=>c.tasks).length===data.total+1;
        return false;
      };
      function check(){if(start===undefined||checking||!correct())return;checking=true;if(window.__qaTracing)performance.mark('qa-'+kind+'-dom-correct');requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!correct()){checking=false;check();return;}observer.disconnect();clearTimeout(timeout);if(window.__qaTracing)performance.mark('qa-'+kind+'-verified-frame');resolve({ms:performance.now()-start,commits:q.commits,renders:q.renders,calls:q.calls,writes:q.writes,longTasks:q.longTasks});}));}
      const observer=new MutationObserver(check);observer.observe(document,{childList:true,subtree:true,attributes:true,characterData:true});
      function onEvent(e){if(e.target instanceof Element&&e.target.closest(selector)){document.removeEventListener(event,onEvent,true);start=performance.now();if(window.__qaTracing)performance.mark('qa-'+kind+'-input');requestAnimationFrame(check);}}
      document.addEventListener(event,onEvent,true);
    });
  },{event,selector,kind,data});
}
async function measured(page,options,action){if(trace)await page.evaluate(k=>performance.mark('qa-'+k+'-armed'),options.kind);await arm(page,options);await action();const result=await page.evaluate(()=>window.__qaResult);if(trace)await page.evaluate(k=>performance.mark('qa-'+k+'-verified-frame'),options.kind);return result;}
async function open(page,task){await page.locator(`#task-${task.id} [data-task-title]`).click();await expect(page.getByRole('dialog',{name:task.title,exact:true})).toBeVisible();}
let browser;
(async()=>{
  const {representativeBoard}=await import(pathToFileURL(resolve('e2e/boardFixtures.ts')));
  const {currentBoardRaw}=await import(pathToFileURL(resolve('src/test/fixtures.ts')));
  mkdirSync(output,{recursive:true});
  browser=await chromium.launch({channel:process.env.TASKFLOW_QA_CHANNEL??'chrome',headless:true,args:['--disable-extensions']});
  const results={browser:browser.version(),date:'2026-10-15',baseURL,diagnostic:profile,method:'event capture to two animation frames after verified correct DOM and focus; conservative paint-opportunity upper-bound proxy, not automation wall time',runs,warmups:2,tiers:[]};
  for(const total of tiers)for(const width of widths){
    const height=width===390?844:720, mobile=width===390;
    const board=representativeBoard(total);board.columns.forEach((c,i)=>c.title=['To Do','In Progress','In Review','Done'][i]);
    const raw=currentBoardRaw(board),tasks=board.columns.flatMap(c=>c.tasks),target=board.columns[0].tasks[0],moving=board.columns[2].tasks[0],parent=tasks.find(t=>t.id==='parent-0');
    const record={total,width,height,payloadBytes:Buffer.byteLength(raw),fixtureSHA256:createHash('sha256').update(raw).digest('hex'),distribution:board.columns.map(c=>c.tasks.length),children:tasks.filter(t=>t.parentId).length,family:tasks.filter(t=>t.parentId==='parent-0').length,scenarios:{}};
    const context=await browser.newContext({viewport:{width,height},hasTouch:mobile});
    await context.addInitScript(browserProbe,{raw,expected:mobile?board.columns[0].tasks.length:total,tracing:trace});
    const page=await context.newPage();page.setDefaultTimeout(10000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const ordered=filters=>board.columns.flatMap(c=>mobile&&c.id!=='todo'?[]:c.tasks.filter(t=>(!filters.query||(t.title+' '+t.description).toLowerCase().includes(filters.query.toLowerCase()))&&(!filters.category||t.category===filters.category)&&(!filters.priority||t.priority===filters.priority)&&(!filters.status||t.status===filters.status)).sort((a,b)=>({high:3,medium:2,low:1}[b.priority]-{high:3,medium:2,low:1}[a.priority]))).map(t=>t.id);
    // Fresh isolated contexts and cache-disabled requests: no app navigation used for seeding.
    if(!profile&&process.env.TASKFLOW_QA_SKIP_COLD!=='1'){const values=[];for(let index=0;index<runs;index++){const cold=await browser.newContext({viewport:{width,height},hasTouch:mobile});await cold.addInitScript(browserProbe,{raw,expected:mobile?board.columns[0].tasks.length:total,tracing:trace});const p=await cold.newPage(),cdp=await cold.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await p.goto(baseURL);values.push(await p.evaluate(()=>window.__qaStartup));expect(await p.evaluate(()=>window.__taskflowQA.writes.length)).toBe(0);await cold.close();}record.coldStartup=summary(values);}
    let traceSession; const traceEvents=[];
    if(trace){traceSession=await context.newCDPSession(page);traceSession.on('Tracing.dataCollected',e=>traceEvents.push(...e.value));await traceSession.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,disabled-by-default-devtools.screenshot',transferMode:'ReportEvents'});}
    if(profile){await page.goto(baseURL);await page.evaluate(()=>window.__qaStartup);record.initialDiagnostic=await page.evaluate(()=>window.__taskflowQA);}
    const names=process.env.TASKFLOW_QA_SCENARIOS?.split(',')??['warmReload','titleSearch','descriptionSearch','combinedFilter','zeroResults','reset','ordering','detailsOpen','detailsClose','edit','keyboardMove','childCreate',...(!mobile?['pointerMove']:[])];
    for(const name of names){const samples=[];
      for(let index=0;index<runs+2;index++){
        await page.goto(baseURL);const startup=await page.evaluate(()=>window.__qaStartup);
        const input=page.getByRole('searchbox',{name:'Search tasks'});let result;
        if(name==='warmReload'){result={...await page.evaluate(()=>window.__taskflowQA),ms:startup};}
        else if(['titleSearch','descriptionSearch','zeroResults'].includes(name)){
          const query=name==='titleSearch'?'Find-title':name==='descriptionSearch'?'Find-description':'No-such-work';const ids=ordered({query});
          result=await measured(page,{event:'input',selector:'#task-search',kind:'cards',data:{ids,count:`Showing ${tasks.filter(t=>(t.title+' '+t.description).includes(query)).length} of ${total}`}},()=>input.fill(query));
          record[name+'Matches']=tasks.filter(t=>(t.title+' '+t.description).includes(query)).length;
        }else if(name==='combinedFilter'){
          await input.fill('Find-title');const filterButton=page.getByRole('button',{name:/^Filters \(/});if(await filterButton.count())await filterButton.click();
          await page.getByLabel('Category',{exact:true}).selectOption('feature');await page.getByLabel('Priority',{exact:true}).selectOption('high');
          const ids=ordered({query:'Find-title',category:'feature',priority:'high',status:'in-progress'});
          result=await measured(page,{event:'change',selector:'#status-filter',kind:'cards',data:{ids,status:'in-progress',count:`Showing ${tasks.filter(t=>(t.title+' '+t.description).includes('Find-title')&&t.category==='feature'&&t.priority==='high'&&t.status==='in-progress').length} of ${total}`}},()=>page.getByLabel('Status',{exact:true}).selectOption('in-progress'));
        }else if(name==='reset'){
          await input.fill('Find-title');result=await measured(page,{event:'click',selector:'button',kind:'cards',data:{ids:ordered({}),count:`${total} tasks on board`}},()=>page.getByRole('button',{name:'Clear all search and filters',exact:true}).click());
        }else if(name==='ordering'){
          result=await measured(page,{event:'change',selector:'#task-ordering-mode',kind:'mode',data:{}},()=>page.getByLabel('Ordering',{exact:true}).selectOption('manual'));
        }else if(name==='detailsOpen'){
          result=await measured(page,{event:'click',selector:'[data-task-title]',kind:'open',data:{title:target.title}},()=>page.locator(`#task-${target.id} [data-task-title]`).click());
        }else if(name==='detailsClose'){
          await open(page,target);result=await measured(page,{event:'click',selector:'button',kind:'close',data:{title:target.title}},()=>page.getByRole('button',{name:'Close task details',exact:true}).click());
        }else if(name==='edit'){
          await open(page,target);await page.getByRole('button',{name:'Edit task',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('QA edited task');
          result=await measured(page,{event:'click',selector:'button',kind:'edit',data:{id:target.id,title:'QA edited task'}},()=>page.getByRole('button',{name:'Save Changes',exact:true}).click());
        }else if(name==='childCreate'){
          if(mobile)await page.getByLabel('Workflow stage',{exact:true}).selectOption('in-progress');await open(page,parent);await page.getByRole('button',{name:`Add SubTask to ${parent.title}`,exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('QA child');await page.getByLabel('Description',{exact:true}).fill('QA child notes');
          result=await measured(page,{event:'click',selector:'button',kind:'child',data:{total}},()=>page.getByRole('button',{name:'Create SubTask',exact:true}).click());
        }else{
          if(mobile)await page.getByLabel('Workflow stage',{exact:true}).selectOption('in-review');const grip=page.locator(`#move-task-${moving.id}`);await grip.scrollIntoViewIfNeeded();
          if(name==='keyboardMove'){
            await grip.focus();await page.keyboard.press('Space');await expect(grip).toHaveAttribute('aria-pressed','true');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.keyboard.press('ArrowRight');await expect(page.getByRole('status',{name:'Board updates'})).toContainText('Destination:');
            result=await measured(page,{event:'keydown',selector:'.task-grip',kind:'move',data:{id:moving.id}},()=>page.keyboard.press('Space'));
          }else{
            const from=await grip.boundingBox();await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(from.x+from.width/2+10,from.y+from.height/2);await expect(page.locator('.task-drag-overlay')).toBeVisible();
            await expect.poll(async()=>{const dest=await page.locator('.stage-done .column-header').boundingBox();await page.mouse.move(dest.x+dest.width/2,dest.y+dest.height/2,{steps:4});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return page.locator('.stage-done').getAttribute('data-drop-state');}).toBe('valid');
            result=await measured(page,{event:'mouseup',selector:'*',kind:'move',data:{id:moving.id}},()=>page.mouse.up());
          }
        }
        if(!['ordering','edit','childCreate','keyboardMove','pointerMove'].includes(name))expect(result.writes).toHaveLength(0);
        if(['edit','keyboardMove','pointerMove','childCreate'].includes(name))expect(result.writes).toHaveLength(1);
        if(index>=2)samples.push(profile?result:result.ms);
      }
      record.scenarios[name]=profile?samples:summary(samples);
      console.log(`${profile?'profile':'production'} ${total}/${width} ${name} ${profile?samples.length:record.scenarios[name].median.toFixed(1)+'ms'}`);
      writeFileSync(join(output,'evidence.json'),JSON.stringify({...results,tiers:[...results.tiers,record]},null,2));
    }
    if(trace){const done=new Promise(resolve=>traceSession.once('Tracing.tracingComplete',resolve));await traceSession.send('Tracing.end');await done;const raw=JSON.stringify({traceEvents});const name=`trace-${total}-${width}.json`;writeFileSync(join(output,name),raw);record.trace={file:name,sha256:createHash('sha256').update(raw).digest('hex'),events:traceEvents.length};}
    expect(errors).toEqual([]);results.tiers.push(record);await context.close();
  }
  await browser.close();writeFileSync(join(output,'evidence.json'),JSON.stringify(results,null,2));
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1;});
