import {readFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit,writeEvidence} from './evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=join(root,'qa-artifacts');
const required=['phase5','playwright','contracts','security'];

export function evaluateProductQa({commit,evidence={}}={}){
  if(!/^[a-f0-9]{40}$/.test(commit??''))throw new TypeError('Invalid product QA commit');
  const results=[],blockedFindings=[];
  for(const name of required){
    const item=evidence[name];
    if(!item){results.push({name,status:'missing'});blockedFindings.push({check:name,severity:'HIGH',reason:'required evidence missing'});continue}
    if(item.commit!==commit){results.push({name,status:'stale'});blockedFindings.push({check:name,severity:'HIGH',reason:'evidence is stale'});continue}
    if(item.status!=='passed'){results.push({name,status:item.status??'invalid'});blockedFindings.push({check:name,severity:'HIGH',reason:'required gate did not pass'});continue}
    const inherited=(item.blockedFindings??[]).filter(finding=>['HIGH','CRITICAL','UNKNOWN'].includes(String(finding?.severity??'').toUpperCase()));
    if(inherited.length){results.push({name,status:'blocked'});blockedFindings.push(...inherited.map(finding=>({...finding,check:name})));continue}
    results.push({name,status:'passed'});
  }
  return{status:blockedFindings.length?'blocked':'passed',results,blockedFindings};
}

const json=async path=>JSON.parse(await readFile(path,'utf8'));
export async function runProductQaGate(){
  const commit=await currentCommit();
  const files={phase5:'phase5-summary.json',playwright:'playwright-summary.json',contracts:'api-contract-summary.json',security:'security-summary.json'};
  const evidence={};
  for(const [name,file] of Object.entries(files)){
    try{evidence[name]=await json(join(artifacts,file))}catch{evidence[name]=null}
  }
  const result=evaluateProductQa({commit,evidence});
  const record=await writeEvidence(join(artifacts,'product-qa-summary.json'),{...result,commit});
  if(result.status!=='passed')throw new Error(`Product QA blocked (${result.blockedFindings.length} findings)`);
  return record;
}

if(basename(process.argv[1]??'')==='product-qa-gate.mjs')runProductQaGate().then(()=>console.log('[PASS] Product QA')).catch(error=>{console.error(`[FAIL] Product QA - ${error.message}`);process.exitCode=1});
