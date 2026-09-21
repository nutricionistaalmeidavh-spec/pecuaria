import {createFunctionalPresentation} from '../shared/packages/ui-shell/src/functional.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createCattleShellModel} from './ui.js';
import {createCattleRepositories,createSanitaryProtocol,createCattleParty,createCattleBreed,createCattleCategory,createFarmUnit} from './catalog.js';
import {createCattleInvariantService} from './invariants.js';
import {createCattleTrade,recordWeight,recordMilkProduction,recordReproductionEvent} from './index.js';
import {createBirthRecords} from './birth.js';
import {reproductionMetrics} from './reproduction.js';
import {moveAnimal,recordAnimalLifecycle,recordSanitaryEvent,cattleWeightGain} from './operations.js';
import {createCattleTradeEntry,createCattleCost,cattleProductionEconomics} from './finance.js';
import {createDocumentService} from './documents.js';
import {createSecurityService} from './security.js';
import {createAuditService} from './audit.js';
import {createLocalSearchService} from './services/search.js';
import {createCattleAlertsService} from './services/alerts.js';
import {createCattleTransferService} from './services/transfer.js';
import {createCattleReportingService} from './services/reporting.js';
import {createCattleDashboardService} from './services/dashboard.js';
import {createFinanceAdminService} from './services/finance-admin.js';
import {createPastureManagementService} from './services/pasture-management.js';
import {createSellAnimalsUseCase} from './use-cases/sell-animals.js';
import {createIoTService} from './iot/service.js';
import {createCattlePdfService} from './product-pdf.js';
import {createP1Repositories,createTraceabilityRecord,createInventoryItem,createPasture,createNutritionPlan,createManagementTask,createInventoryMovement,createPastureOccupancy,nutritionEconomics} from './p1.js';

const rows=records=>records.map(record=>record.payload);
const required=(record,label)=>{if(!record)throw new Error(`${label} not found.`);return record};
const addDays=(value,days)=>{if(days==null)return null;const t=Date.parse(value);if(!Number.isFinite(t))throw new TypeError('Occurred at must be a valid date.');return new Date(t+Number(days)*86400000).toISOString()};
const unitKey=value=>String(value??'').trim().toLowerCase();

