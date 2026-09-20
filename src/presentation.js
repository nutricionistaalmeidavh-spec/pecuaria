import {createFunctionalPresentation} from '../shared/packages/ui-shell/src/functional.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createCattleShellModel} from './ui.js';
import {createCattleRepositories} from './catalog.js';
import {createCattleInvariantService} from './invariants.js';
import {createCattleTrade,recordWeight,recordMilkProduction,recordReproductionEvent} from './index.js';
import {createCattleBreed,createCattleCategory,createFarmUnit} from './catalog.js';
import {moveAnimal,recordAnimalLifecycle,recordSanitaryEvent,cattleWeightGain} from './operations.js';
import {createCattleTradeEntry,createCattleCost,cattleFinancialMetrics,cattleProductionEconomics} from './finance.js';
import {createDocumentService} from './documents.js';
import {createSecurityService} from './security.js';
import {createAuditService} from './audit.js';
import {createLocalSearchService} from './services/search.js';
import {createCattleAlertsService} from './services/alerts.js';
import {createCattleTransferService} from './services/transfer.js';
import {createCattleReportingService} from './services/reporting.js';
import {createCattleDashboardService} from './services/dashboard.js';
import {createSellAnimalsUseCase} from './use-cases/sell-animals.js';
import {createIoTService} from './iot/service.js';
import {createP1Repositories,createTraceabilityRecord,createInventoryItem,createPasture,createNutritionPlan,createManagementTask,createInventoryMovement,createPastureOccupancy,nutritionEconomics} from './p1.js';

const rows=records=>records.map(record=>record.payload);
const required=(record,label)=>{if(!record)throw new Error(`${label} not found.`);return record};

