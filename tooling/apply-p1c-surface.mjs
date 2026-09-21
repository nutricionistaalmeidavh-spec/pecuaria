import {readFile,writeFile} from 'node:fs/promises';

const path='src/presentation.js';
let source=await readFile(path,'utf8');
const replace=(from,to,label)=>{
  if(!source.includes(from))throw new Error(`P1C birth patch anchor not found: ${label}`);
  source=source.replace(from,to);
};

replace(
  "import {createCattleTrade,recordWeight,recordMilkProduction,recordReproductionEvent} from './index.js';",
  "import {createCattleTrade,recordWeight,recordMilkProduction,recordReproductionEvent} from './index.js';\nimport {createBirthRecords} from './birth.js';",
  'birth import'
);

replace(
  "title:e.kind==='sanitary'?'Sanidade':'Reprodução'",
  "title:e.kind==='birth'?'Nascimento':e.kind==='sanitary'?'Sanidade':'Reprodução'",
  'animal 360 birth title'
);

const saveAnchor="actions:{save:audited('cattle.animal.save','animal',(entity,options)=>repos.animals.save(entity,options??{})),recordMilk:";
const birthAction="actions:{save:audited('cattle.animal.save','animal',(entity,options)=>repos.animals.save(entity,options??{})),registerBirth:audited('cattle.animal.birth.register','animal',async input=>{const {animal,birthEvent}=createBirthRecords(input);const write=async store=>{const scopedRepos=createCattleRepositories(store);const scopedInvariants=createCattleInvariantService({repos:scopedRepos});if(animal.damId)await scopedInvariants.assertAnimalExists(animal.damId);if(animal.sireId)await scopedInvariants.assertAnimalExists(animal.sireId);await scopedInvariants.assertLotExists(animal.lotId);if(await scopedRepos.animals.get(animal.id))throw new Error(`Animal already exists: ${animal.id}.`);if(await scopedRepos.events.get(birthEvent.id))throw new Error(`Birth event already exists: ${birthEvent.id}.`);const savedAnimal=await scopedRepos.animals.save(animal,{expectedVersion:0});const savedBirthEvent=await scopedRepos.events.save(birthEvent,{expectedVersion:0});return Object.freeze({animal:savedAnimal,birthEvent:savedBirthEvent});};return typeof persistence.transaction==='function'?persistence.transaction(write):write(persistence);},({input})=>input?.id??null),recordMilk:";
replace(saveAnchor,birthAction,'animals registerBirth action');

await writeFile(path,source);
console.log('P1C birth presentation patch applied.');
