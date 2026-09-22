import {expect} from '@playwright/test';

export const DB_NAME='artisys-agro-pecuaria';

export async function login(page,{username='admin',password='admin123'}={}){
  await page.goto('/');
  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('authenticated-loading')).toBeVisible();
  await expect(page.getByTestId('nav-overview')).toBeVisible();
}

export async function navigate(page,screen){
  await page.getByTestId(`nav-${screen}`).click();
  await expect(page.getByTestId('workspace-screen').or(page.getByTestId('overview-dashboard')).first()).toBeVisible();
}

async function setField(locator,value,name){
  const tag=await locator.evaluate(el=>el.tagName);
  if(tag==='INPUT'){
    const type=await locator.getAttribute('type');
    if(type==='checkbox'){
      if(Boolean(value)!==await locator.isChecked())await locator.click();
      return;
    }
  }
  const normalized=value instanceof Date?value.toISOString():value;
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
  // Windows GitHub runners can be materially slower for local IndexedDB/SQLite-heavy
  // journeys under parallel Playwright load. Keep the assertion fail-closed, but give
  // a completed local mutation enough time to settle before declaring the UI stuck.
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

export async function openDbRecords(page,collection,{includeDeleted=true}={}){
  const rows=await page.evaluate(async({dbName,collection})=>{
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(dbName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    try{
      const tx=db.transaction('entries','readonly');
      const records=await new Promise((resolve,reject)=>{const request=tx.objectStore('entries').getAll();request.onsuccess=()=>resolve(request.result??[]);request.onerror=()=>reject(request.error)});
      const prefix=`record:${encodeURIComponent(collection)}:`;
      return records.filter(record=>String(record?.key??'').startsWith(prefix));
    }finally{db.close()}
  },{dbName:DB_NAME,collection});
  return includeDeleted?rows:rows.filter(record=>!record?.deletedAt);
}

export async function seedFarm(page,{id='farm-e2e',name='Fazenda E2E'}={}){
  await runAction(page,'data','saveFarmUnit',{id,name});
  return id;
}

export async function seedLot(page,{id='lot-e2e',name='Lote E2E',farmUnitId='farm-e2e',purpose='recria'}={}){
  await runAction(page,'lots','save',{id,name,farmUnitId,purpose,status:'active'});
  return id;
}

export async function seedAnimal(page,{id='animal-e2e',tag='E2E-001',farmUnitId='farm-e2e',lotId='lot-e2e',sex='female',status='active'}={}){
  await runAction(page,'animals','save',{id,tag,farmUnitId,lotId,sex,status});
  return id;
}
