import {spawn} from 'node:child_process';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit,writeEvidence} from './evidence.mjs';
const summaryPath=fileURLToPath(new URL('../qa-artifacts/playwright-summary.json',import.meta.url));
export function buildPlaywrightSummary({commit,exitCode,startedAt,finishedAt}){if(!/^[0-9a-f]{40}$/.test(commit))throw new Error('commit must be a full git sha');if(!Number.isInteger(exitCode))throw new Error('exitCode must be an integer');return{status:exitCode===0?'passed':'failed',commit,exitCode,startedAt,finishedAt};}
async function runNpm(args){return new Promise((resolve,reject)=>{const exec=process.env.npm_execpath;const child=exec?spawn(process.execPath,[exec,...args],{stdio:'inherit',windowsHide:true}):spawn(process.platform==='win32'?'npm.cmd':'npm',args,{stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('close',code=>resolve(code??1));});}
export async function runQaWeb(){const commit=await currentCommit(),startedAt=new Date().toISOString();let exitCode=1;try{exitCode=await runNpm(['run','qa:web:raw']);}finally{const finishedAt=new Date().toISOString();await writeEvidence(summaryPath,buildPlaywrightSummary({commit,exitCode,startedAt,finishedAt}));}return exitCode;}
if(basename(process.argv[1]??'').toLowerCase()==='qa-web.mjs')runQaWeb().then(code=>{process.exitCode=code;}).catch(error=>{console.error(error);process.exitCode=1;});
