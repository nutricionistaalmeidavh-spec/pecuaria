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

const rows=r=>r.map(x=>x.payload);
const required=(r,l)=>{if(!r)throw new Error(`${l} not found.`);return r};

export function createCattlePresentation({persistence,localRuntime=null,recovery=null,capabilities=[]}={}){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required.');
  const repos=createCattleRepositories(persistence);
  const invariants=createCattleInvariantService({repos});
  const finance=createEntityRepository(persistence,{collection:'cattle.finance'});
  const documents=createDocumentService(persistence);
  const security=createSecurityService(persistence);
  const shell=createCattleShellModel({capabilities});

  async function mutateAnimal(id,fn,input){
    const current=required(await repos.animals.get(id),'Animal');
    return repos.animals.save(fn(current.payload,input),{expectedVersion:current.version});
  }

  const screens={
    overview:{
      kind:'livestock-dashboard',
      async load(){
        const [lots,animals,events,trades]=await Promise.all([repos.lots.list(),repos.animals.list(),repos.events.list(),repos.trades.list()]);
        const active=rows(animals).filter(a=>a.status==='active');
        const weights=active.map(a=>a.weights?.at(-1)?.weightKg).filter(Number.isFinite);
        return{cards:{lots:lots.length,activeAnimals:active.length,averageWeightKg:weights.length?weights.reduce((a,b)=>a+b,0)/weights.length:null,sanitaryEvents:rows(events).filter(e=>e.kind==='sanitary').length,trades:trades.length}};
      }
    },
    lots:{
      kind:'lot-board',
      load:async()=>({rows:await repos.lots.list()}),
      actions:{save:(e,o)=>repos.lots.save(e,o??{}),remove:({id,expectedVersion})=>repos.lots.remove(id,{expectedVersion})}
    },
    animals:{
      kind:'animal-register',
      load:async()=>({rows:await repos.animals.list()}),
      actions:{
        save:(e,o)=>repos.animals.save(e,o??{}),
        move:async({id,...input})=>{
          await invariants.assertLotExists(input.toLotId);
          return mutateAnimal(id,moveAnimal,input);
        },
        lifecycle:({id,...input})=>mutateAnimal(id,recordAnimalLifecycle,input)
      }
    },
    weights:{
      kind:'weight-history',
      load:async()=>({rows:await repos.animals.list()}),
      actions:{record:({id,...input})=>mutateAnimal(id,recordWeight,input)}
    },
    sanitary:{
      kind:'sanitary-workspace',
      async load(){
        const [protocols,events]=await Promise.all([repos.sanitaryProtocols.list(),repos.events.list()]);
        return{protocols,events:events.filter(r=>r.payload.kind==='sanitary')};
      },
      actions:{
        saveProtocol:(e,o)=>repos.sanitaryProtocols.save(e,o??{}),
        record:async input=>{
          await invariants.assertAnimalExists(input?.animalId);
          if(input?.protocolId)await invariants.assertProtocolExists(input.protocolId);
          const event=recordSanitaryEvent(input);
          return repos.events.save({...event,kind:'sanitary'},{expectedVersion:0});
        }
      }
    },
    reproduction:{
      kind:'reproduction-timeline',
      async load(){
        const events=await repos.events.list();
        return{rows:events.filter(r=>r.payload.kind==='reproduction')};
      },
      actions:{
        record:async input=>{
          await invariants.assertAnimalExists(input?.animalId);
          if(input?.relatedAnimalId)await invariants.assertAnimalExists(input.relatedAnimalId);
          const event=recordReproductionEvent(input);
          return repos.events.save({...event,kind:'reproduction'},{expectedVersion:0});
        }
      }
    },
    trades:{kind:'trade-workflow',load:async()=>({rows:await repos.trades.list()}),actions:{create:i=>repos.trades.save(createCattleTrade(i),{expectedVersion:0})}},
    finance:{
      kind:'lot-finance',
      load:async({lotId=null}={})=>{
        const [entries,animals]=await Promise.all([finance.list(),repos.animals.list()]);
        const headCount=lotId?rows(animals).filter(a=>a.lotId===lotId&&a.status==='active').length:0;
        return{rows:entries,metrics:lotId?cattleFinancialMetrics(rows(entries),{lotId,headCount}):null};
      },
      actions:{
        addCost:i=>finance.save(createCattleCost(i),{expectedVersion:0}),
        fromTrade:async({tradeId,id,lotId=null})=>{
          const trade=required(await repos.trades.get(tradeId),'Cattle trade');
          return finance.save(createCattleTradeEntry(trade.payload,{id,lotId}),{expectedVersion:0});
        }
      }
    },
    reports:{kind:'reports',load:async()=>({definitions:documents.definitions,issued:await persistence.listRecords('issued-documents')}),actions:{csv:({type,rows})=>documents.buildCsv(type,rows),issue:i=>documents.issue(i)}},
    settings:{kind:'settings',async load(){return{local:{mode:'local-first',networkRequired:false},backups:recovery?await recovery.listBackups():[]}},actions:{backup:(i={})=>recovery.createBackup(i),restore:({id,...o})=>recovery.restoreBackup(id,o)}}
  };

  return createFunctionalPresentation({shell,screens,services:{security,localRuntime,recovery}});
}
