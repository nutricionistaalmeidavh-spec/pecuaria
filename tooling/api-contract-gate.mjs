import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {currentCommit,writeEvidence} from './evidence.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const artifacts=join(root,'qa-artifacts');

export function canonicalJson(value){
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  if(value!==null&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  const result=JSON.stringify(value);
  if(result===undefined||(typeof value==='number'&&!Number.isFinite(value)))throw new TypeError('Contract must contain JSON values only');
  return result;
}

export function contractDigest(contract){return createHash('sha256').update(canonicalJson(contract)).digest('hex')}

export function projectProductContract(product){
  return{schemaVersion:1,productId:product.productId,screens:[...(product.screens??[])],actions:Object.fromEntries(Object.entries(product.actions??{}).map(([key,value])=>[key,[...value]]))};
}

export function validateContractSnapshot({declared,current,baseline}){
  if(baseline?.schemaVersion!==1||!/^[a-f0-9]{64}$/.test(baseline?.sha256??''))throw new Error('Invalid API contract baseline');
  const declaredDigest=contractDigest(declared),currentDigest=contractDigest(current);
  if(declaredDigest!==baseline.sha256)throw new Error('API contract baseline drift detected');
  if(currentDigest!==declaredDigest)throw new Error('API contract drift detected');
  return true;
}

const json=async path=>JSON.parse(await readFile(path,'utf8'));
export async function runApiContractGate(){
  const [declared,product,baseline,commit]=await Promise.all([
    json(join(root,'qa','api-contract.json')),
    json(join(root,'qa','product-contract.json')),
    json(join(root,'qa','api-contract.baseline.json')),
    currentCommit()
  ]);
  const current=projectProductContract(product);
  try{
    validateContractSnapshot({declared,current,baseline});
    return writeEvidence(join(artifacts,'api-contract-summary.json'),{status:'passed',productId:declared.productId,sha256:contractDigest(declared),commit});
  }catch(error){
    await writeEvidence(join(artifacts,'api-contract-summary.json'),{status:'blocked',productId:declared?.productId??null,reason:String(error?.message??error),commit});
    throw error;
  }
}

if(basename(process.argv[1]??'')==='api-contract-gate.mjs')runApiContractGate().then(()=>console.log('[PASS] API contracts')).catch(error=>{console.error(`[FAIL] API contracts - ${error.message}`);process.exitCode=1});
