const DAY=86400000;
const iso=value=>new Date(value).toISOString();

export function createCattleAlertsService({persistence,recovery=null,now=()=>new Date(),sanitaryUpcomingDays=7,staleWeightDays=60,backupStaleDays=7}={}){
  if(!persistence?.listRecords)throw new TypeError('Persistence is required.');
  return Object.freeze({
    async list(){
      const current=now();
      const currentMs=current.getTime();
      const alerts=[];
      const events=await persistence.listRecords('cattle.events');
      for(const record of events){
        const event=record.payload;
        if(event?.kind!=='sanitary')continue;

        const appliedAt=Date.parse(event?.occurredAt??'');
        const withdrawal=Date.parse(event?.withdrawalUntil??'');
        if(Number.isFinite(withdrawal)&&withdrawal>currentMs&&(!Number.isFinite(appliedAt)||appliedAt<=currentMs)){
          alerts.push(Object.freeze({
            id:`sanitary-withdrawal:${record.id}`,
            kind:'sanitary-withdrawal-active',
            severity:'warning',
            entityType:'sanitary-event',
            entityId:record.id,
            animalId:event.animalId??null,
            dueAt:new Date(withdrawal).toISOString(),
            target:'sanitary',
            targetId:event.animalId??record.id
          }));
        }

        if(!event.nextDueAt)continue;
        const due=Date.parse(event.nextDueAt);
        if(!Number.isFinite(due))continue;
        const days=(due-currentMs)/DAY;
        if(days<0){
          alerts.push(Object.freeze({id:`sanitary-overdue:${record.id}`,kind:'sanitary-overdue',severity:'warning',entityType:'sanitary-event',entityId:record.id,animalId:event.animalId??null,dueAt:iso(event.nextDueAt),target:'sanitary',targetId:event.animalId??record.id}));
        }else if(days<=sanitaryUpcomingDays){
          alerts.push(Object.freeze({id:`sanitary-upcoming:${record.id}`,kind:'sanitary-upcoming',severity:'info',entityType:'sanitary-event',entityId:record.id,animalId:event.animalId??null,dueAt:iso(event.nextDueAt),target:'sanitary',targetId:event.animalId??record.id}));
        }
      }

      const animals=await persistence.listRecords('cattle.animals');
      for(const record of animals){
        const animal=record.payload;
        if(animal?.status!=='active'||!(animal.weights?.length))continue;
        const last=animal.weights.at(-1),measured=Date.parse(last?.measuredAt);
        if(Number.isFinite(measured)&&currentMs-measured>staleWeightDays*DAY){
          alerts.push(Object.freeze({id:`weight-stale:${record.id}`,kind:'weight-stale',severity:'info',entityType:'animal',entityId:record.id,lastMeasuredAt:new Date(measured).toISOString(),target:'weights',targetId:record.id}));
        }
      }

      const inventory=await persistence.listRecords('cattle.inventory');
      for(const record of inventory){const item=record.payload;if(Number(item?.quantity)<=Number(item?.minQuantity??0))alerts.push(Object.freeze({id:`inventory-low:${record.id}`,kind:'inventory-low',severity:'warning',entityType:'inventory',entityId:record.id,target:'inventory',targetId:record.id}));const expiry=Date.parse(item?.expiresAt??'');if(Number.isFinite(expiry)&&expiry-currentMs<=30*DAY)alerts.push(Object.freeze({id:`inventory-expiry:${record.id}`,kind:'inventory-expiry',severity:expiry<currentMs?'warning':'info',entityType:'inventory',entityId:record.id,dueAt:new Date(expiry).toISOString(),target:'inventory',targetId:record.id}));}
      const tasks=await persistence.listRecords('cattle.tasks');
      for(const record of tasks){const task=record.payload,due=Date.parse(task?.dueAt??'');if(task?.status!=='completed'&&Number.isFinite(due)&&due<currentMs)alerts.push(Object.freeze({id:`task-overdue:${record.id}`,kind:'task-overdue',severity:'warning',entityType:'task',entityId:record.id,dueAt:new Date(due).toISOString(),target:'tasks',targetId:record.id}));}
      for(const record of events){const event=record.payload;if(event?.kind!=='reproduction')continue;const due=Date.parse(event?.metadata?.expectedCalvingAt??'');if(Number.isFinite(due)&&due>=currentMs&&due-currentMs<=30*DAY)alerts.push(Object.freeze({id:`calving-upcoming:${record.id}`,kind:'calving-upcoming',severity:'info',entityType:'reproduction-event',entityId:record.id,dueAt:new Date(due).toISOString(),target:'reproduction',targetId:event.animalId??record.id}));}

      if(recovery?.listBackups){
        const backups=(await recovery.listBackups()).filter(item=>item.verified!==false);
        const latest=backups.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
        if(!latest||currentMs-Date.parse(latest.createdAt)>backupStaleDays*DAY){
          alerts.push(Object.freeze({id:'backup-stale',kind:'backup-stale',severity:'warning',entityType:'backup',entityId:latest?.id??null,lastBackupAt:latest?.createdAt??null,target:'settings',targetId:latest?.id??null}));
        }
      }
      return Object.freeze(alerts.sort((a,b)=>a.id.localeCompare(b.id)));
    }
  });
}
