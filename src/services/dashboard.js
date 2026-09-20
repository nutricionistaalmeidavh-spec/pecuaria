const payloads=records=>(records??[]).map(record=>record?.payload??record);
const finite=value=>Number.isFinite(Number(value));
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const timestamp=value=>{const parsed=Date.parse(value??'');return Number.isFinite(parsed)?parsed:null};
const occurredAt=value=>value?.occurredAt??value?.performedAt??value?.measuredAt??value?.createdAt??null;

const DEFAULT_LAYOUT=Object.freeze([
  Object.freeze({id:'animals',x:0,y:0,w:1,h:1}),
  Object.freeze({id:'lots',x:1,y:0,w:1,h:1}),
  Object.freeze({id:'weight',x:2,y:0,w:1,h:1}),
  Object.freeze({id:'finance',x:0,y:1,w:2,h:1}),
  Object.freeze({id:'alerts',x:2,y:1,w:1,h:1})
]);

export function validateDashboardLayout(layout){
  if(!Array.isArray(layout))throw new TypeError('layout must be an array');
  const ids=new Set();
  return layout.map(item=>{
    if(!item||typeof item.id!=='string'||!item.id.trim())throw new TypeError('layout item id is required');
    if(ids.has(item.id))throw new Error(`duplicate dashboard id: ${item.id}`);
    ids.add(item.id);
    for(const key of ['x','y','w','h'])if(!Number.isFinite(item[key]))throw new TypeError(`${key} must be a finite number`);
    if(item.x<0||item.y<0||item.w<=0||item.h<=0)throw new RangeError('layout coordinates and dimensions are invalid');
    return Object.freeze({...item});
  });
}

function buildWeightPerformance(active){
  const latestWeights=[];
  const gains=[];
  const dailyGains=[];
  for(const animal of active){
    const history=(animal?.weights??[])
      .filter(item=>finite(item?.weightKg)&&timestamp(item?.measuredAt)!=null)
      .map(item=>({animalId:animal.id,tag:animal.tag??'',name:animal.name??'',measuredAt:item.measuredAt,weightKg:Number(item.weightKg)}))
      .sort((a,b)=>timestamp(a.measuredAt)-timestamp(b.measuredAt));
    latestWeights.push(...history);
    if(history.length>=2){const gain=history.at(-1).weightKg-history[0].weightKg;const days=Math.max(1,(timestamp(history.at(-1).measuredAt)-timestamp(history[0].measuredAt))/86400000);gains.push(gain);dailyGains.push(gain/days);}
  }
  const ascending=latestWeights.sort((a,b)=>timestamp(a.measuredAt)-timestamp(b.measuredAt));
  return Object.freeze({
    averageGainKg:average(gains),
    averageDailyGainKg:average(dailyGains),
    latestWeights:Object.freeze([...ascending].sort((a,b)=>timestamp(b.measuredAt)-timestamp(a.measuredAt)).slice(0,8).map(Object.freeze)),
    series:Object.freeze(ascending.slice(-12).map(Object.freeze))
  });
}

function buildRecentActivity({active,eventRows,tradeRows}){
  const activities=[];
  for(const animal of active){
    for(const weight of animal?.weights??[]){
      if(!finite(weight?.weightKg)||timestamp(weight?.measuredAt)==null)continue;
      activities.push({kind:'weight',occurredAt:weight.measuredAt,title:'Pesagem registrada',detail:`${animal.tag??animal.id??'Animal'} · ${Number(weight.weightKg)} kg`,icon:'scale',target:'weights'});
    }
  }
  for(const event of eventRows){
    const at=occurredAt(event);
    if(timestamp(at)==null)continue;
    const reproduction=event?.kind==='reproduction';
    activities.push({
      kind:reproduction?'reproduction':'sanitary',
      occurredAt:at,
      title:reproduction?'Evento reprodutivo':'Manejo sanitário',
      detail:[event?.animalId,event?.type].filter(Boolean).join(' · '),
      icon:reproduction?'heart':'shield-plus',
      target:reproduction?'reproduction':'sanitary'
    });
  }
  for(const trade of tradeRows){
    const at=occurredAt(trade);
    if(timestamp(at)==null)continue;
    activities.push({kind:'trade',occurredAt:at,title:trade?.type==='sale'?'Venda registrada':'Compra registrada',detail:trade?.partyId??trade?.id??'',icon:'badge-dollar-sign',target:'trades'});
  }
  return Object.freeze(activities.sort((a,b)=>timestamp(b.occurredAt)-timestamp(a.occurredAt)).slice(0,8).map(Object.freeze));
}

