import {mkdir,readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';

const KEY_BYTES=32;
const IV_BYTES=12;

async function readOptional(path,encoding=null){
  try{return await readFile(path,encoding?{encoding}:undefined);}catch(error){if(error?.code==='ENOENT')return null;throw error;}
}

export async function createLocalSecretStore({directory}={}){
  if(typeof directory!=='string'||!directory.trim())throw new TypeError('Secret store directory is required');
  await mkdir(directory,{recursive:true});
  const keyPath=join(directory,'iot-secrets.key');
  const dataPath=join(directory,'iot-secrets.enc');
  let key=await readOptional(keyPath);
  if(!key){
    const generated=randomBytes(KEY_BYTES);
    try{await writeFile(keyPath,generated,{mode:0o600,flag:'wx'});key=generated;}
    catch(error){if(error?.code!=='EEXIST')throw error;key=await readFile(keyPath);}
  }
  if(key.length!==KEY_BYTES)throw new Error('Invalid local IoT secret key');
  try{await chmod(keyPath,0o600);}catch{}

  async function load(){
    const raw=await readOptional(dataPath,'utf8');
    if(!raw)return{};
    const envelope=JSON.parse(raw);
    const iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64'),ciphertext=Buffer.from(envelope.data,'base64');
    const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);
    const plaintext=Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8');
    return JSON.parse(plaintext);
  }
  async function save(values){
    const iv=randomBytes(IV_BYTES),cipher=createCipheriv('aes-256-gcm',key,iv);
    const ciphertext=Buffer.concat([cipher.update(JSON.stringify(values),'utf8'),cipher.final()]);
    const envelope=JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')});
    const temporary=`${dataPath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary,envelope,{encoding:'utf8',mode:0o600});
    await rename(temporary,dataPath);
    try{await chmod(dataPath,0o600);}catch{}
  }

  let queue=Promise.resolve();
  const mutate=operation=>{const next=queue.then(operation,operation);queue=next.catch(()=>{});return next;};
  return Object.freeze({
    async get(name){await queue;const values=await load();return Object.prototype.hasOwnProperty.call(values,name)?structuredClone(values[name]):null;},
    set(name,value){return mutate(async()=>{const values=await load();values[name]=structuredClone(value);await save(values);});},
    delete(name){return mutate(async()=>{const values=await load();const existed=Object.prototype.hasOwnProperty.call(values,name);delete values[name];if(existed)await save(values);return existed;});}
  });
}
