import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit,writeEvidence} from './evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=join(root,'qa-artifacts');
const recognized=['info','low','moderate','high','critical'];

const num=value=>Number.isFinite(Number(value))?Number(value):0;
export function evaluateSecurity({mode='commit',audit,secretFindings=[],semgrep={errors:[],results:[]}}={}){
  if(!['commit','release'].includes(mode))throw new TypeError('mode must be commit or release');
  const raw=audit?.metadata?.vulnerabilities;
  const blockedFindings=[];
  if(!raw||typeof raw!=='object')blockedFindings.push({kind:'audit',severity:'UNKNOWN',reason:'npm audit output missing'});
  const counts=Object.fromEntries(recognized.map(level=>[level,num(raw?.[level])]));
  const known=Object.values(counts).reduce((a,b)=>a+b,0),total=num(raw?.total),unknown=Math.max(0,total-known);
  if(counts.critical)blockedFindings.push({kind:'dependency',severity:'CRITICAL',count:counts.critical});
  if(counts.high)blockedFindings.push({kind:'dependency',severity:'HIGH',count:counts.high});
  if(unknown)blockedFindings.push({kind:'dependency',severity:'UNKNOWN',count:unknown});
  if(mode==='release'&&counts.moderate)blockedFindings.push({kind:'dependency',severity:'MEDIUM',count:counts.moderate});
  if(secretFindings.length)blockedFindings.push({kind:'secret',severity:'CRITICAL',count:secretFindings.length});
  if(!semgrep||!Array.isArray(semgrep.errors)||!Array.isArray(semgrep.results))blockedFindings.push({kind:'semgrep',severity:'UNKNOWN',reason:'invalid semgrep output'});
  else{
    if(semgrep.errors.length)blockedFindings.push({kind:'semgrep',severity:'UNKNOWN',count:semgrep.errors.length});
    const errorResults=semgrep.results.filter(item=>String(item?.extra?.severity??item?.severity??'').toUpperCase()==='ERROR').length;
    const warningResults=semgrep.results.filter(item=>String(item?.extra?.severity??item?.severity??'').toUpperCase()==='WARNING').length;
    if(errorResults)blockedFindings.push({kind:'semgrep',severity:'HIGH',count:errorResults});
    if(mode==='release'&&warningResults)blockedFindings.push({kind:'semgrep',severity:'MEDIUM',count:warningResults});
  }
  return{status:blockedFindings.length?'blocked':'passed',mode,counts:{...counts,unknown,secrets:secretFindings.length,semgrepErrors:semgrep?.errors?.length??1},blockedFindings};
}

export function npmAuditInvocation(platform=process.platform,env=process.env){
  if(platform==='win32')return{command:env.ComSpec||env.COMSPEC||'cmd.exe',args:['/d','/s','/c','npm audit --omit=dev --json']};
  return{command:'npm',args:['audit','--omit=dev','--json']};
}

function runNpmAudit(){
  const invocation=npmAuditInvocation();
  const result=spawnSync(invocation.command,invocation.args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});
  if(result.error)throw result.error;
  const output=result.stdout||'{}';
  try{return JSON.parse(output)}catch{throw new Error(`npm audit returned invalid JSON${result.stderr?`: ${result.stderr.trim()}`:''}`)}
}

async function scanSecrets(){
  const command=spawnSync('git',['ls-files'],{cwd:root,encoding:'utf8',windowsHide:true});
  if(command.status!==0)throw new Error('git ls-files failed during secret scan');
  const findings=[];
  const pattern=/(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9]{32,})/;
  for(const relative of command.stdout.split(/\r?\n/).filter(Boolean)){
    if(/^(?:docs|tests)\//.test(relative)||/\.(?:png|jpe?g|gif|ico|sqlite|exe|zip)$/i.test(relative))continue;
    let text='';
    try{text=await readFile(join(root,relative),'utf8')}catch{continue}
    if(pattern.test(text))findings.push({path:relative});
  }
  return findings;
}

async function readSemgrep(){
  if(!process.env.ARTISYS_SEMGREP_JSON)return{errors:[],results:[]};
  try{return JSON.parse(await readFile(process.env.ARTISYS_SEMGREP_JSON,'utf8'))}catch{return{errors:[{message:'semgrep report unreadable'}],results:[]}}
}

export async function runSecurityGate({mode=process.argv.includes('--release')?'release':'commit'}={}){
  const commit=await currentCommit();
  let result;
  try{result=evaluateSecurity({mode,audit:runNpmAudit(),secretFindings:await scanSecrets(),semgrep:await readSemgrep()})}
  catch(error){result={status:'blocked',mode,counts:{},blockedFindings:[{kind:'scanner',severity:'UNKNOWN',reason:String(error?.message??error)}]}}
  const evidence=await writeEvidence(join(artifacts,'security-summary.json'),{...result,commit});
  if(result.status!=='passed')throw new Error(`Security gate blocked (${result.blockedFindings.length} finding groups)`);
  return evidence;
}

if(basename(process.argv[1]??'')==='security-gate.mjs')runSecurityGate().then(()=>console.log('[PASS] Security gate')).catch(error=>{console.error(`[FAIL] Security gate - ${error.message}`);process.exitCode=1});
