import {expect} from '@playwright/test';

export const ADMIN_PASSWORD='Operational-E2E-2026!';
export const DB_NAME='artisys-agro-pecuaria';

export async function login(page,{username='admin',password=ADMIN_PASSWORD}={}){
  await page.goto('/');
  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('sidebar')).toBeVisible();
}

export async function logout(page){
  await page.getByRole('button',{name:'Sair'}).click();
  await expect(page.getByTestId('auth-submit')).toBeVisible();
}

export async function navigate(page,screen){
  const nav=page.getByTestId(`nav-${screen}`);
  await expect(nav).toBeVisible();
  await nav.click();
  await expect(nav).toHaveClass(/on/);
}

function uiFieldValue(name,value){
  if(!name.endsWith('Minor')||value==null||Array.isArray(value))return value;
  const minor=Number(value);
  return Number.isFinite(minor)?(minor/100).toFixed(2):value;
}

async function setField(locator,value,name=''){
  const tag=await locator.evaluate(el=>el.tagName);
  const normalized=uiFieldValue(name,value);
  if(tag==='SELECT'){
    const multiple=await locator.evaluate(el=>el.multiple);
    const values=Array.isArray(normalized)?normalized.map(String):[String(normalized)];
    await locator.selectOption(multiple?values:values[0]);
    return;
  }
  if(normalized==null)return;
  await locator.fill(String(normalized));
}

export async function runAction(page,screen,action,values={},options={}){
  await navigate(page,screen);
  await page.getByTestId(`action-${screen}-${action}`).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for(const [name,value] of Object.entries(values)){
    const field=page.getByTestId(`field-${name}`);
    await expect(field,`${screen}.${action}.${name}`).toBeVisible();
    await setField(field,value,name);
  }
  await page.getByTestId('action-submit').click();
  if(options.expectError){
    await expect(page.getByRole('alert')).toContainText(options.expectError);
    return;
  }
  // Windows GitHub runners can be materially slower for local persistence-heavy
  // journeys under parallel Playwright load. Keep these assertions fail-closed,
  // while allowing a completed local mutation enough time to settle.
  await expect(dialog).toBeHidden({timeout:15000});
  await expect(page.getByRole('status').filter({hasText:'Operação concluída com sucesso.'})).toBeVisible({timeout:15000});
}

export async function openDbRecord(page,collection,id,{includeDeleted=true}={}){
  const record=await page.evaluate(async({dbName,collection,id})=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(dbName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    try{
      const tx=db.transaction('entries','readonly');
      const key=`record:${encodeURIComponent(collection)}:${encodeURIComponent(id)}`;
      return await new Promise((resolve,reject)=>{const request=tx.objectStore('entries').get(key);request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error)});
    }finally{db.close()}
  },{dbName:DB_NAME,collection,id});
  if(!includeDeleted&&record?.deletedAt)return null;
  return record;
}

export async function listDbRecords(page,collection,{includeDeleted=false}={}){
  return page.evaluate(async({dbName,collection,includeDeleted})=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(dbName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    try{
      const tx=db.transaction('entries','readonly');
      const store=tx.objectStore('entries');
      const keys=await new Promise((resolve,reject)=>{const request=store.getAllKeys();request.onsuccess=()=>resolve(request.result.map(String));request.onerror=()=>reject(request.error)});
      const prefix=`record:${encodeURIComponent(collection)}:`;
      const rows=[];
      for(const key of keys.filter(key=>key.startsWith(prefix))){
        const row=await new Promise((resolve,reject)=>{const request=store.get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
        if(includeDeleted||!row?.deletedAt)rows.push(row);
      }
      return rows;
    }finally{db.close()}
  },{dbName:DB_NAME,collection,includeDeleted});
}

export async function seedFarm(page,id='farm-e2e'){
  await runAction(page,'data','saveFarmUnit',{id,name:`Fazenda ${id}`,registration:`REG-${id}`,location:'Local'});
  return id;
}

export async function seedLot(page,{id='lot-e2e',farmUnitId='farm-e2e',name=`Lote ${id}`}={}){
  await runAction(page,'lots','save',{id,name,farmUnitId,purpose:'beef'});
  return id;
}

export async function seedAnimal(page,{id='animal-e2e',tag='E2E-001',farmUnitId='farm-e2e',lotId='lot-e2e',sex='female'}={}){
  await runAction(page,'animals','registerBirth',{id,tag,farmUnitId,birthDate:'2026-01-02T08:00',sex,lotId});
  return id;
}

export async function seedParty(page,id='party-e2e'){
  await runAction(page,'data','saveParty',{id,name:`Parte ${id}`,roles:'buyer,slaughterhouse',document:'12345678900'});
  return id;
}

export async function expectRecord(page,collection,id,assertion){
  await expect.poll(async()=>openDbRecord(page,collection,id)).not.toBeNull();
  // Field sync updates the UI from the applied bundle before the browser persistence
  // queue is necessarily observable through a separate IndexedDB connection.
  // Give that queue one short settle window before asserting durable state.
  await page.waitForTimeout(250);
  const record=await openDbRecord(page,collection,id);
  if(assertion)await assertion(record);
  return record;
}
