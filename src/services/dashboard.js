const payloads=records=>(records??[]).map(record=>record?.payload??record);
const finite=value=>Number.isFinite(Number(value));
const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;

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

export function createCattleDashboardService({persistence,alerts}={}){
  if(!persistence?.listRecords)throw new TypeError('Persistence is required.');
  return Object.freeze({
    async snapshot(){
      const [lots,animals,finance,alertRows]=await Promise.all([
        persistence.listRecords('cattle.lots'),
        persistence.listRecords('cattle.animals'),
        persistence.listRecords('cattle.finance'),
        alerts?.list?alerts.list():[]
      ]);
      const active=payloads(animals).filter(animal=>animal?.status==='active');
      const weights=active.map(animal=>animal?.weights?.at(-1)?.weightKg).filter(finite).map(Number);
      let costMinor=0,incomeMinor=0;
      for(const entry of payloads(finance)){
        const amount=finite(entry?.amountMinor)?Number(entry.amountMinor):0;
        const direction=entry?.direction??entry?.kind;
        if(direction==='expense'||direction==='cost')costMinor+=amount;
        if(direction==='income'||direction==='revenue')incomeMinor+=amount;
      }
      return Object.freeze({
        kpis:Object.freeze({lots:lots.length,activeAnimals:active.length,averageWeightKg:average(weights),costMinor,incomeMinor}),
        alerts:Object.freeze([...(alertRows??[])]),
        layout:Object.freeze(validateDashboardLayout(DEFAULT_LAYOUT))
      });
    }
  });
}
