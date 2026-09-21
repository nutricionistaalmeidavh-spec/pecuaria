import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFieldQuick} from '../src/field-sync.js';

const op='operation-123';
const at='2026-09-20T12:00:00Z';

const cases=[
  ['task.complete',{id:'task-1'},'tasks','complete'],
  ['weight.record',{id:'animal-1',weightKg:420,measuredAt:at},'weights','record'],
  ['animal.move',{id:'animal-1',toLotId:'lot-2',movedAt:at},'animals','move'],
  ['sanitary.record',{animalId:'animal-1',protocolId:'protocol-1',occurredAt:at},'sanitary','record'],
  ['reproduction.record',{animalId:'animal-1',type:'service',occurredAt:at},'reproduction','record'],
  ['animal.birth',{id:'calf-1',tag:'CALF-1',farmUnitId:'farm-1',birthDate:at,sex:'female',damId:'animal-1'},'animals','registerBirth'],
  ['animal.weaning',{animalId:'animal-1',occurredAt:at},'reproduction','record'],
  ['animal.death',{id:'animal-1',occurredAt:at,reason:'field'},'animals','lifecycle'],
  ['rfid.bind',{tagId:'EID-1',animalId:'animal-1'},'iot','bindRfid'],
  ['traceability.save',{animalId:'animal-1',officialId:'BR-1',type:'identity',issuedAt:at},'traceability','save'],
  ['animal.batchMove',{animalIds:['animal-1','animal-2'],toLotId:'lot-2',movedAt:at},'animals','batchMove'],
  ['animal.batchLifecycle',{animalIds:['animal-1','animal-2'],type:'classification',occurredAt:at},'animals','batchLifecycle'],
  ['sanitary.batchRecord',{animalIds:['animal-1','animal-2'],protocolId:'protocol-1',occurredAt:at},'sanitary','batchRecord'],
  ['reproduction.batchRecord',{animalIds:['animal-1','animal-2'],type:'pregnancy-check',occurredAt:at},'reproduction','batchRecord'],
  ['pasture.enterLot',{pastureId:'pasture-1',lotId:'lot-1',enteredAt:at,animalUnits:10},'pastures','enterLot'],
  ['pasture.leaveLot',{id:'occupancy-1',leftAt:at},'pastures','leaveLot'],
  ['animal.bodyScore',{animalId:'animal-1',occurredAt:at,score:3.5},'pastures','recordBodyCondition'],
  ['pasture.score',{pastureId:'pasture-1',occurredAt:at,score:4},'pastures','recordAssessment']
];

test('P1C normalizer exposes exactly the approved quick kinds through existing presentation actions',()=>{
  assert.equal(cases.length,18);
  for(const [kind,input,screenId,action] of cases){
    const command=normalizeFieldQuick(kind,input,op);
    assert.equal(command.kind,kind,kind);
    assert.equal(command.screenId,screenId,kind);
    assert.equal(command.action,action,kind);
    assert.equal(Object.isFrozen(command),true,kind);
  }
});

test('generated identifiers are deterministic from operation id and never depend on wall clock',()=>{
  const first=normalizeFieldQuick('sanitary.record',{animalId:'animal-1',protocolId:'protocol-1',occurredAt:at},op);
  const again=normalizeFieldQuick('sanitary.record',{animalId:'animal-1',protocolId:'protocol-1',occurredAt:at},op);
  assert.deepEqual(first,again);
  assert.equal(first.input.id,'field-san-operation-123');
  assert.equal(normalizeFieldQuick('reproduction.record',{animalId:'animal-1',type:'service',occurredAt:at},op).input.id,'field-repro-operation-123');
  assert.equal(normalizeFieldQuick('animal.weaning',{animalId:'animal-1',occurredAt:at},op).input.id,'field-wean-operation-123');
  assert.equal(normalizeFieldQuick('traceability.save',{animalId:'animal-1',type:'identity',issuedAt:at},op).input.id,'field-trace-operation-123');
  assert.equal(normalizeFieldQuick('pasture.enterLot',{pastureId:'pasture-1',lotId:'lot-1',enteredAt:at},op).input.id,'field-pasture-operation-123');
  assert.equal(normalizeFieldQuick('animal.bodyScore',{animalId:'animal-1',occurredAt:at,score:3.5},op).input.id,'field-body-operation-123');
  assert.equal(normalizeFieldQuick('pasture.score',{pastureId:'pasture-1',occurredAt:at,score:4},op).input.id,'field-pasture-score-operation-123');
});

test('quick aliases normalize domain-specific required fields without adding new privileged actions',()=>{
  const weaning=normalizeFieldQuick('animal.weaning',{animalId:'animal-1',occurredAt:at,notes:'desmama'},op);
  assert.equal(weaning.input.type,'weaning');
  assert.equal(weaning.input.animalId,'animal-1');
  const death=normalizeFieldQuick('animal.death',{id:'animal-1',occurredAt:at,reason:'natural'},op);
  assert.equal(death.input.type,'death');
  assert.equal(death.input.reason,'natural');
  const body=normalizeFieldQuick('animal.bodyScore',{animalId:'animal-1',occurredAt:at,score:3.5},op);
  assert.equal(body.action,'recordBodyCondition');
});

test('unknown field quick operation fails closed',()=>{
  assert.throws(()=>normalizeFieldQuick('shell.exec',{command:'rm -rf /'},op),/Unsupported field quick operation/);
  assert.throws(()=>normalizeFieldQuick('',{},op),/Unsupported field quick operation/);
});
