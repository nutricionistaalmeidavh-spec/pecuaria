import {readFile,writeFile} from 'node:fs/promises';

const path='src/field-sync.js';
let source=await readFile(path,'utf8');

const oldCollections=`const SNAPSHOT_COLLECTIONS=Object.freeze([
  'cattle.tasks',
  'cattle.animals',
  'cattle.lots',
  'cattle.sanitary-protocols',
  'cattle.inventory'
]);`;
const newCollections=`const SNAPSHOT_COLLECTIONS=Object.freeze([
  'cattle.tasks',
  'cattle.animals',
  'cattle.lots',
  'cattle.sanitary-protocols',
  'cattle.inventory',
  'cattle.events',
  'cattle.traceability',
  'cattle.pastures',
  'cattle.pasture-occupancy',
  'cattle.breeding-seasons',
  'cattle.reproduction-genetics',
  'cattle.reproduction-dose-stock',
  'cattle.body-condition',
  'cattle.pasture-assessments',
  'cattle.pasture-rotation-plan'
]);`;
if(!source.includes(oldCollections))throw new Error('P1C snapshot collection anchor not found.');
source=source.replace(oldCollections,newCollections);

const start=source.indexOf('function touchesSnapshot(');
const end=source.indexOf('\n\nexport function createFieldSyncService',start);
if(start<0||end<0)throw new Error('P1C snapshot conflict anchors not found.');
const replacement=`function touchesSnapshot(operation,collection,id){
  const input=operation?.input??{};
  const animalIds=Array.isArray(input.animalIds)?input.animalIds:[];
  if(operation.kind==='task.complete')return collection==='cattle.tasks'&&input.id===id;

  if(collection==='cattle.animals'){
    if(['weight.record','animal.move','animal.death','animal.birth'].includes(operation.kind))return input.id===id;
    if(['animal.batchMove','animal.batchLifecycle'].includes(operation.kind))return animalIds.includes(id);
  }

  if(collection==='cattle.events'){
    if(['sanitary.record','reproduction.record','animal.weaning'].includes(operation.kind))return input.id===id;
    if(operation.kind==='animal.birth')return \`${'${'}input.id}:birth\`===id;
    if(['sanitary.batchRecord','reproduction.batchRecord'].includes(operation.kind))return true;
  }

  if(collection==='cattle.inventory'&&['sanitary.record','sanitary.batchRecord'].includes(operation.kind))return true;
  if(collection==='cattle.traceability'&&operation.kind==='traceability.save')return input.id===id;
  if(collection==='cattle.pasture-occupancy'&&['pasture.enterLot','pasture.leaveLot'].includes(operation.kind))return input.id===id;
  if(collection==='cattle.pastures'&&operation.kind==='pasture.enterLot')return input.pastureId===id;
  if(collection==='cattle.body-condition'&&operation.kind==='animal.bodyScore')return input.id===id;
  if(collection==='cattle.pasture-assessments'&&operation.kind==='pasture.score')return input.id===id;
  return false;
}`;
source=source.slice(0,start)+replacement+source.slice(end);

await writeFile(path,source);
console.log('P1C secure snapshot patch applied.');
