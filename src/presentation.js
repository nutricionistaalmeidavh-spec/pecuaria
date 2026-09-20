import {createFunctionalPresentation} from '../shared/packages/ui-shell/src/functional.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createCattleShellModel} from './ui.js';
import {createCattleRepositories} from './catalog.js';
import {createCattleInvariantService} from './invariants.js';
import {createCattleTrade,recordWeight,recordMilkProduction,recordReproductionEvent} from './index.js';
import {createCattleBreed,createCattleCategory,createFarmUnit} from './catalog.js';
import {moveAnimal,recordAnimalLifecycle,recordSanitaryEvent,cattleWeightGain} from './operations.js';
import {createCattleTradeEntry,createCattleCost,cattleFinancialMetrics} from './finance.js';
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

const rows=records=>records.map(record=>record.payload);
const required=(record,label)=>{if(!record)throw new Error(`${label} not found.`);return record};

export function createCattlePresentation({persistence,localRuntime=null,recovery=null,capabilities=[],audit:providedAudit=null,iot:providedIoT=null,iotRuntime=null}={}){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required.');
  const repos=createCattleRepositories(persistence);
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
    animals:{kind:'animal-register',load:async()=>({rows:(await repos.animals.list()).map(record=>{const gain=cattleWeightGain(record.payload);return{...record,payload:{...record.payload,latestWeightKg:record.payload.weights?.at(-1)?.weightKg??null,dailyGainKg:gain?.dailyGainKg??null,totalGainKg:gain?.gainKg??null}}})}),actions:{save:audited('cattle.animal.save','animal',(entity,options)=>repos.animals.save(entity,options??{})),recordMilk:audited('cattle.milk.record','animal',({id,...input})=>mutateAnimal(id,recordMilkProduction,input)),move:audited('cattle.animal.move','animal',async({id,...input})=>{await invariants.assertLotExists(input.toLotId);return mutateAnimal(id,moveAnimal,input);}),lifecycle:audited('cattle.animal.lifecycle','animal',({id,...input})=>mutateAnimal(id,recordAnimalLifecycle,input)),
      batchMove:audited('cattle.animal.batch-move','animal',async({animalIds,toLotId,movedAt,reason})=>{await invariants.assertLotExists(toLotId);const results=[];for(const id of animalIds){results.push(await mutateAnimal(id,moveAnimal,{toLotId,movedAt,reason}));}return results;}),
      batchLifecycle:audited('cattle.animal.batch-lifecycle','animal',async({animalIds,type,occurredAt,reason})=>{const results=[];for(const id of animalIds){results.push(await mutateAnimal(id,recordAnimalLifecycle,{type,occurredAt,reason}));}return results;})
    }},
    weights:{kind:'weight-history',load:async()=>({rows:await repos.animals.list()}),actions:{record:audited('cattle.weight.record','animal',({id,...input})=>mutateAnimal(id,recordWeight,input))}},
    sanitary:{kind:'sanitary-workspace',async load(){const[protocols,events]=await Promise.all([repos.sanitaryProtocols.list(),repos.events.list()]);return{protocols,events:events.filter(record=>record.payload.kind==='sanitary')}} ,actions:{saveProtocol:audited('cattle.sanitary.protocol.save','sanitary-protocol',(entity,options)=>repos.sanitaryProtocols.save(entity,options??{})),record:audited('cattle.sanitary.record','sanitary-event',async input=>{await invariants.assertAnimalExists(input?.animalId);if(input?.protocolId)await invariants.assertProtocolExists(input.protocolId);const event=recordSanitaryEvent(input);return repos.events.save({...event,kind:'sanitary'},{expectedVersion:0});})}},
    reproduction:{kind:'reproduction-timeline',async load(){const events=await repos.events.list();return{rows:events.filter(record=>record.payload.kind==='reproduction')}} ,actions:{record:audited('cattle.reproduction.record','reproduction-event',async input=>{await invariants.assertAnimalExists(input?.animalId);if(input?.relatedAnimalId)await invariants.assertAnimalExists(input.relatedAnimalId);const event=recordReproductionEvent(input);return repos.events.save({...event,kind:'reproduction'},{expectedVersion:0});})}},
    trades:{kind:'trade-workflow',load:async()=>({rows:await repos.trades.list()}),actions:{async create(input,context={}){if(input?.type==='sale'){const result=await sellAnimals({...input,actorId:context.actorId??'system'});return result.trade;}const result=await repos.trades.save(createCattleTrade(input),{expectedVersion:0});await auditMutation({action:'cattle.trade.create',entityType:'trade',input,context,result});return result;}}},
    finance:{kind:'lot-finance',load:async({lotId=null}={})=>{const[entries,animals]=await Promise.all([finance.list(),repos.animals.list()]);const headCount=lotId?rows(animals).filter(animal=>animal.lotId===lotId&&animal.status==='active').length:0;return{rows:entries,metrics:lotId?cattleFinancialMetrics(rows(entries),{lotId,headCount}):null};},actions:{addCost:audited('cattle.finance.cost.add','finance-entry',input=>finance.save(createCattleCost(input),{expectedVersion:0})),fromTrade:audited('cattle.finance.from-trade','finance-entry',async({tradeId,id,lotId=null})=>{const trade=required(await repos.trades.get(tradeId),'Cattle trade');return finance.save(createCattleTradeEntry(trade.payload,{id,lotId}),{expectedVersion:0});})}},
    reports:{kind:'reports',load:async()=>({definitions:documents.definitions,issued:await persistence.listRecords('issued-documents')}),actions:{
      csv:({type,...options})=>reporting.csv(type,options),
      issue:audited('cattle.report.issue','issued-document',async input=>{
        const {type,format='csv',id,...options}=input;
        const content=format==='csv'?await reporting.csv(type,options):JSON.stringify(await reporting.build(type,options),null,2);
        return documents.issue({id,type,format,content});
      })
    }},
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