export function createCattlePresentation({persistence,localRuntime=null,recovery=null,capabilities=[],audit:providedAudit=null,iot:providedIoT=null,iotRuntime=null}={}){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required.');
  const repos=createCattleRepositories(persistence);
  const p1=createP1Repositories(persistence);
  const invariants=createCattleInvariantService({repos});
  const finance=createEntityRepository(persistence,{collection:'cattle.finance'});
  const documents=createDocumentService(persistence);
  const audit=providedAudit??createAuditService(persistence,{productId:'agro-pecuaria'});
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

  const screens={
    overview:{kind:'livestock-dashboard',async load(){const snapshot=await dashboard.snapshot();return{cards:snapshot.kpis,primaryKpis:snapshot.primaryKpis,alerts:snapshot.alerts,performance:snapshot.performance,reproduction:snapshot.reproduction,sanitary:snapshot.sanitary,lotDistribution:snapshot.lotDistribution,finance:snapshot.finance,recentActivity:snapshot.recentActivity,layout:snapshot.layout};}},
    lots:{kind:'lot-board',load:async()=>({rows:await repos.lots.list()}),actions:{save:audited('cattle.lot.save','lot',(entity,options)=>repos.lots.save(entity,options??{})),remove:audited('cattle.lot.remove','lot',({id,expectedVersion})=>repos.lots.remove(id,{expectedVersion}))}},
    animals:{kind:'animal-register',load:async({animalId=null}={})=>{const [animals,events,trades]=await Promise.all([repos.animals.list(),repos.events.list(),repos.trades.list()]);const enriched=animals.map(record=>{const gain=cattleWeightGain(record.payload);return{...record,payload:{...record.payload,latestWeightKg:record.payload.weights?.at(-1)?.weightKg??null,dailyGainKg:gain?.dailyGainKg??null,totalGainKg:gain?.gainKg??null}}});if(!animalId)return{rows:enriched};const animal=enriched.find(r=>r.payload.id===animalId);if(!animal)return{rows:enriched,detail:null};const a=animal.payload;const timeline=[...(a.weights??[]).map(x=>({kind:'weight',occurredAt:x.measuredAt,title:'Pesagem',detail:`${x.weightKg} kg`})),...(a.movements??[]).map(x=>({kind:'movement',occurredAt:x.movedAt,title:'Movimentação',detail:`${x.fromLotId??'sem lote'} → ${x.toLotId}`})),...(a.lifecycle??[]).map(x=>({kind:'lifecycle',occurredAt:x.occurredAt,title:'Ciclo de vida',detail:x.type})),...rows(events).filter(e=>e.animalId===animalId||e.relatedAnimalId===animalId).map(e=>({kind:e.kind,occurredAt:e.occurredAt,title:e.kind==='sanitary'?'Sanidade':'Reprodução',detail:e.type??e.protocolId??''})),...rows(trades).filter(t=>(t.animalIds??[]).includes(animalId)).map(t=>({kind:'trade',occurredAt:t.occurredAt,title:t.type==='sale'?'Venda':'Compra',detail:t.partyId}))].sort((x,y)=>String(y.occurredAt).localeCompare(String(x.occurredAt)));return{rows:enriched,detail:{animal:a,timeline}};},actions:{save:audited('cattle.animal.save','animal',(entity,options)=>repos.animals.save(entity,options??{})),recordMilk:audited('cattle.milk.record','animal',({id,...input})=>mutateAnimal(id,recordMilkProduction,input)),move:audited('cattle.animal.move','animal',async({id,...input})=>{await invariants.assertLotExists(input.toLotId);return mutateAnimal(id,moveAnimal,input);}),lifecycle:audited('cattle.animal.lifecycle','animal',({id,...input})=>mutateAnimal(id,recordAnimalLifecycle,input)),
      batchMove:audited('cattle.animal.batch-move','animal',async({animalIds,toLotId,movedAt,reason})=>{await invariants.assertLotExists(toLotId);const results=[];for(const id of animalIds){results.push(await mutateAnimal(id,moveAnimal,{toLotId,movedAt,reason}));}return results;}),
      batchLifecycle:audited('cattle.animal.batch-lifecycle','animal',async({animalIds,type,occurredAt,reason})=>{const results=[];for(const id of animalIds){results.push(await mutateAnimal(id,recordAnimalLifecycle,{type,occurredAt,reason}));}return results;})
    }},
    weights:{kind:'weight-history',load:async()=>({rows:await repos.animals.list()}),actions:{record:audited('cattle.weight.record','animal',({id,...input})=>mutateAnimal(id,recordWeight,input))}},
    sanitary:{kind:'sanitary-workspace',async load(){const[protocols,events]=await Promise.all([repos.sanitaryProtocols.list(),repos.events.list()]);return{protocols,events:events.filter(record=>record.payload.kind==='sanitary')}} ,actions:{saveProtocol:audited('cattle.sanitary.protocol.save','sanitary-protocol',(entity,options)=>repos.sanitaryProtocols.save(entity,options??{})),record:audited('cattle.sanitary.record','sanitary-event',async input=>{await invariants.assertAnimalExists(input?.animalId);if(input?.protocolId)await invariants.assertProtocolExists(input.protocolId);const event=recordSanitaryEvent(input);return repos.events.save({...event,kind:'sanitary'},{expectedVersion:0});}),
      batchRecord:audited('cattle.sanitary.batch-record','sanitary-event',async input=>{const results=[];for(const animalId of input.animalIds??[]){await invariants.assertAnimalExists(animalId);const event=recordSanitaryEvent({...input,id:`${input.idPrefix??'san'}-${animalId}-${Date.now()}`,animalId});results.push(await repos.events.save({...event,kind:'sanitary'},{expectedVersion:0}));}return results;})
    }},
    reproduction:{kind:'reproduction-timeline',async load(){const events=await repos.events.list();return{rows:events.filter(record=>record.payload.kind==='reproduction')}} ,actions:{record:audited('cattle.reproduction.record','reproduction-event',async input=>{await invariants.assertAnimalExists(input?.animalId);if(input?.relatedAnimalId)await invariants.assertAnimalExists(input.relatedAnimalId);const event=recordReproductionEvent(input);return repos.events.save({...event,kind:'reproduction'},{expectedVersion:0});}),
      batchRecord:audited('cattle.reproduction.batch-record','reproduction-event',async input=>{const results=[];for(const animalId of input.animalIds??[]){await invariants.assertAnimalExists(animalId);const event=recordReproductionEvent({...input,id:`${input.idPrefix??'repro'}-${animalId}-${Date.now()}`,animalId});results.push(await repos.events.save({...event,kind:'reproduction'},{expectedVersion:0}));}return results;})
    }},
    trades:{kind:'trade-workflow',load:async()=>({rows:await repos.trades.list()}),actions:{async create(input,context={}){if(input?.type==='sale'){const result=await sellAnimals({...input,actorId:context.actorId??'system'});return result.trade;}const result=await repos.trades.save(createCattleTrade(input),{expectedVersion:0});await auditMutation({action:'cattle.trade.create',entityType:'trade',input,context,result});return result;}}},
    finance:{kind:'lot-finance',load:async({lotId=null}={})=>{const[entries,animals]=await Promise.all([finance.list(),repos.animals.list()]);const headCount=lotId?rows(animals).filter(animal=>animal.lotId===lotId&&animal.status==='active').length:0;return{rows:entries,metrics:lotId?cattleProductionEconomics(rows(entries),{lotId,animals:rows(animals)}):null};},actions:{addCost:audited('cattle.finance.cost.add','finance-entry',input=>finance.save(createCattleCost(input),{expectedVersion:0})),fromTrade:audited('cattle.finance.from-trade','finance-entry',async({tradeId,id,lotId=null})=>{const trade=required(await repos.trades.get(tradeId),'Cattle trade');return finance.save(createCattleTradeEntry(trade.payload,{id,lotId}),{expectedVersion:0});})}},
    reports:{kind:'reports',load:async()=>({definitions:documents.definitions,issued:await persistence.listRecords('issued-documents')}),actions:{
      csv:async({type,...options})=>{const report=await reporting.build(type,options);return documents.buildCsv(type,report.rows);},
      issue:audited('cattle.report.issue','issued-document',async input=>{
        const {type,format='csv',id,...options}=input;
        const report=await reporting.build(type,options);const content=format==='csv'?documents.buildCsv(type,report.rows).content:JSON.stringify(report,null,2);
        return documents.issue({id,type,format,content});
      })
    }},
    traceability:{kind:'traceability',load:async()=>({rows:await p1.traceability.list()}),actions:{save:audited('cattle.traceability.save','traceability',async input=>{await invariants.assertAnimalExists(input.animalId);return p1.traceability.save(createTraceabilityRecord(input),{expectedVersion:0});}),remove:audited('cattle.traceability.remove','traceability',({id,expectedVersion})=>p1.traceability.remove(id,{expectedVersion}))}},
    inventory:{kind:'inventory',load:async()=>({rows:await p1.inventory.list(),movements:await p1.inventoryMovements.list()}),actions:{save:audited('cattle.inventory.save','inventory',input=>p1.inventory.save(createInventoryItem(input),{expectedVersion:0})),adjust:audited('cattle.inventory.adjust','inventory',async({id,delta,type=null,occurredAt=new Date().toISOString(),reason=null,unitCostMinor=null})=>{const current=required(await p1.inventory.get(id),'Inventory item');const change=Number(delta);if(!Number.isFinite(change)||change===0)throw new TypeError('Inventory delta must be non-zero.');const quantity=Number(current.payload.quantity)+change;if(quantity<0)throw new Error('Insufficient inventory.');const movement=createInventoryMovement({id:`mov-${id}-${Date.now()}`,itemId:id,type:type??(change>0?'in':'out'),quantity:Math.abs(change),occurredAt,reason,unitCostMinor});const save=async store=>{const scoped=createP1Repositories(store);await scoped.inventory.save({...current.payload,quantity},{expectedVersion:current.version});return scoped.inventoryMovements.save(movement,{expectedVersion:0});};return typeof persistence.transaction==='function'?persistence.transaction(save):save(persistence);})}},
    pastures:{kind:'pastures',load:async()=>({rows:await p1.pastures.list(),occupancy:await p1.pastureOccupancy.list()}),actions:{save:audited('cattle.pasture.save','pasture',input=>p1.pastures.save(createPasture(input),{expectedVersion:0})),enterLot:audited('cattle.pasture.enter','pasture-occupancy',async input=>{await invariants.assertLotExists(input.lotId);required(await p1.pastures.get(input.pastureId),'Pasture');return p1.pastureOccupancy.save(createPastureOccupancy(input),{expectedVersion:0});}),leaveLot:audited('cattle.pasture.leave','pasture-occupancy',async({id,leftAt})=>{const current=required(await p1.pastureOccupancy.get(id),'Pasture occupancy');return p1.pastureOccupancy.save({...current.payload,leftAt:new Date(leftAt).toISOString()},{expectedVersion:current.version});})}},
    nutrition:{kind:'nutrition',load:async()=>{const [plans,animals,inventory]=await Promise.all([p1.nutrition.list(),repos.animals.list(),p1.inventory.list()]);return{rows:plans.map(r=>{const plan=r.payload;const headCount=rows(animals).filter(a=>a.status==='active'&&a.lotId===plan.lotId).length;const feed=inventory.find(x=>x.payload.id===plan.feedItemId)?.payload;return{...r,payload:{...plan,headCount,...nutritionEconomics({plan,headCount,feedCostMinorPerKg:feed?.costMinor??0,days:1})}}})};},actions:{save:audited('cattle.nutrition.save','nutrition',async input=>{await invariants.assertLotExists(input.lotId);return p1.nutrition.save(createNutritionPlan(input),{expectedVersion:0});}),consume:audited('cattle.nutrition.consume','nutrition',async({planId,days=1,occurredAt=new Date().toISOString()})=>{const plan=required(await p1.nutrition.get(planId),'Nutrition plan').payload;if(!plan.feedItemId)throw new Error('Nutrition plan has no feed item.');const animals=rows(await repos.animals.list()).filter(a=>a.status==='active'&&a.lotId===plan.lotId);const quantity=Number(plan.dailyKgPerHead)*animals.length*Number(days);const item=required(await p1.inventory.get(plan.feedItemId),'Feed inventory');if(Number(item.payload.quantity)<quantity)throw new Error('Insufficient feed inventory.');const save=async store=>{const scoped=createP1Repositories(store);await scoped.inventory.save({...item.payload,quantity:Number(item.payload.quantity)-quantity},{expectedVersion:item.version});return scoped.inventoryMovements.save(createInventoryMovement({id:`nutrition-${planId}-${Date.now()}`,itemId:plan.feedItemId,type:'out',quantity,occurredAt,reason:`Nutrition plan ${planId}`,referenceType:'nutrition',referenceId:planId}),{expectedVersion:0});};return typeof persistence.transaction==='function'?persistence.transaction(save):save(persistence);})}},
    tasks:{kind:'management-tasks',load:async()=>({rows:await p1.tasks.list()}),actions:{save:audited('cattle.task.save','task',input=>p1.tasks.save(createManagementTask(input),{expectedVersion:0})),complete:audited('cattle.task.complete','task',async({id})=>{const current=required(await p1.tasks.get(id),'Task');return p1.tasks.save({...current.payload,status:'completed',completedAt:new Date().toISOString()},{expectedVersion:current.version});})}},
    data:{kind:'data-tools',async load(){const [farms,breeds,categories]=await Promise.all([repos.farmUnits.list(),repos.breeds.list(),repos.categories.list()]);return{rows:[...farms,...breeds,...categories]};},actions:{
      saveFarmUnit:audited('cattle.farm-unit.save','farm-unit',(input,options)=>repos.farmUnits.save(createFarmUnit(input),options??{})),
      saveBreed:audited('cattle.breed.save','breed',(input,options)=>repos.breeds.save(createCattleBreed(input),options??{})),
      saveCategory:audited('cattle.category.save','category',(input,options)=>repos.categories.save(createCattleCategory(input),options??{})),
      exportCollection:({collection})=>transfer.exportCollection(collection),
      validateImport:({document})=>transfer.importCollection(document,{mode:'validate'}),
      importCollection:audited('cattle.transfer.import','transfer',({document})=>transfer.importCollection(document,{mode:'append'}))
    }},
    iot:{
      kind:'iot-devices',
      load:()=>iot.load(),
      actions:{
        saveDevice:audited('iot.device.save','iot-device',input=>iot.saveDevice(input),({input})=>input?.id??null),
        removeDevice:audited('iot.device.remove','iot-device',({id})=>iot.removeDevice(id),({input})=>input?.id??null),
        testDevice:audited('iot.device.test','iot-device',({id})=>iot.testDevice(id),({input})=>input?.id??null),
        startDevice:audited('iot.device.start','iot-device',({id})=>iot.startDevice(id),({input})=>input?.id??null),
        stopDevice:audited('iot.device.stop','iot-device',({id})=>iot.stopDevice(id),({input})=>input?.id??null),
        bindRfid:audited('iot.rfid.bind','iot-rfid',input=>iot.bindRfid(input),({input})=>input?.tagId??null),
        unbindRfid:audited('iot.rfid.unbind','iot-rfid',({tagId})=>iot.unbindRfid(tagId),({input})=>input?.tagId??null),
        simulateRfid:audited('iot.simulate.rfid','iot-device',input=>iot.simulateRfid(input),({input})=>input?.deviceId??null),
        simulateWeight:audited('iot.simulate.weight','iot-device',input=>iot.simulateWeight(input),({input})=>input?.deviceId??null)
      }
    },
    settings:{kind:'settings',async load(){return{local:{mode:'local-first',networkRequired:false},backups:recovery?await recovery.listBackups():[]}},actions:{backup:audited('settings.backup','backup',(input={})=>recovery.createBackup(input),({result})=>result?.id??null),restore:audited('settings.restore','backup',({id,...options})=>recovery.restoreBackup(id,options),({input})=>input?.id??null)}}
  };
  return createFunctionalPresentation({shell,screens,services:{security,audit,search,alerts,transfer,reporting,dashboard,iot,localRuntime,recovery}});
}
