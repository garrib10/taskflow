// Keep Lighthouse outside project dependencies. Three fresh profiles per form factor.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const tools = process.env.TASKFLOW_LIGHTHOUSE_DIR ?? '/private/tmp/taskflow49-tools';
const output = resolve(process.env.TASKFLOW_LIGHTHOUSE_OUTPUT ?? '/private/tmp/taskflow49-lighthouse');
const url = process.env.TASKFLOW_QA_URL ?? 'http://127.0.0.1:4189';
mkdirSync(output,{recursive:true});
const records=[];
for(const formFactor of ['mobile','desktop'])for(let run=1;run<=3;run++) {
  const path=join(output,`${formFactor}-${run}`);
  const args=[join(tools,'node_modules/lighthouse/cli/index.js'),url,'--chrome-path=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--chrome-flags=--headless=new --disable-extensions --no-first-run','--only-categories=performance,accessibility,best-practices,seo','--output=json','--output=html',`--output-path=${path}`,'--quiet'];
  if(formFactor==='desktop')args.push('--preset=desktop');
  const result=spawnSync(process.execPath,args,{encoding:'utf8'});
  writeFileSync(path+'.log',result.stdout+result.stderr);
  if(result.status!==0)throw new Error(`Lighthouse ${formFactor}/${run} failed; inspect ${path}.log`);
  const raw=readFileSync(path+'.report.json'), report=JSON.parse(raw);
  if(report.runtimeError)throw new Error(JSON.stringify(report.runtimeError));
  if(report.configSettings.formFactor!==formFactor)throw new Error('Lighthouse profile mismatch');
  records.push({formFactor,run,fetchTime:report.fetchTime,url:report.finalDisplayedUrl,lighthouseVersion:report.lighthouseVersion,userAgent:report.userAgent,environment:report.environment,settings:report.configSettings,scores:Object.fromEntries(Object.entries(report.categories).map(([key,value])=>[key,Math.round(value.score*100)])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'].map(key=>[key,report.audits[key].numericValue])),failedAudits:Object.entries(report.audits).filter(([,a])=>a.score!==null&&a.score<1).map(([id,a])=>({id,title:a.title,score:a.score,displayValue:a.displayValue,description:a.description,details:a.details})),warnings:report.runWarnings,reportSHA256:createHash('sha256').update(raw).digest('hex')});
  writeFileSync(join(output,'evidence.json'),JSON.stringify(records,null,2));
  console.log(formFactor,run,records.at(-1).scores);
}