export function createCattlePresentation({persistence,localRuntime=null,recovery=null,capabilities=[],audit:providedAudit=null,iot:providedIoT=null,iotRuntime=null}={}){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required.');
  const repos=createCattleRepositories(persistence);
  const p1=createP1Repositories(persistence);
  const invariants=createCattleInvariantService({repos});
  const finance=createEntityRepository(persistence,{collection:'cattle.finance'});
  const documents=createDocumentService(persistence);
  const pdf=createCattlePdfService({documents});
  const audit=providedAudit??createAuditService(persistence,{productId:'agro-pecuaria'});
  const financeAdmin=createFinanceAdminService(persistence,{audit});
  const pastureManagement=createPastureManagementService(persistence);
  const security=createSecurityService(persistence,{audit});
  const search=createLocalSearchService(persistence);
  const alerts=createCattleAlertsService({persistence,recovery});
  const transfer=createCattleTransferService(persistence);
  const reporting=createCattleReportingService(persistence);
  const dashboard=createCattleDashboardService({persistence,alerts});
  const sellAnimals=createSellAnimalsUseCase({persistence,audit});
  const iot=providedIoT??createIoTService({persistence,animals:repos.animals,audit,drivers:iotRuntime?.drivers??null,secretStore:iotRuntime?.secretStore});
  const shell=createCattleShellModel({capabilities});

  async function auditMutation({action,entityType,input,context,result,entityId=null}){
    await audit.append({actorId:context?.actorId??'system',action,entityType,entityId:entityId??result?.id??input?.id??null,metadata:{}});
  }
  const audited=(action,entityType,fn,idOf=null)=>async(input,context={})=>{const result=await fn(input,context);await auditMutation({action,entityType,input,context,result,entityId:idOf?.({input,context,result})??null});return result;};
  async function mutateAnimal(id,fn,input){const current=required(await repos.animals.get(id),'Animal');return repos.animals.save(fn(current.payload,input),{expectedVersion:current.version});}

  async function applySanitary(input,{batch=false}={}){
    const animalIds=[...new Set(batch?(input?.animalIds??[]):[input?.animalId])].filter(Boolean);
    if(animalIds.length===0)throw new TypeError('At least one animal is required.');
    const occurredAt=input?.occurredAt??new Date().toISOString();
    const write=async store=>{
      const scopedRepos=createCattleRepositories(store);
      const scopedP1=createP1Repositories(store);
      const scopedFinance=createEntityRepository(store,{collection:'cattle.finance'});
      const animals=[];
      for(const animalId of animalIds)animals.push(required(await scopedRepos.animals.get(animalId),'Animal'));
      const protocolRecord=input?.protocolId?required(await scopedRepos.sanitaryProtocols.get(input.protocolId),'Sanitary protocol'):null;
      const protocol=protocolRecord?.payload??{};
      const productItemId=input?.productItemId??protocol.productItemId??null;
      const dose=Number(input?.dose??protocol.dose);
      const unit=input?.unit??protocol.unit??null;
      if(!productItemId)throw new TypeError('Sanitary product item is required.');
      if(!Number.isFinite(dose)||dose<=0)throw new TypeError('Dose must be positive.');
      if(!unit)throw new TypeError('Dose unit is required.');

      const itemRecord=await scopedP1.inventory.get(productItemId);
      if(itemRecord&&unitKey(itemRecord.payload.unit)!==unitKey(unit))throw new Error('Sanitary dose unit must match inventory unit.');
      const totalQuantity=dose*animalIds.length;
      if(itemRecord&&Number(itemRecord.payload.quantity)<totalQuantity)throw new Error('Insufficient sanitary inventory.');

      const nextDueAt=input?.nextDueAt??addDays(occurredAt,protocol.intervalDays);
      const withdrawalUntil=input?.withdrawalUntil??addDays(occurredAt,protocol.withdrawalDays);
      const unitCostMinor=itemRecord?Number(itemRecord.payload.costMinor??0):0;
      const costPerAnimalMinor=Math.round(dose*unitCostMinor);
      const results=[];

      for(let index=0;index<animals.length;index+=1){
        const animal=animals[index].payload;
        const eventId=batch?`${input.idPrefix??'san'}-${animal.id}-${index}`:input.id;
        if(!eventId)throw new TypeError('Sanitary event id is required.');
        const event=recordSanitaryEvent({...input,id:eventId,animalId:animal.id,protocolId:input?.protocolId??null,productItemId,dose,unit,occurredAt,nextDueAt,withdrawalUntil,productBatch:itemRecord?.payload?.batch??input?.productBatch??null,activeIngredient:protocol.activeIngredient??input?.activeIngredient??null,costMinor:costPerAnimalMinor});
        const saved=await scopedRepos.events.save({...event,kind:'sanitary'},{expectedVersion:0});
        results.push(saved);
        if(itemRecord){
          await scopedP1.inventoryMovements.save(createInventoryMovement({id:`sanitary-${eventId}`,itemId:productItemId,type:'out',quantity:dose,occurredAt,reason:`Sanitary application ${eventId}`,referenceType:'sanitary',referenceId:eventId,unitCostMinor}),{expectedVersion:0});
        }
        if(costPerAnimalMinor>0&&animal.lotId){
          await scopedFinance.save(createCattleCost({id:`${eventId}:finance`,lotId:animal.lotId,amountMinor:costPerAnimalMinor,description:`Sanitary application ${eventId}`,category:'sanitary',metadata:{sanitaryEventId:eventId,animalId:animal.id,productItemId,productBatch:itemRecord?.payload?.batch??null}}),{expectedVersion:0});
        }
      }
      if(itemRecord)await scopedP1.inventory.save({...itemRecord.payload,quantity:Number(itemRecord.payload.quantity)-totalQuantity},{expectedVersion:itemRecord.version});
      return batch?Object.freeze(results):results[0];
    };
    return typeof persistence.transaction==='function'?persistence.transaction(write):write(persistence);
  }

  const screens={
    overview:{kind:'livestock-dashboard',async load(){const snapshot=await dashboard.snapshot();return{cards:snapshot.kpis,primaryKpis:snapshot.primaryKpis,alerts:snapshot.alerts,performance:snapshot.performance,reproduction:snapshot.reproduction,reproductionMetrics:snapshot.reproductionMetrics,sanitary:snapshot.sanitary,lotDistribution:snapshot.lotDistribution,finance:snapshot.finance,recentActivity:snapshot.recentActivity,layout:snapshot.layout};}},
    lots:{kind:'lot-board',load:async()=>({rows:await repos.lots.list()}),actions:{save:audited('cattle.lot.save','lot',(entity,options)=>repos.lots.save(entity,options??{})),remove:audited('cattle.lot.remove','lot',({id,expectedVersion})=>repos.lots.remove(id,{expectedVersion}))}},
    animals:{kind:'animal-register',load:async({animalId=null}={})=>{const [animals,events,trades,traceability,tasks]=await Promise.all([repos.animals.list(),repos.events.list(),repos.trades.list(),p1.traceability.list(),p1.tasks.list()]);const enriched=animals.map(record=>{const gain=cattleWeightGain(record.payload);return{...record,payload:{...record.payload,latestWeightKg:record.payload.weights?.at(-1)?.weightKg??null,dailyGainKg:gain?.dailyGainKg??null,totalGainKg:gain?.gainKg??null}}});if(!animalId)return{rows:enriched};const animal=enriched.find(r=>r.payload.id===animalId);if(!animal)return{rows:enriched,detail:null};const a=animal.payload;const timeline=[...(a.weights??[]).map(x=>({kind:'weight',occurredAt:x.measuredAt,title:'Pesagem',detail:`${x.weightKg} kg`})),...(a.movements??[]).map(x=>({kind:'movement',occurredAt:x.movedAt,title:'Movimentação',detail:`${x.fromLotId??'sem lote'} → ${x.toLotId}`})),...(a.lifecycle??[]).map(x=>({kind:'lifecycle',occurredAt:x.occurredAt,title:'Ciclo de vida',detail:x.type})),...rows(events).filter(e=>e.animalId===animalId||e.relatedAnimalId===animalId).map(e=>({kind:e.kind,occurredAt:e.occurredAt,title:e.kind==='birth'?'Nascimento':e.kind==='sanitary'?'Sanidade':'Reprodução',detail:e.type??e.protocolId??''})),...rows(trades).filter(t=>(t.animalIds??[]).includes(animalId)).map(t=>({kind:'trade',occurredAt:t.occurredAt,title:t.type==='sale'?'Venda':'Compra',detail:t.partyId})),...rows(traceability).filter(t=>t.animalId===animalId).map(t=>({kind:'traceability',occurredAt:t.issuedAt,title:'Rastreabilidade',detail:[t.type,t.documentNumber].filter(Boolean).join(' · ')})),...rows(tasks).filter(t=>t.animalId===animalId).map(t=>({kind:'task',occurredAt:t.dueAt,title:'Agenda de manejo',detail:`${t.title} · ${t.status}`}))].sort((x,y)=>String(y.occurredAt).localeCompare(String(x.occurredAt)));return{rows:enriched,detail:{animal:a,timeline}};},actions:{save:audited('cattle.animal.save','animal',(entity,options)=>repos.animals.save(entity,options??{})),registerBirth:audited('cattle.animal.birth.register','animal',async input=>{const {animal,birthEvent}=createBirthRecords(input);const write=async store=>{const scopedRepos=createCattleRepositories(store);const scopedInvariants=createCattleInvariantService({repos:scopedRepos});if(animal.damId)await scopedInvariants.assertAnimalExists(animal.damId);if(animal.sireId)await scopedInvariants.assertAnimalExists(animal.sireId);await scopedInvariants.assertLotExists(animal.lotId);if(await scopedRepos.animals.get(animal.id))throw new Error(`Animal already exists: ${animal.id}.`);if(await scopedRepos.events.get(birthEvent.id))throw new Error(`Birth event already exists: ${birthEvent.id}.`);const savedAnimal=await scopedRepos.animals.save(animal,{expectedVersion:0});const savedBirthEvent=await scopedRepos.events.save(birthEvent,{expectedVersion:0});return Object.freeze({animal:savedAnimal,birthEvent:savedBirthEvent});};return typeof persistence.transaction==='function'?persistence.transaction(write):write(persistence);},({input})=>input?.id??null),recordMilk:audited('cattle.milk.record','animal',({id,...input})=>mutateAnimal(id,recordMilkProduction,input)),move:audited('cattle.animal.move','animal',async({id,...input})=>{await invariants.assertLotExists(input.toLotId);return mutateAnimal(id,moveAnimal,input);}),lifecycle:audited('cattle.animal.lifecycle','animal',({id,...input})=>mutateAnimal(id,recordAnimalLifecycle,input)),batchMove:audited('cattle.animal.batch-move','animal',async({animalIds,toLotId,movedAt,reason})=>{await invariants.assertLotExists(toLotId);const results=[];for(const id of animalIds)results.push(await mutateAnimal(id,moveAnimal,{toLotId,movedAt,reason}));return results;}),batchLifecycle:audited('cattle.animal.batch-lifecycle','animal',async({animalIds,type,occurredAt,reason})=>{const results=[];for(const id of animalIds)results.push(await mutateAnimal(id,recordAnimalLifecycle,{type,occurredAt,reason}));return results;})}},
    weights:{kind:'weight-history',load:async()=>({rows:await repos.animals.list()}),actions:{record:audited('cattle.weight.record','animal',({id,...input})=>mutateAnimal(id,recordWeight,input))}},
    sanitary:{kind:'sanitary-workspace',async load(){const[protocols,events]=await Promise.all([repos.sanitaryProtocols.list(),repos.events.list()]);return{protocols,events:events.filter(record=>record.payload.kind==='sanitary')}} ,actions:{saveProtocol:audited('cattle.sanitary.protocol.save','sanitary-protocol',(input,options)=>repos.sanitaryProtocols.save(createSanitaryProtocol(input),options??{})),record:audited('cattle.sanitary.record','sanitary-event',input=>applySanitary(input)),batchRecord:audited('cattle.sanitary.batch-record','sanitary-event',input=>applySanitary(input,{batch:true}))}},
    reproduction:{kind:'reproduction-timeline',async load(){const [events,animals]=await Promise.all([repos.events.list(),repos.animals.list()]);const reproductionRows=events.filter(record=>record.payload.kind==='reproduction');const eligibleFemaleIds=rows(animals).filter(animal=>animal.status==='active'&&animal.sex==='female').map(animal=>animal.id);return{rows:reproductionRows,metrics:reproductionMetrics(reproductionRows,{eligibleFemaleIds})};},actions:{record:audited('cattle.reproduction.record','reproduction-event',async input=>{await invariants.assertAnimalExists(input?.animalId);if(input?.relatedAnimalId)await invariants.assertAnimalExists(input.relatedAnimalId);const event=recordReproductionEvent(input);return repos.events.save({...event,kind:'reproduction'},{expectedVersion:0});}),batchRecord:audited('cattle.reproduction.batch-record','reproduction-event',async input=>{const results=[];for(const [index,animalId] of (input.animalIds??[]).entries()){await invariants.assertAnimalExists(animalId);const event=recordReproductionEvent({...input,id:`${input.idPrefix??'repro'}-${animalId}-${index}`,animalId});results.push(await repos.events.save({...event,kind:'reproduction'},{expectedVersion:0}));}return results;})}},
    trades:{kind:'trade-workflow',load:async()=>({rows:await repos.trades.list()}),actions:{async create(input,context={}){if(input?.type==='sale'){const result=await sellAnimals({...input,actorId:context.actorId??'system'});return result.trade;}const result=await repos.trades.save(createCattleTrade(input),{expectedVersion:0});await auditMutation({action:'cattle.trade.create',entityType:'trade',input,context,result});return result;}}},
    finance:{kind:'lot-finance',load:async({lotId=null}={})=>{const[entries,animals,admin]=await Promise.all([finance.list(),repos.animals.list(),financeAdmin.snapshot()]);return{rows:entries,metrics:lotId?cattleProductionEconomics(rows(entries),{lotId,animals:rows(animals)}):null,admin};},actions:{addCost:audited('cattle.finance.cost.add','finance-entry',input=>finance.save(createCattleCost(input),{expectedVersion:0})),fromTrade:audited('cattle.finance.from-trade','finance-entry',async({tradeId,id,lotId=null})=>{const trade=required(await repos.trades.get(tradeId),'Cattle trade');return finance.save(createCattleTradeEntry(trade.payload,{id,lotId}),{expectedVersion:0});}),saveAccount:(input,context)=>financeAdmin.saveAccount(input,context),saveCategory:(input,context)=>financeAdmin.saveCategory(input,context),saveTitle:(input,context)=>financeAdmin.saveTitle(input,context),cancelTitle:(input,context)=>financeAdmin.cancelTitle(input,context),settleTitle:(input,context)=>financeAdmin.settleTitle(input,context),reverseSettlement:(input,context)=>financeAdmin.reverseSettlement(input,context),importStatement:(input,context)=>financeAdmin.importStatement(input,context),reconcileStatement:(input,context)=>financeAdmin.reconcileStatement(input,context),importInvoiceXml:(input,context)=>financeAdmin.importInvoiceXml(input,context)}},
    reports:{kind:'reports',load:async()=>({definitions:documents.definitions,issued:await persistence.listRecords('issued-documents')}),actions:{csv:async({type,...options})=>{const report=await reporting.build(type,options);return documents.buildCsv(type,report.rows);},pdf:async({type,title=null,...options})=>{const report=await reporting.build(type,options);return pdf.build(type,{title,rows:report.rows});},issue:audited('cattle.report.issue','issued-document',async input=>{const {type,format='csv',id,...options}=input;const report=await reporting.build(type,options);let content;if(format==='csv')content=documents.buildCsv(type,report.rows).content;else if(format==='pdf')content=(await pdf.build(type,{rows:report.rows})).content;else content=JSON.stringify(report,null,2);return documents.issue({id,type,format,content});})}},
    traceability:{kind:'traceability',load:async()=>({rows:await p1.traceability.list()}),actions:{save:audited('cattle.traceability.save','traceability',async input=>{await invariants.assertAnimalExists(input.animalId);return p1.traceability.save(createTraceabilityRecord(input),{expectedVersion:0});}),remove:audited('cattle.traceability.remove','traceability',({id,expectedVersion})=>p1.traceability.remove(id,{expectedVersion}))}},
    inventory:{kind:'inventory',load:async()=>({rows:await p1.inventory.list(),movements:await p1.inventoryMovements.list()}),actions:{save:audited('cattle.inventory.save','inventory',input=>p1.inventory.save(createInventoryItem(input),{expectedVersion:0})),adjust:audited('cattle.inventory.adjust','inventory',async({id,delta,type=null,occurredAt=new Date().toISOString(),reason=null,unitCostMinor=null})=>{const current=required(await p1.inventory.get(id),'Inventory item');const change=Number(delta);if(!Number.isFinite(change)||change===0)throw new TypeError('Inventory delta must be non-zero.');const quantity=Number(current.payload.quantity)+change;if(quantity<0)throw new Error('Insufficient inventory.');const movement=createInventoryMovement({id:`mov-${id}-${Date.now()}`,itemId:id,type:type??(change>0?'in':'out'),quantity:Math.abs(change),occurredAt,reason,unitCostMinor});const save=async store=>{const scoped=createP1Repositories(store);await scoped.inventory.save({...current.payload,quantity},{expectedVersion:current.version});return scoped.inventoryMovements.save(movement,{expectedVersion:0});};return typeof persistence.transaction==='function'?persistence.transaction(save):save(persistence);})}},
    pastures:{kind:'pastures',load:async()=>({rows:await p1.pastures.list(),occupancy:await p1.pastureOccupancy.list(),management:await pastureManagement.snapshot()}),actions:{save:audited('cattle.pasture.save','pasture',input=>pastureManagement.savePasture(input)),enterLot:audited('cattle.pasture.enter','pasture-occupancy',input=>pastureManagement.enterLot(input)),leaveLot:audited('cattle.pasture.leave','pasture-occupancy',input=>pastureManagement.leaveLot(input)),recordAssessment:audited('cattle.pasture.assessment.record','pasture-assessment',input=>pastureManagement.recordAssessment(input)),recordBodyCondition:audited('cattle.body-condition.record','body-condition',input=>pastureManagement.recordBodyCondition(input)),saveRotationPlan:audited('cattle.pasture.rotation.save','pasture-rotation',input=>pastureManagement.saveRotationPlan(input))}},
    nutrition:{kind:'nutrition',load:async()=>{const [plans,animals,inventory]=await Promise.all([p1.nutrition.list(),repos.animals.list(),p1.inventory.list()]);return{rows:plans.map(r=>{const plan=r.payload;const headCount=rows(animals).filter(a=>a.status==='active'&&a.lotId===plan.lotId).length;const feed=inventory.find(x=>x.payload.id===plan.feedItemId)?.payload;return{...r,payload:{...plan,headCount,...nutritionEconomics({plan,headCount,feedCostMinorPerKg:feed?.costMinor??0,days:1})}}})};},actions:{save:audited('cattle.nutrition.save','nutrition',async input=>{await invariants.assertLotExists(input.lotId);return p1.nutrition.save(createNutritionPlan(input),{expectedVersion:0});}),consume:audited('cattle.nutrition.consume','nutrition',async({planId,days=1,occurredAt=new Date().toISOString()})=>{const plan=required(await p1.nutrition.get(planId),'Nutrition plan').payload;if(!plan.feedItemId)throw new Error('Nutrition plan has no feed item.');const animals=rows(await repos.animals.list()).filter(a=>a.status==='active'&&a.lotId===plan.lotId);const quantity=Number(plan.dailyKgPerHead)*animals.length*Number(days);const item=required(await p1.inventory.get(plan.feedItemId),'Feed inventory');if(Number(item.payload.quantity)<quantity)throw new Error('Insufficient feed inventory.');const save=async store=>{const scoped=createP1Repositories(store);await scoped.inventory.save({...item.payload,quantity:Number(item.payload.quantity)-quantity},{expectedVersion:item.version});return scoped.inventoryMovements.save(createInventoryMovement({id:`nutrition-${planId}-${Date.now()}`,itemId:plan.feedItemId,type:'out',quantity,occurredAt,reason:`Nutrition plan ${planId}`,referenceType:'nutrition',referenceId:planId}),{expectedVersion:0});};return typeof persistence.transaction==='function'?persistence.transaction(save):save(persistence);})}},
    tasks:{kind:'management-tasks',load:async()=>({rows:await p1.tasks.list()}),actions:{save:audited('cattle.task.save','task',input=>p1.tasks.save(createManagementTask(input),{expectedVersion:0})),complete:audited('cattle.task.complete','task',async({id})=>{const current=required(await p1.tasks.get(id),'Task');return p1.tasks.save({...current.payload,status:'completed',completedAt:new Date().toISOString()},{expectedVersion:current.version});})}},
    data:{kind:'data-tools',async load(){const [farms,breeds,categories,parties]=await Promise.all([repos.farmUnits.list(),repos.breeds.list(),repos.categories.list(),repos.parties.list()]);return{rows:[...farms,...breeds,...categories,...parties],parties};},actions:{saveFarmUnit:audited('cattle.farm-unit.save','farm-unit',(input,options)=>repos.farmUnits.save(createFarmUnit(input),options??{})),saveBreed:audited('cattle.breed.save','breed',(input,options)=>repos.breeds.save(createCattleBreed(input),options??{})),saveCategory:audited('cattle.category.save','category',(input,options)=>repos.categories.save(createCattleCategory(input),options??{})),saveParty:audited('cattle.party.save','party',(input,options)=>repos.parties.save(createCattleParty(input),options??{})),exportCollection:({collection})=>transfer.exportCollection(collection),validateImport:({document})=>transfer.importCollection(document,{mode:'validate'}),importCollection:audited('cattle.transfer.import','transfer',({document})=>transfer.importCollection(document,{mode:'append'}))}},
    iot:{kind:'iot-devices',load:()=>iot.load(),actions:{saveDevice:audited('iot.device.save','iot-device',input=>iot.saveDevice(input),({input})=>input?.id??null),removeDevice:audited('iot.device.remove','iot-device',({id})=>iot.removeDevice(id),({input})=>input?.id??null),testDevice:audited('iot.device.test','iot-device',({id})=>iot.testDevice(id),({input})=>input?.id??null),startDevice:audited('iot.device.start','iot-device',({id})=>iot.startDevice(id),({input})=>input?.id??null),stopDevice:audited('iot.device.stop','iot-device',({id})=>iot.stopDevice(id),({input})=>input?.id??null),bindRfid:audited('iot.rfid.bind','iot-rfid',input=>iot.bindRfid(input),({input})=>input?.tagId??null),unbindRfid:audited('iot.rfid.unbind','iot-rfid',({tagId})=>iot.unbindRfid(tagId),({input})=>input?.tagId??null),simulateRfid:audited('iot.simulate.rfid','iot-device',input=>iot.simulateRfid(input),({input})=>input?.deviceId??null),simulateWeight:audited('iot.simulate.weight','iot-device',input=>iot.simulateWeight(input),({input})=>input?.deviceId??null)}},
    settings:{kind:'settings',async load(){return{local:{mode:'local-first',networkRequired:false},backups:recovery?await recovery.listBackups():[]}},actions:{backup:audited('settings.backup','backup',(input={})=>recovery.createBackup(input),({result})=>result?.id??null),restore:audited('settings.restore','backup',({id,...options})=>recovery.restoreBackup(id,options),({input})=>input?.id??null)}}
  };
  return createFunctionalPresentation({shell,screens,services:{security,audit,search,alerts,transfer,reporting,dashboard,iot,localRuntime,recovery}});
}
