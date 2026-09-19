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
        if(event?.kind!=='sanitary'||!event.nextDueAt)continue;
        const due=Date.parse(event.nextDueAt);
        if(!Number.isFinite(due))continue;
        const days=(due-currentMs)/DAY;
        if(days<0){
          alerts.push(Object.freeze({id:`sanitary-overdue:${record.id}`,kind:'sanitary-overdue',severity:'warning',entityType:'sanitary-event',entityId:record.id,animalId:event.animalId??null,dueAt:iso(event.nextDueAt)}));
        }else if(days<=sanitaryUpcomingDays){
          alerts.push(Object.freeze({id:`sanitary-upcoming:${record.id}`,kind:'sanitary-upcoming',severity:'info',entityType:'sanitary-event',entityId:record.id,animalId:event.animalId??null,dueAt:iso(event.nextDueAt)}));
        }
      }

      const animals=await persistence.listRecords('cattle.animals');
      for(const record of animals){
        const animal=record.payload;
        if(animal?.status!=='active'||!(animal.weights?.length))continue;
        const last=animal.weights.at(-1),measured=Date.parse(last?.measuredAt);
        if(Number.isFinite(measured)&&currentMs-measured>staleWeightDays*DAY){
          alerts.push(Object.freeze({id:`weight-stale:${record.id}`,kind:'weight-stale',severity:'info',entityType:'animal',entityId:record.id,lastMeasuredAt:new Date(measured).toISOString()}));
        }
      }

      if(recovery?.listBackups){
        const backups=(await recovery.listBackups()).filter(item=>item.verified!==false);
        const latest=backups.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
        if(!latest||currentMs-Date.parse(latest.createdAt)>backupStaleDays*DAY){
          alerts.push(Object.freeze({id:'backup-stale',kind:'backup-stale',severity:'warning',entityType:'backup',entityId:latest?.id??null,lastBackupAt:latest?.createdAt??null}));
        }
      }
      return Object.freeze(alerts.sort((a,b)=>a.id.localeCompare(b.id)));
    }
  });
}
