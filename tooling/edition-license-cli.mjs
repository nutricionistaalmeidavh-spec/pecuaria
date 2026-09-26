import {generateKeyPairSync} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {signLicense} from '../shared/packages/licensing/src/index.js';
import {commercialProduct} from '../src/edition-commerce.js';

const args=process.argv.slice(2);
const command=args.shift();
const value=name=>{const index=args.indexOf(`--${name}`);return index>=0?args[index+1]??null:null};
const required=name=>{const found=value(name);if(!found)throw new Error(`--${name} is required`);return found};

if(command==='keygen'){
  const directory=resolve(value('dir')??'.artisys-license');
  await mkdir(directory,{recursive:true});
  const {publicKey,privateKey}=generateKeyPairSync('ed25519',{
    publicKeyEncoding:{type:'spki',format:'pem'},
    privateKeyEncoding:{type:'pkcs8',format:'pem'}
  });
  const publicPath=join(directory,'pecuaria-license-public.pem');
  const privatePath=join(directory,'pecuaria-license-private.pem');
  await writeFile(publicPath,publicKey,{encoding:'utf8'});
  await writeFile(privatePath,privateKey,{encoding:'utf8',mode:0o600});
  console.log(JSON.stringify({publicKey:publicPath,privateKey:privatePath,warning:'Keep the private key outside the application repository and installer.'},null,2));
}else if(command==='issue'){
  const edition=required('edition');
  const product=commercialProduct(edition);
  const privateKey=await readFile(resolve(required('private')),'utf8');
  const now=new Date().toISOString();
  const payload={
    licenseId:value('license-id')??crypto.randomUUID(),
    product:'agro-pecuaria',
    customerId:required('customer'),
    issuedAt:now,
    features:product.features,
    metadata:{sku:product.sku,edition:product.edition,priceBrl:product.priceBrl,saleModel:product.saleModel}
  };
  const device=value('device');
  const expiresAt=value('expires');
  if(device)payload.deviceIds=[device];
  if(expiresAt)payload.expiresAt=new Date(expiresAt).toISOString();
  const token=signLicense(payload,privateKey);
  console.log(JSON.stringify({sku:product.sku,edition:product.edition,licenseId:payload.licenseId,token},null,2));
}else{
  console.error('Usage:\n  node tooling/edition-license-cli.mjs keygen [--dir PATH]\n  node tooling/edition-license-cli.mjs issue --private PATH --edition essential|management|pro --customer ID [--license-id ID] [--device ID] [--expires ISO]');
  process.exitCode=1;
}