export function createCattleDashboardService({persistence,alerts}={}){
  if(!persistence?.listRecords)throw new TypeError('Persistence is required.');
  return Object.freeze({
    async snapshot(){
      const [lots,animals,events,trades,finance,alertRows]=await Promise.all([
        persistence.listRecords('cattle.lots'),
        persistence.listRecords('cattle.animals'),
        persistence.listRecords('cattle.events'),
        persistence.listRecords('cattle.trades'),
        persistence.listRecords('cattle.finance'),
        alerts?.list?alerts.list():[]
      ]);
      const lotRows=payloads(lots);
      const animalRows=payloads(animals);
      const active=animalRows.filter(animal=>animal?.status==='active');
      const weights=active.map(animal=>animal?.weights?.at(-1)?.weightKg).filter(finite).map(Number);
      const eventRows=payloads(events);
      const tradeRows=payloads(trades);
      const sanitaryEvents=eventRows.filter(event=>event?.kind==='sanitary');
      const reproductionEvents=eventRows.filter(event=>event?.kind==='reproduction');
      let costMinor=0,incomeMinor=0;
      for(const entry of payloads(finance)){
        const amount=finite(entry?.amountMinor)?Number(entry.amountMinor):0;
        const direction=entry?.direction??entry?.kind;
        if(direction==='expense'||direction==='cost')costMinor+=amount;
        if(direction==='income'||direction==='revenue')incomeMinor+=amount;
      }
      const kpis=Object.freeze({
        lots:lots.length,
        activeAnimals:active.length,
        averageWeightKg:average(weights),
        sanitaryEvents:sanitaryEvents.length,
        trades:trades.length,
        costMinor,
        incomeMinor
      });
      const alertList=Object.freeze([...(alertRows??[])]);
      const primaryKpis=Object.freeze({
        activeAnimals:kpis.activeAnimals,
        averageWeightKg:kpis.averageWeightKg,
        lots:kpis.lots,
        alerts:alertList.length
      });
      const reproduction=Object.freeze({
        total:reproductionEvents.length,
        services:reproductionEvents.filter(event=>event?.type==='service').length,
        pregnancyChecks:reproductionEvents.filter(event=>event?.type==='pregnancy-check').length,
        calvings:reproductionEvents.filter(event=>event?.type==='calving').length,
        weanings:reproductionEvents.filter(event=>event?.type==='weaning').length
      });
      const sanitary=Object.freeze({totalEvents:sanitaryEvents.length,alerts:alertList.length});
      const lotDistribution=Object.freeze(lotRows.map(lot=>Object.freeze({
        id:lot.id,
        name:lot.name??lot.id,
        purpose:lot.purpose??null,
        activeAnimals:active.filter(animal=>animal?.lotId===lot.id).length
      })));
      const financial=Object.freeze({incomeMinor,costMinor,resultMinor:incomeMinor-costMinor});
      const performance=buildWeightPerformance(active);
      const recentActivity=buildRecentActivity({active,eventRows,tradeRows});
      return Object.freeze({
        kpis,
        primaryKpis,
        alerts:alertList,
        performance,
        reproduction,
        sanitary,
        lotDistribution,
        finance:financial,
        recentActivity,
        layout:Object.freeze(validateDashboardLayout(DEFAULT_LAYOUT))
      });
    }
  });
}
