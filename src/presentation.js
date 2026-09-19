import {createFunctionalPresentation} from '../shared/packages/ui-shell/src/functional.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createCattleShellModel} from './ui.js';
import {createCattleRepositories} from './catalog.js';
import {createCattleInvariantService} from './invariants.js';
import {createCattleTrade,recordWeight,recordReproductionEvent} from './index.js';
import {moveAnimal,recordAnimalLifecycle,recordSanitaryEvent} from './operations.js';
import {createCattleTradeEntry,createCattleCost,cattleFinancialMetrics} from './finance.js';
import {createDocumentService} from './documents.js';
import {createSecurityService} from './security.js';
import {createAuditService} from './audit.js';
import {createSellAnimalsUseCase} from './use-cases/sell-animals.js';

const rows=records=>records.map(record=>record.payload);
const required=(record,label)=>{if(!record)throw new Error(`${label} not found.`);return record};

export function createCattlePresentation({persistence,localRuntime=null,recovery=null,capabilities=[],audit:providedAudit=null}={}){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required.');
  const repos=createCattleRepositories(persistence);
  const invariants=createCattleInvariantService({repos});
  const finance=createEntityRepository(persistence,{collection:'cattle.finance'});
  const documents=createDocumentService(persistence);
  const audit=providedAudit??createAuditService(persistence,{productId:'agro-pecuaria'});
  const security=createSecurityService(persistence,{audit});
  const sellAnimals=createSellAnimalsUseCase({persistence,audit});
  const shell=createCattleShellModel({capabilities});

  async function auditMutation({action,entityType,input,context,result,entityId=null}){
    await audit.append({
      actorId:context?.actorId??'system',
      action,
      entityType,
      entityId:entityId??result?.id??input?.id??null,
      metadata:{}
    });
  }

  const audited=(action,entityType,fn,idOf=null)=>async(input,context={})=>{
    const result=await fn(input,context);
    await auditMutation({action,entityType,input,context,result,entityId:idOf?.({input,context,result})??null});
    return result;
  };

  async function mutateAnimal(id,fn,input){
    const current=required(await repos.animals.get(id),'Animal');
    return repos.animals.save(fn(current.payload,input),{expectedVersion:current.version});
  }

  const screens={
    overview:{
      kind:'livestock-dashboard',
      async load(){
        const [lots,animals,events,trades]=await Promise.all([repos.lots.list(),repos.animals.list(),repos.events.list(),repos.trades.list()]);
        const active=rows(animals).filter(animal=>animal.status==='active');
        const weights=active.map(animal=>animal.weights?.at(-1)?.weightKg).filter(Number.isFinite);
        return{cards:{
          lots:lots.length,
          activeAnimals:active.length,
          averageWeightKg:weights.length?weights.reduce((a,b)=>a+b,0)/weights.length:null,
          sanitaryEvents:rows(events).filter(event=>event.kind==='sanitary').length,
          trades:trades.length
        }};
      }
    },
    lots:{
      kind:'lot-board',
      load:async()=>({rows:await repos.lots.list()}),
      actions:{
        save:audited('cattle.lot.save','lot',(entity,options)=>repos.lots.save(entity,options??{})),
        remove:audited('cattle.lot.remove','lot',({id,expectedVersion})=>repos.lots.remove(id,{expectedVersion}))
      }
    },
    animals:{
      kind:'animal-register',
      load:async()=>({rows:await repos.animals.list()}),
      actions:{
        save:audited('cattle.animal.save','animal',(entity,options)=>repos.animals.save(entity,options??{})),
        move:audited('cattle.animal.move','animal',async({id,...input})=>{
          await invariants.assertLotExists(input.toLotId);
          return mutateAnimal(id,moveAnimal,input);
        }),
        lifecycle:audited('cattle.animal.lifecycle','animal',({id,...input})=>mutateAnimal(id,recordAnimalLifecycle,input))
      }
    },
    weights:{
      kind:'weight-history',
      load:async()=>({rows:await repos.animals.list()}),
      actions:{record:audited('cattle.weight.record','animal',({id,...input})=>mutateAnimal(id,recordWeight,input))}
    },
    sanitary:{
      kind:'sanitary-workspace',
      async load(){
        const [protocols,events]=await Promise.all([repos.sanitaryProtocols.list(),repos.events.list()]);
        return{protocols,events:events.filter(record=>record.payload.kind==='sanitary')};
      },
      actions:{
        saveProtocol:audited('cattle.sanitary.protocol.save','sanitary-protocol',(entity,options)=>repos.sanitaryProtocols.save(entity,options??{})),
        record:audited('cattle.sanitary.record','sanitary-event',async input=>{
          await invariants.assertAnimalExists(input?.animalId);
          if(input?.protocolId)await invariants.assertProtocolExists(input.protocolId);
          const event=recordSanitaryEvent(input);
          return repos.events.save({...event,kind:'sanitary'},{expectedVersion:0});
        })
      }
    },
    reproduction:{
      kind:'reproduction-timeline',
      async load(){
        const events=await repos.events.list();
        return{rows:events.filter(record=>record.payload.kind==='reproduction')};
      },
      actions:{
        record:audited('cattle.reproduction.record','reproduction-event',async input=>{
          await invariants.assertAnimalExists(input?.animalId);
          if(input?.relatedAnimalId)await invariants.assertAnimalExists(input.relatedAnimalId);
          const event=recordReproductionEvent(input);
          return repos.events.save({...event,kind:'reproduction'},{expectedVersion:0});
        })
      }
    },
    trades:{
      kind:'trade-workflow',
      load:async()=>({rows:await repos.trades.list()}),
      actions:{
        async create(input,context={}){
          if(input?.type==='sale'){
            const result=await sellAnimals({...input,actorId:context.actorId??'system'});
            return result.trade;
          }
          const result=await repos.trades.save(createCattleTrade(input),{expectedVersion:0});
          await auditMutation({action:'cattle.trade.create',entityType:'trade',input,context,result});
          return result;
        }
      }
    },
    finance:{
      kind:'lot-finance',
      load:async({lotId=null}={})=>{
        const [entries,animals]=await Promise.all([finance.list(),repos.animals.list()]);
        const headCount=lotId?rows(animals).filter(animal=>animal.lotId===lotId&&animal.status==='active').length:0;
        return{rows:entries,metrics:lotId?cattleFinancialMetrics(rows(entries),{lotId,headCount}):null};
      },
      actions:{
        addCost:audited('cattle.finance.cost.add','finance-entry',input=>finance.save(createCattleCost(input),{expectedVersion:0})),
        fromTrade:audited('cattle.finance.from-trade','finance-entry',async({tradeId,id,lotId=null})=>{
          const trade=required(await repos.trades.get(tradeId),'Cattle trade');
          return finance.save(createCattleTradeEntry(trade.payload,{id,lotId}),{expectedVersion:0});
        })
      }
    },
    reports:{
      kind:'reports',
      load:async()=>({definitions:documents.definitions,issued:await persistence.listRecords('issued-documents')}),
      actions:{
        csv:({type,rows})=>documents.buildCsv(type,rows),
        issue:audited('cattle.report.issue','issued-document',input=>documents.issue(input))
      }
    },
    settings:{
      kind:'settings',
      async load(){return{local:{mode:'local-first',networkRequired:false},backups:recovery?await recovery.listBackups():[]}},
      actions:{
        backup:audited('settings.backup','backup',(input={})=>recovery.createBackup(input),({result})=>result?.id??null),
        restore:audited('settings.restore','backup',({id,...options})=>recovery.restoreBackup(id,options),({input})=>input?.id??null)
      }
    }
  };

  return createFunctionalPresentation({shell,screens,services:{security,audit,localRuntime,recovery}});
}
