import {createEntityRepository} from '../../shared/packages/vertical-persistence/src/repository.js';
import {createCattleRepositories} from '../catalog.js';
import {createCattleTrade} from '../index.js';
import {recordAnimalLifecycle} from '../operations.js';
import {createCattleTradeEntry} from '../finance.js';

const timestamp=value=>{const parsed=Date.parse(value??'');return Number.isFinite(parsed)?parsed:null};

export function createSellAnimalsUseCase({persistence,audit}={}){
  if(typeof persistence?.transaction!=='function')throw new TypeError('Transactional persistence is required.');
  if(typeof audit?.append!=='function')throw new TypeError('Audit service is required.');

  return async function sellAnimals(input={}){
    const trade=createCattleTrade(input);
    if(trade.type!=='sale')throw new Error('Atomic animal sale requires trade type sale.');
    if(trade.animalIds.length===0)throw new Error('Sale requires at least one animal.');
    const actorId=typeof input.actorId==='string'&&input.actorId.trim()?input.actorId.trim():'system';

    return persistence.transaction(async tx=>{
      const repos=createCattleRepositories(tx);
      const finance=createEntityRepository(tx,{collection:'cattle.finance'});
      const currentAnimals=[];

      for(const animalId of trade.animalIds){
        const current=await repos.animals.get(animalId);
        if(!current)throw new Error(`Animal not found: ${animalId}.`);
        if(current.payload.status!=='active')throw new Error(`Animal is not active: ${animalId}.`);
        currentAnimals.push(current);
      }

      const saleAt=timestamp(trade.occurredAt);
      if(saleAt!=null){
        const sanitaryEvents=(await repos.events.list())
          .map(record=>record.payload)
          .filter(event=>event?.kind==='sanitary'&&trade.animalIds.includes(event?.animalId));
        for(const event of sanitaryEvents){
          const appliedAt=timestamp(event.occurredAt);
          const withdrawalUntil=timestamp(event.withdrawalUntil);
          if(withdrawalUntil==null)continue;
          if(appliedAt!=null&&appliedAt>saleAt)continue;
          if(withdrawalUntil>saleAt){
            throw new Error(`Animal has an active sanitary withdrawal period: ${event.animalId} until ${event.withdrawalUntil}.`);
          }
        }
      }

      const savedTrade=await repos.trades.save(trade,{expectedVersion:0});
      const soldAnimals=[];
      for(const current of currentAnimals){
        const sold=recordAnimalLifecycle(current.payload,{
          type:'sale',
          occurredAt:trade.occurredAt,
          reason:`trade:${trade.id}`
        });
        soldAnimals.push(await repos.animals.save(sold,{expectedVersion:current.version}));
      }

      const financeEntry=await finance.save(
        createCattleTradeEntry(trade,{id:`${trade.id}:finance`}),
        {expectedVersion:0}
      );

      await audit.append({
        actorId,
        action:'cattle.trade.sale',
        entityType:'trade',
        entityId:trade.id,
        metadata:{animalIds:[...trade.animalIds],financeEntryId:financeEntry.id}
      },{persistence:tx});

      return Object.freeze({trade:savedTrade,animals:Object.freeze(soldAnimals),financeEntry});
    });
  };
}
