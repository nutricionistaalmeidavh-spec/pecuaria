import {readFile,writeFile} from 'node:fs/promises';

async function patchSecurity(){
  const path='src/security.js';
  let source=await readFile(path,'utf8');
  const manager="manager:['cattle:read','cattle:write','finance:read','finance:write','finance:settle','reports:read','audit:read','session:revoke','settings:read','settings:backup','iot:read','iot:write']";
  const managerNext="manager:['cattle:read','cattle:write','finance:read','finance:write','finance:settle','reports:read','audit:read','session:revoke','settings:read','settings:backup','iot:read','iot:write','iot:bind']";
  const field="'field-operator':['cattle:read','cattle:write','reports:read','session:revoke']";
  const fieldNext="'field-operator':['cattle:read','cattle:write','reports:read','session:revoke','iot:bind']";
  const iot="iot:{read:'iot:read',write:'iot:write'}";
  const iotNext="iot:{read:'iot:read',write:'iot:write',actions:Object.freeze({bindRfid:'iot:bind',unbindRfid:'iot:bind'})}";
  for(const [from,to,label] of [[manager,managerNext,'manager iot bind'],[field,fieldNext,'field operator iot bind'],[iot,iotNext,'iot action permissions']]){
    if(!source.includes(from))throw new Error(`P1C roundtrip security anchor not found: ${label}`);
    source=source.replace(from,to);
  }
  await writeFile(path,source);
}

async function patchPresentation(){
  const path='src/presentation.js';
  let source=await readFile(path,'utf8');
  const sanitaryNow="      const results=[];\n      const now=Date.now();\n\n      for(let index=0;index<animals.length;index+=1){\n        const animal=animals[index].payload;\n        const eventId=batch?`${input.idPrefix??'san'}-${animal.id}-${now}-${index}`:input.id;";
  const sanitaryStable="      const results=[];\n\n      for(let index=0;index<animals.length;index+=1){\n        const animal=animals[index].payload;\n        const eventId=batch?`${input.idPrefix??'san'}-${animal.id}-${index}`:input.id;";
  if(!source.includes(sanitaryNow))throw new Error('P1C sanitary batch id anchor not found.');
  source=source.replace(sanitaryNow,sanitaryStable);

  const reproduction="batchRecord:audited('cattle.reproduction.batch-record','reproduction-event',async input=>{const results=[];for(const animalId of input.animalIds??[]){await invariants.assertAnimalExists(animalId);const event=recordReproductionEvent({...input,id:`${input.idPrefix??'repro'}-${animalId}-${Date.now()}`,animalId});results.push(await repos.events.save({...event,kind:'reproduction'},{expectedVersion:0}));}return results;})";
  const reproductionStable="batchRecord:audited('cattle.reproduction.batch-record','reproduction-event',async input=>{const results=[];for(const [index,animalId] of (input.animalIds??[]).entries()){await invariants.assertAnimalExists(animalId);const event=recordReproductionEvent({...input,id:`${input.idPrefix??'repro'}-${animalId}-${index}`,animalId});results.push(await repos.events.save({...event,kind:'reproduction'},{expectedVersion:0}));}return results;})";
  if(!source.includes(reproduction))throw new Error('P1C reproduction batch id anchor not found.');
  source=source.replace(reproduction,reproductionStable);
  await writeFile(path,source);
}

await patchSecurity();
await patchPresentation();
console.log('P1C roundtrip and RFID permission patch applied.');
