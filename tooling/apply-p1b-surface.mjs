import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const read=path=>readFile(path,'utf8');
const write=(path,value)=>writeFile(path,value);
const json=async path=>JSON.parse(await read(path));
const pretty=value=>`${JSON.stringify(value,null,2)}\n`;

function mustReplace(source,from,to,label){
  if(!source.includes(from))throw new Error(`P1B patch anchor not found: ${label}`);
  return source.replace(from,to);
}
function replaceSection(source,start,end,replacement,label){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error(`P1B section anchor not found: ${label}`);
  return source.slice(0,a)+replacement+source.slice(b);
}
function canonicalJson(value){
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  if(value!==null&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  const result=JSON.stringify(value);
  if(result===undefined||(typeof value==='number'&&!Number.isFinite(value)))throw new TypeError('Contract must contain JSON values only');
  return result;
}
const digest=value=>createHash('sha256').update(canonicalJson(value)).digest('hex');

async function patchPresentation(){
  const path='src/presentation.js';let source=await read(path);
  source=mustReplace(source,"import {createFinanceAdminService} from './services/finance-admin.js';","import {createFinanceAdminService} from './services/finance-admin.js';\nimport {createPastureManagementService} from './services/pasture-management.js';",'presentation import');
  source=mustReplace(source,"  const financeAdmin=createFinanceAdminService(persistence,{audit});","  const financeAdmin=createFinanceAdminService(persistence,{audit});\n  const pastureManagement=createPastureManagementService(persistence);",'presentation service');
  const block=`    pastures:{kind:'pastures',load:async()=>({rows:await p1.pastures.list(),occupancy:await p1.pastureOccupancy.list(),management:await pastureManagement.snapshot()}),actions:{save:audited('cattle.pasture.save','pasture',input=>pastureManagement.savePasture(input)),enterLot:audited('cattle.pasture.enter','pasture-occupancy',input=>pastureManagement.enterLot(input)),leaveLot:audited('cattle.pasture.leave','pasture-occupancy',input=>pastureManagement.leaveLot(input)),recordAssessment:audited('cattle.pasture.assessment.record','pasture-assessment',input=>pastureManagement.recordAssessment(input)),recordBodyCondition:audited('cattle.body-condition.record','body-condition',input=>pastureManagement.recordBodyCondition(input)),saveRotationPlan:audited('cattle.pasture.rotation.save','pasture-rotation',input=>pastureManagement.saveRotationPlan(input))}},\n`;
  source=replaceSection(source,"    pastures:{kind:'pastures'","    nutrition:{kind:'nutrition'",block,'presentation pastures');
  await write(path,source);
}

async function patchForms(){
  const path='web/action-config.js';let source=await read(path);
  const formBlock=`  pastures:Object.freeze({\n    save:form('Cadastrar pastagem/área',[field('id','ID'),field('name','Nome'),field('farmUnitId','Fazenda','text',{refCollection:'farms'}),field('areaHa','Área (ha)','number',{step:'0.01'}),field('capacityAu','Capacidade (UA)','number',{step:'0.01'}),field('forage','Forrageira'),field('status','Status','select',{options:[['available','Disponível'],['unavailable','Indisponível']]}),field('color','Cor/identificação'),field('polygon','Polígono esquemático (x,y por linha)','textarea'),field('restTargetDays','Meta de descanso (dias)','number'),field('occupancyTargetDays','Meta de ocupação (dias)','number'),field('targetHeightCm','Altura-alvo (cm)','number',{step:'0.1'}),field('notes','Observações','textarea')],v=>({id:clean(v.id),name:clean(v.name),farmUnitId:clean(v.farmUnitId),areaHa:num(v.areaHa),capacityAu:v.capacityAu===''?null:num(v.capacityAu),forage:clean(v.forage)||null,status:clean(v.status)||'available',color:clean(v.color)||null,polygon:String(v.polygon??'').split(/\\n+/).map(s=>s.trim()).filter(Boolean).map((line,index)=>{const parts=line.split(/[;, ]+/).filter(Boolean);if(parts.length!==2||!parts.every(part=>Number.isFinite(Number(part))))throw new TypeError(\`Ponto \${index+1} inválido. Use x,y.\`);return{x:Number(parts[0]),y:Number(parts[1])}}),restTargetDays:v.restTargetDays===''?null:num(v.restTargetDays),occupancyTargetDays:v.occupancyTargetDays===''?null:num(v.occupancyTargetDays),targetHeightCm:v.targetHeightCm===''?null:num(v.targetHeightCm),notes:clean(v.notes)||null})),\n    enterLot:form('Entrada de lote na pastagem',[field('id','ID da ocupação'),field('pastureId','Pastagem','text',{refCollection:'pastures'}),field('lotId','Lote','text',{refCollection:'lots'}),field('enteredAt','Entrada','datetime-local'),field('animalUnits','Unidades animais (UA)','number',{step:'0.01'}),field('notes','Observações')],v=>({...v,enteredAt:dateTime(v.enteredAt),animalUnits:v.animalUnits===''?null:num(v.animalUnits)})),\n    leaveLot:form('Saída de lote da pastagem',[field('id','ID da ocupação'),field('leftAt','Saída','datetime-local')],v=>({id:clean(v.id),leftAt:dateTime(v.leftAt)})),\n    recordAssessment:form('Avaliar pastagem',[field('id','ID da avaliação'),field('pastureId','Pastagem','text',{refCollection:'pastures'}),field('occurredAt','Data/hora','datetime-local'),field('score','Escore','number',{step:'0.1'}),field('scaleMin','Escala mínima','number',{step:'0.1'}),field('scaleMax','Escala máxima','number',{step:'0.1'}),field('heightCm','Altura (cm)','number',{step:'0.1'}),field('forageMassKgHa','Massa de forragem (kg/ha)','number',{step:'0.1'}),field('groundCoverPct','Cobertura do solo (%)','number',{step:'0.1'}),field('photoPaths','Fotos locais','list'),field('notes','Observações','textarea')],v=>({id:clean(v.id),pastureId:clean(v.pastureId),occurredAt:dateTime(v.occurredAt),score:num(v.score),scaleMin:v.scaleMin===''?undefined:num(v.scaleMin),scaleMax:v.scaleMax===''?undefined:num(v.scaleMax),heightCm:v.heightCm===''?null:num(v.heightCm),forageMassKgHa:v.forageMassKgHa===''?null:num(v.forageMassKgHa),groundCoverPct:v.groundCoverPct===''?null:num(v.groundCoverPct),photoPaths:list(v.photoPaths),notes:clean(v.notes)||null})),\n    recordBodyCondition:form('Registrar escore corporal',[field('id','ID da observação'),field('animalId','Animal','text',{refCollection:'animals'}),field('occurredAt','Data/hora','datetime-local'),field('score','Escore corporal','number',{step:'0.1'}),field('scaleId','Escala'),field('scaleMin','Escala mínima','number',{step:'0.1'}),field('scaleMax','Escala máxima','number',{step:'0.1'}),field('notes','Observações','textarea')],v=>({id:clean(v.id),animalId:clean(v.animalId),occurredAt:dateTime(v.occurredAt),score:num(v.score),scaleId:clean(v.scaleId)||undefined,scaleMin:v.scaleMin===''?undefined:num(v.scaleMin),scaleMax:v.scaleMax===''?undefined:num(v.scaleMax),notes:clean(v.notes)||null})),\n    saveRotationPlan:form('Planejar rotação',[field('id','ID do plano'),field('pastureId','Pastagem','text',{refCollection:'pastures'}),field('lotId','Lote','text',{refCollection:'lots'}),field('plannedEnterAt','Entrada planejada','datetime-local'),field('plannedLeaveAt','Saída planejada','datetime-local'),field('status','Status','select',{options:[['planned','Planejada'],['active','Em execução'],['completed','Concluída'],['cancelled','Cancelada']]}),field('notes','Observações','textarea')],v=>({id:clean(v.id),pastureId:clean(v.pastureId),lotId:clean(v.lotId),plannedEnterAt:dateTime(v.plannedEnterAt),plannedLeaveAt:v.plannedLeaveAt?dateTime(v.plannedLeaveAt):null,status:clean(v.status)||'planned',notes:clean(v.notes)||null}))\n  }),\n`;
  source=replaceSection(source,'  pastures:Object.freeze({','  nutrition:Object.freeze({',formBlock,'action forms pastures');
  const oldOptions="['cattle.pastures','Pastagens e áreas'],['cattle.pasture-occupancy','Ocupação de pastagens'],['cattle.nutrition','Nutrição']";
  const newOptions="['cattle.pastures','Pastagens e áreas'],['cattle.pasture-occupancy','Ocupação de pastagens'],['cattle.pasture-assessments','Avaliações de pastagens'],['cattle.body-condition','Escore corporal'],['cattle.pasture-rotation-plan','Planos de rotação'],['cattle.nutrition','Nutrição']";
  source=mustReplace(source,oldOptions,newOptions,'transfer form collections');
  await write(path,source);
}

async function patchSearchTransfer(){
  for(const path of ['src/services/search.js','src/services/transfer.js']){
    let source=await read(path);
    const anchor="  'cattle.pastures',";
    source=mustReplace(source,anchor,`${anchor}\n  'cattle.pasture-assessments',\n  'cattle.body-condition',\n  'cattle.pasture-rotation-plan',`,`${path} P1B collections`);
    await write(path,source);
  }
}

async function patchUi(){
  const ui=`import React from 'react';\n\nconst statusLabel={available:'Disponível',occupied:'Ocupado',resting:'Descanso',unavailable:'Indisponível'};\nconst fmt=value=>value==null?'—':String(value);\nconst polygonPoints=polygon=>(polygon??[]).map(point=>\`${'${'}Number(point.x).toFixed(1)},${'${'}Number(point.y).toFixed(1)}\`).join(' ');\n\nfunction PastureMap({pastures=[]}){\n  return <section className=\"panel\" data-testid=\"pasture-local-map\"><div className=\"panel-heading\"><div><span className=\"eyebrow\">Sem serviço de mapas</span><h2>Mapa esquemático local</h2><p>Desenho salvo no próprio banco. A operação não depende de Google Maps, internet ou assinatura.</p></div></div><div className=\"pasture-map-grid\">{pastures.map((pasture,index)=><article className=\"pasture-map-card\" key={pasture.id}><svg viewBox=\"0 0 100 100\" role=\"img\" aria-label={\`Área ${'${'}pasture.name??pasture.id}\`}><rect x=\"2\" y=\"2\" width=\"96\" height=\"96\" rx=\"8\" fill=\"none\" stroke=\"currentColor\" strokeOpacity=\".18\"/>{pasture.polygon?.length>=3?<polygon points={polygonPoints(pasture.polygon)} fill=\"currentColor\" fillOpacity=\".12\" stroke=\"currentColor\" strokeWidth=\"1.5\"/>:<rect x={10+(index%3)*4} y={12+(index%4)*3} width=\"72\" height=\"62\" rx=\"10\" fill=\"currentColor\" fillOpacity=\".08\" stroke=\"currentColor\" strokeDasharray=\"4 3\"/>}</svg><div><strong>{pasture.name??pasture.id}</strong><span className=\"muted\">{statusLabel[pasture.operationalStatus]??pasture.operationalStatus} · {fmt(pasture.areaHa)} ha</span></div></article>)}</div></section>;\n}\n\nexport function PastureManagementWorkspace({data}){\n  const management=data??{},pastures=management.pastures??[],rotationPlans=management.rotationPlans??[],bodyCondition=management.bodyCondition??[];\n  return <div className=\"pasture-management\"><PastureMap pastures={pastures}/><section className=\"panel\" data-testid=\"pasture-condition\"><div className=\"panel-heading\"><div><span className=\"eyebrow\">Medição de campo</span><h2>Condição medida</h2><p>Altura, massa, cobertura e escore vêm de observações registradas; valores ausentes continuam ausentes.</p></div></div><div className=\"data-cards\">{pastures.map(pasture=>{const latestAssessment=pasture.latestAssessment;return <article className=\"data-card\" key={pasture.id}><strong>{pasture.name??pasture.id}</strong><span>Status: {statusLabel[pasture.operationalStatus]??pasture.operationalStatus}</span><span>Escore: {fmt(latestAssessment?.score)}</span><span>Altura: {latestAssessment?.heightCm==null?'—':\`${'${'}latestAssessment.heightCm} cm\`}</span><span>Massa: {latestAssessment?.forageMassKgHa==null?'—':\`${'${'}latestAssessment.forageMassKgHa} kg/ha\`}</span><span>Cobertura: {latestAssessment?.groundCoverPct==null?'—':\`${'${'}latestAssessment.groundCoverPct}%\`}</span></article>})}</div></section><section className=\"panel\" data-testid=\"pasture-rotations\"><div className=\"panel-heading\"><div><span className=\"eyebrow\">Planejado x executado</span><h2>Rotação planejada</h2><p>{rotationPlans.length} plano(s) local(is).</p></div></div>{rotationPlans.length?<div className=\"data-cards\">{rotationPlans.map(plan=><article className=\"data-card\" key={plan.id}><strong>{plan.id}</strong><span>Pasto: {plan.pastureId}</span><span>Lote: {plan.lotId}</span><span>Entrada: {plan.plannedEnterAt}</span><span>Saída: {plan.plannedLeaveAt??'—'}</span><span>Status: {plan.status}</span></article>)}</div>:<p className=\"muted\">Nenhuma rotação planejada.</p>}</section><section className=\"panel\" data-testid=\"pasture-body-condition\"><div className=\"panel-heading\"><div><span className=\"eyebrow\">Observação zootécnica</span><h2>Escore corporal</h2><p>{bodyCondition.length} observação(ões) registrada(s).</p></div></div>{bodyCondition.length?<div className=\"data-cards\">{bodyCondition.slice().sort((a,b)=>String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0,12).map(item=><article className=\"data-card\" key={item.id}><strong>{item.animalId}</strong><span>Escore: {item.score}</span><span>Escala: {item.scaleMin}–{item.scaleMax}</span><span>{item.occurredAt}</span></article>)}</div>:<p className=\"muted\">Sem escores corporais registrados.</p>}</section></div>;\n}\n`;
  await write('web/pasture-management.jsx',ui);
  const path='web/main.jsx';let source=await read(path);
  source=mustReplace(source,"import {FinanceAdminWorkspace} from './finance-admin.jsx';","import {FinanceAdminWorkspace} from './finance-admin.jsx';\nimport {PastureManagementWorkspace} from './pasture-management.jsx';",'main pasture import');
  source=mustReplace(source,"      {screenId==='pastures'&&<PastureDecisionPanel insights={depthInsights}/>} ","      {screenId==='pastures'&&<PastureManagementWorkspace data={data?.management}/>} \n      {screenId==='pastures'&&<PastureDecisionPanel insights={depthInsights}/>} ",'main pasture render');
  await write(path,source);
}

async function patchContractsAndTests(){
  const actions=['save','enterLot','leaveLot','recordAssessment','recordBodyCondition','saveRotationPlan'];
  const product=await json('qa/product-contract.json');product.actions.pastures=actions;await write('qa/product-contract.json',pretty(product));
  const api=await json('qa/api-contract.json');api.actions.pastures=actions;await write('qa/api-contract.json',pretty(api));
  await write('qa/api-contract.baseline.json',pretty({schemaVersion:1,sha256:digest(api)}));

  let source=await read('tests/p0-ui-contract-coverage.test.js');source=source.replaceAll('58-action','61-action').replace('flat().length,58','flat().length,61');await write('tests/p0-ui-contract-coverage.test.js',source);
  source=await read('tests/web-action-config.test.js');source=source.replace('expected.length,58','expected.length,61');await write('tests/web-action-config.test.js',source);
  source=await read('tests/product-actions.test.js');
  source=mustReplace(source,"  'pastures.save','pastures.enterLot','pastures.leaveLot',","  'pastures.save','pastures.enterLot','pastures.recordAssessment','pastures.recordBodyCondition','pastures.saveRotationPlan','pastures.leaveLot',",'product action order');
  source=source.replaceAll('58 contracted actions','61 contracted actions');
  source=mustReplace(source,"      'pastures.enterLot':()=>run('pastures','enterLot',{id:'occupancy-qa',pastureId:'pasture-qa',lotId:'lot-main',enteredAt:'2026-09-19T15:35:00Z',animalUnits:10,notes:'qa'}),\n      'pastures.leaveLot':()=>run('pastures','leaveLot',{id:'occupancy-qa',leftAt:'2026-09-20T15:35:00Z'}),","      'pastures.enterLot':()=>run('pastures','enterLot',{id:'occupancy-qa',pastureId:'pasture-qa',lotId:'lot-main',enteredAt:'2026-09-19T15:35:00Z',animalUnits:10,notes:'qa'}),\n      'pastures.recordAssessment':()=>run('pastures','recordAssessment',{id:'assessment-qa',pastureId:'pasture-qa',occurredAt:'2026-09-19T16:00:00Z',score:4,heightCm:28,forageMassKgHa:3200,groundCoverPct:90}),\n      'pastures.recordBodyCondition':()=>run('pastures','recordBodyCondition',{id:'body-qa',animalId:'animal-weight',occurredAt:'2026-09-19T16:05:00Z',score:3.5}),\n      'pastures.saveRotationPlan':()=>run('pastures','saveRotationPlan',{id:'rotation-qa',pastureId:'pasture-qa',lotId:'lot-main',plannedEnterAt:'2026-09-25T08:00:00Z',plannedLeaveAt:'2026-09-28T08:00:00Z'}),\n      'pastures.leaveLot':()=>run('pastures','leaveLot',{id:'occupancy-qa',leftAt:'2026-09-20T15:35:00Z'}),",'product action scenarios');
  await write('tests/product-actions.test.js',source);
}

await patchPresentation();
await patchForms();
await patchSearchTransfer();
await patchUi();
await patchContractsAndTests();
console.log('P1B surface patch applied.');
