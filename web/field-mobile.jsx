import React,{useMemo,useRef,useState} from 'react';

const unwrap=list=>(list??[]).map(item=>item?.payload??item);
const animalLabel=animal=>animal.tag??animal.name??animal.id;
const lotLabel=lot=>lot.name??lot.id;
const pastureLabel=pasture=>pasture.name??pasture.id;
const protocolLabel=protocol=>protocol.name??protocol.id;
const safeFile=value=>String(value??'campo').replace(/[^a-zA-Z0-9._-]+/g,'-').toLowerCase();
const nowLocal=()=>new Date().toISOString().slice(0,16);
const isoInput=value=>new Date(value).toISOString();
const scoreOptions=[1,2,3,4,5];

function saveJson(value,name){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}

async function readJsonFile(file){
  if(!file)throw new Error('Selecione um arquivo JSON.');
  return JSON.parse(await file.text());
}

function AnimalSelect({animals,value,onChange,label='Animal',includeEmpty=true}){
  return <label className="field-label"><span>{label}</span><select value={value} onChange={event=>onChange(event.target.value)}>{includeEmpty&&<option value="">Selecione</option>}{animals.map(animal=><option key={animal.id} value={animal.id}>{animalLabel(animal)}</option>)}</select></label>;
}

function FieldTaskQueue({tasks,onQuick,busy}){
  const pending=useMemo(()=>unwrap(tasks).filter(task=>task.status !== 'completed').sort((a,b)=>String(a.dueAt).localeCompare(String(b.dueAt))),[tasks]);
  return <section className="field-card" data-testid="field-task-queue">
    <header><div><span className="eyebrow">Fila de manejo</span><h3>Próximos trabalhos</h3></div><strong className="field-count">{pending.length}</strong></header>
    {pending.length===0?<div className="field-empty">Nenhum manejo pendente.</div>:<div className="field-queue">{pending.slice(0,30).map(task=><article key={task.id} className="field-task"><div><strong>{task.title}</strong><small>{task.animalId??task.lotId??'Manejo geral'}</small></div><button className="field-touch-button primary" disabled={busy} onClick={()=>onQuick('task.complete',{id:task.id})}>Concluir</button></article>)}</div>}
  </section>;
}

function WeightKeypad({animals,onQuick,busy}){
  const [animalId,setAnimalId]=useState('');
  const [value,setValue]=useState('');
  const keys=['1','2','3','4','5','6','7','8','9','.','0','⌫'];
  const press=key=>{if(key==='⌫')return setValue(current=>current.slice(0,-1));if(key==='.'&&value.includes('.'))return;setValue(current=>`${current}${key}`.slice(0,7));};
  const weight=Number(value);
  return <section className="field-card" data-testid="field-touch-keypad"><header><div><span className="eyebrow">Teclado de peso</span><h3>Pesagem rápida</h3></div></header><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/><div className="field-weight-display" aria-live="polite">{value||'0'} <small>kg</small></div><div className="field-keypad">{keys.map(key=><button type="button" key={key} onClick={()=>press(key)}>{key}</button>)}</div><div className="field-actions"><button type="button" className="field-touch-button ghost" onClick={()=>setValue('')}>Limpar</button><button type="button" className="field-touch-button primary" disabled={busy||!animalId||!Number.isFinite(weight)||weight<=0} onClick={async()=>{await onQuick('weight.record',{id:animalId,weightKg:weight,measuredAt:new Date().toISOString()});setValue('')}}>Registrar peso</button></div></section>;
}

function QuickMove({animals,lots,onQuick,busy}){
  const [animalId,setAnimalId]=useState(''),[toLotId,setToLotId]=useState('');
  return <section className="field-card" data-testid="field-quick-move"><header><div><span className="eyebrow">Mover animal</span><h3>Troca de lote</h3></div></header><div className="field-stack"><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/><label className="field-label"><span>Destino</span><select value={toLotId} onChange={event=>setToLotId(event.target.value)}><option value="">Selecione</option>{lots.map(lot=><option key={lot.id} value={lot.id}>{lotLabel(lot)}</option>)}</select></label><button type="button" className="field-touch-button primary" disabled={busy||!animalId||!toLotId} onClick={async()=>{await onQuick('animal.move',{id:animalId,toLotId,movedAt:new Date().toISOString(),reason:'field-mobile'});setAnimalId('');setToLotId('')}}>Mover animal</button></div></section>;
}

function QuickSanitary({animals,protocols,onQuick,busy}){
  const [animalId,setAnimalId]=useState(''),[protocolId,setProtocolId]=useState('');
  return <section className="field-card" data-testid="field-quick-sanitary"><header><div><span className="eyebrow">Aplicar protocolo</span><h3>Sanidade no curral</h3></div></header><div className="field-stack"><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/><label className="field-label"><span>Protocolo</span><select value={protocolId} onChange={event=>setProtocolId(event.target.value)}><option value="">Selecione</option>{protocols.map(protocol=><option key={protocol.id} value={protocol.id}>{protocolLabel(protocol)}</option>)}</select></label><button type="button" className="field-touch-button primary" disabled={busy||!animalId||!protocolId} onClick={async()=>{await onQuick('sanitary.record',{animalId,protocolId,occurredAt:new Date().toISOString()});setAnimalId('');setProtocolId('')}}>Aplicar protocolo</button></div></section>;
}

function QuickReproduction({animals,onQuick,busy}){
  const [animalId,setAnimalId]=useState(''),[type,setType]=useState('service'),[occurredAt,setOccurredAt]=useState(nowLocal()),[notes,setNotes]=useState('');
  return <section className="field-card" data-testid="field-quick-reproduction"><header><div><span className="eyebrow">Reprodução</span><h3>Evento reprodutivo</h3></div></header><div className="field-stack"><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/><label className="field-label"><span>Tipo</span><select value={type} onChange={event=>setType(event.target.value)}><option value="service">Serviço</option><option value="pregnancy-check">Diagnóstico de gestação</option><option value="calving">Parto</option><option value="weaning">Desmame</option><option value="pregnancy-loss">Perda gestacional</option><option value="abortion">Aborto</option></select></label><label className="field-label"><span>Data e hora</span><input type="datetime-local" value={occurredAt} onChange={event=>setOccurredAt(event.target.value)}/></label><label className="field-label"><span>Observação</span><input value={notes} onChange={event=>setNotes(event.target.value)}/></label><button className="field-touch-button primary" disabled={busy||!animalId||!occurredAt} onClick={async()=>{await onQuick('reproduction.record',{animalId,type,occurredAt:isoInput(occurredAt),notes});setAnimalId('');setNotes('')}}>Registrar evento</button></div></section>;
}

function QuickBirth({animals,lots,fieldData,onQuick,busy}){
  const farms=unwrap(fieldData.farms),breeds=unwrap(fieldData.breeds),categories=unwrap(fieldData.categories);
  const [form,setForm]=useState({id:'',tag:'',farmUnitId:'',birthDate:nowLocal(),sex:'female',damId:'',sireId:'',lotId:'',breedId:'',categoryId:'',rfid:'',notes:''});
  const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  const submit=async()=>{await onQuick('animal.birth',{...form,birthDate:isoInput(form.birthDate)});setForm(current=>({...current,id:'',tag:'',rfid:'',notes:''}))};
  return <section className="field-card" data-testid="field-quick-birth"><header><div><span className="eyebrow">Nascimento</span><h3>Registrar bezerro</h3><p>Bezerro e evento de nascimento são gravados de forma atômica.</p></div></header><div className="field-form-grid"><label className="field-label"><span>ID *</span><input value={form.id} onChange={e=>set('id',e.target.value)}/></label><label className="field-label"><span>Brinco *</span><input value={form.tag} onChange={e=>set('tag',e.target.value)}/></label><label className="field-label"><span>Unidade/Fazenda *</span>{farms.length?<select value={form.farmUnitId} onChange={e=>set('farmUnitId',e.target.value)}><option value="">Selecione</option>{farms.map(item=><option key={item.id} value={item.id}>{item.name??item.id}</option>)}</select>:<input value={form.farmUnitId} onChange={e=>set('farmUnitId',e.target.value)}/>}</label><label className="field-label"><span>Nascimento *</span><input type="datetime-local" value={form.birthDate} onChange={e=>set('birthDate',e.target.value)}/></label><label className="field-label"><span>Sexo *</span><select value={form.sex} onChange={e=>set('sex',e.target.value)}><option value="female">Fêmea</option><option value="male">Macho</option></select></label><AnimalSelect animals={animals.filter(a=>a.sex==='female')} value={form.damId} onChange={value=>set('damId',value)} label="Mãe"/><AnimalSelect animals={animals.filter(a=>a.sex==='male')} value={form.sireId} onChange={value=>set('sireId',value)} label="Pai"/><label className="field-label"><span>Lote</span><select value={form.lotId} onChange={e=>set('lotId',e.target.value)}><option value="">Sem lote</option>{lots.map(item=><option key={item.id} value={item.id}>{lotLabel(item)}</option>)}</select></label><label className="field-label"><span>Raça</span><select value={form.breedId} onChange={e=>set('breedId',e.target.value)}><option value="">Não informada</option>{breeds.map(item=><option key={item.id} value={item.id}>{item.name??item.id}</option>)}</select></label><label className="field-label"><span>Categoria</span><select value={form.categoryId} onChange={e=>set('categoryId',e.target.value)}><option value="">Não informada</option>{categories.map(item=><option key={item.id} value={item.id}>{item.name??item.id}</option>)}</select></label><label className="field-label"><span>RFID/EID</span><input value={form.rfid} onChange={e=>set('rfid',e.target.value)}/></label><label className="field-label field-span-2"><span>Observações</span><input value={form.notes} onChange={e=>set('notes',e.target.value)}/></label></div><button className="field-touch-button primary" disabled={busy||!form.id||!form.tag||!form.farmUnitId||!form.birthDate||!form.sex} onClick={submit}>Registrar nascimento</button></section>;
}

function QuickLifecycle({animals,onQuick,busy}){
  const [animalId,setAnimalId]=useState(''),[mode,setMode]=useState('death'),[occurredAt,setOccurredAt]=useState(nowLocal()),[reason,setReason]=useState('');
  const submit=async()=>{if(mode==='weaning')await onQuick('animal.weaning',{animalId,occurredAt:isoInput(occurredAt),notes:reason});else await onQuick('animal.death',{animalId,occurredAt:isoInput(occurredAt),reason});setAnimalId('');setReason('')};
  return <section className="field-card" data-testid="field-quick-lifecycle"><header><div><span className="eyebrow">Ciclo de vida</span><h3>Desmame ou baixa</h3></div></header><div className="field-stack"><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/><label className="field-label"><span>Manejo</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="death">Óbito</option><option value="weaning">Desmame</option></select></label><label className="field-label"><span>Data e hora</span><input type="datetime-local" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/></label><label className="field-label"><span>Motivo/observação</span><input value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="field-touch-button primary" disabled={busy||!animalId||!occurredAt} onClick={submit}>Registrar manejo</button></div></section>;
}

function QuickRfid({animals,onQuick,busy}){
  const [animalId,setAnimalId]=useState(''),[tagId,setTagId]=useState('');
  return <section className="field-card" data-testid="field-quick-rfid"><header><div><span className="eyebrow">RFID/EID</span><h3>Vincular leitura manual</h3></div></header><div className="field-stack"><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/><label className="field-label"><span>Código RFID/EID</span><input inputMode="numeric" value={tagId} onChange={e=>setTagId(e.target.value)}/></label><button className="field-touch-button primary" disabled={busy||!animalId||!tagId.trim()} onClick={async()=>{await onQuick('rfid.bind',{animalId,tagId});setTagId('')}}>Vincular identificação</button></div></section>;
}

function QuickTraceability({animals,onQuick,busy}){
  const [animalId,setAnimalId]=useState(''),[documentNumber,setDocumentNumber]=useState(''),[type,setType]=useState('identity'),[notes,setNotes]=useState('');
  return <section className="field-card" data-testid="field-quick-traceability"><header><div><span className="eyebrow">Rastreabilidade</span><h3>Documento do animal</h3></div></header><div className="field-stack"><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/><label className="field-label"><span>Tipo</span><input value={type} onChange={e=>setType(e.target.value)}/></label><label className="field-label"><span>Número/documento</span><input value={documentNumber} onChange={e=>setDocumentNumber(e.target.value)}/></label><label className="field-label"><span>Observações</span><input value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="field-touch-button primary" disabled={busy||!animalId||!type.trim()} onClick={async()=>{await onQuick('traceability.save',{animalId,type,documentNumber,issuedAt:new Date().toISOString(),notes});setDocumentNumber('');setNotes('')}}>Salvar rastreabilidade</button></div></section>;
}

function QuickBatch({animals,lots,protocols,onQuick,busy}){
  const [mode,setMode]=useState('move'),[selectedIds,setSelectedIds]=useState([]),[lotId,setLotId]=useState(''),[protocolId,setProtocolId]=useState(''),[reproductionType,setReproductionType]=useState('weaning'),[lifecycleType,setLifecycleType]=useState('disposal');
  const toggle=id=>setSelectedIds(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  const submit=async()=>{const occurredAt=new Date().toISOString();if(mode==='move')await onQuick('animal.batchMove',{animalIds:selectedIds,toLotId:lotId,movedAt:occurredAt,reason:'field-mobile'});if(mode==='lifecycle')await onQuick('animal.batchLifecycle',{animalIds:selectedIds,type:lifecycleType,occurredAt,reason:'field-mobile'});if(mode==='sanitary')await onQuick('sanitary.batchRecord',{animalIds:selectedIds,protocolId,occurredAt});if(mode==='reproduction')await onQuick('reproduction.batchRecord',{animalIds:selectedIds,type:reproductionType,occurredAt});setSelectedIds([])};
  const ready=selectedIds.length>0&&(mode==='move'?Boolean(lotId):mode==='sanitary'?Boolean(protocolId):true);
  return <section className="field-card" data-testid="field-quick-batch"><header><div><span className="eyebrow">Manejo coletivo</span><h3>Aplicar ao grupo selecionado</h3></div><strong className="field-count">{selectedIds.length}</strong></header><div className="field-stack"><label className="field-label"><span>Operação</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="move">Mover lote</option><option value="lifecycle">Ciclo de vida</option><option value="sanitary">Sanidade</option><option value="reproduction">Reprodução</option></select></label>{mode==='move'&&<label className="field-label"><span>Lote destino</span><select value={lotId} onChange={e=>setLotId(e.target.value)}><option value="">Selecione</option>{lots.map(item=><option key={item.id} value={item.id}>{lotLabel(item)}</option>)}</select></label>}{mode==='sanitary'&&<label className="field-label"><span>Protocolo</span><select value={protocolId} onChange={e=>setProtocolId(e.target.value)}><option value="">Selecione</option>{protocols.map(item=><option key={item.id} value={item.id}>{protocolLabel(item)}</option>)}</select></label>}{mode==='lifecycle'&&<label className="field-label"><span>Tipo</span><select value={lifecycleType} onChange={e=>setLifecycleType(e.target.value)}><option value="disposal">Descarte</option><option value="death">Óbito</option></select></label>}{mode==='reproduction'&&<label className="field-label"><span>Tipo</span><select value={reproductionType} onChange={e=>setReproductionType(e.target.value)}><option value="weaning">Desmame</option><option value="pregnancy-check">Diagnóstico de gestação</option><option value="service">Serviço</option></select></label>}<div className="field-multi-list">{animals.map(animal=><label key={animal.id} className={`field-check ${selectedIds.includes(animal.id)?'selected':''}`}><input type="checkbox" checked={selectedIds.includes(animal.id)} onChange={()=>toggle(animal.id)}/><span>{animalLabel(animal)}</span></label>)}</div><button className="field-touch-button primary" disabled={busy||!ready} onClick={submit}>Aplicar manejo coletivo</button></div></section>;
}

function QuickPasture({lots,pastures,occupancy,onQuick,busy}){
  const [mode,setMode]=useState('enter'),[pastureId,setPastureId]=useState(''),[lotId,setLotId]=useState(''),[animalUnits,setAnimalUnits]=useState(''),[occupancyId,setOccupancyId]=useState('');
  const activeOccupancy=unwrap(occupancy).filter(item=>!item.leftAt);
  const submit=async()=>{if(mode==='enter')await onQuick('pasture.enterLot',{pastureId,lotId,enteredAt:new Date().toISOString(),animalUnits:animalUnits?Number(animalUnits):null});else await onQuick('pasture.leaveLot',{id:occupancyId,leftAt:new Date().toISOString()});setAnimalUnits('')};
  return <section className="field-card" data-testid="field-quick-pasture"><header><div><span className="eyebrow">Pastagens</span><h3>Entrada e saída de lote</h3></div></header><div className="field-stack"><label className="field-label"><span>Operação</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="enter">Entrada</option><option value="leave">Saída</option></select></label>{mode==='enter'?<><label className="field-label"><span>Pasto/piquete</span><select value={pastureId} onChange={e=>setPastureId(e.target.value)}><option value="">Selecione</option>{pastures.map(item=><option key={item.id} value={item.id}>{pastureLabel(item)}</option>)}</select></label><label className="field-label"><span>Lote</span><select value={lotId} onChange={e=>setLotId(e.target.value)}><option value="">Selecione</option>{lots.map(item=><option key={item.id} value={item.id}>{lotLabel(item)}</option>)}</select></label><label className="field-label"><span>UA (opcional)</span><input inputMode="decimal" value={animalUnits} onChange={e=>setAnimalUnits(e.target.value)}/></label></>:<label className="field-label"><span>Ocupação ativa</span><select value={occupancyId} onChange={e=>setOccupancyId(e.target.value)}><option value="">Selecione</option>{activeOccupancy.map(item=><option key={item.id} value={item.id}>{pastureLabel(pastures.find(p=>p.id===item.pastureId)??{id:item.pastureId})} · {lotLabel(lots.find(l=>l.id===item.lotId)??{id:item.lotId})}</option>)}</select></label>}<button className="field-touch-button primary" disabled={busy||(mode==='enter'?(!pastureId||!lotId):!occupancyId)} onClick={submit}>{mode==='enter'?'Registrar entrada':'Registrar saída'}</button></div></section>;
}

function QuickScores({animals,pastures,onQuick,busy}){
  const [mode,setMode]=useState('body'),[animalId,setAnimalId]=useState(''),[pastureId,setPastureId]=useState(''),[score,setScore]=useState('3'),[heightCm,setHeightCm]=useState('');
  const submit=async()=>{if(mode==='body')await onQuick('animal.bodyScore',{animalId,occurredAt:new Date().toISOString(),score:Number(score)});else await onQuick('pasture.score',{pastureId,occurredAt:new Date().toISOString(),score:Number(score),heightCm:heightCm?Number(heightCm):null});setHeightCm('')};
  return <section className="field-card" data-testid="field-quick-scores"><header><div><span className="eyebrow">Escore de campo</span><h3>Animal ou pastagem</h3></div></header><div className="field-stack"><label className="field-label"><span>Tipo</span><select value={mode} onChange={e=>setMode(e.target.value)}><option value="body">Escore corporal</option><option value="pasture">Escore da pastagem</option></select></label>{mode==='body'?<AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/>:<label className="field-label"><span>Pasto/piquete</span><select value={pastureId} onChange={e=>setPastureId(e.target.value)}><option value="">Selecione</option>{pastures.map(item=><option key={item.id} value={item.id}>{pastureLabel(item)}</option>)}</select></label>}<label className="field-label"><span>Escore 1–5</span><select value={score} onChange={e=>setScore(e.target.value)}>{scoreOptions.map(item=><option key={item} value={item}>{item}</option>)}</select></label>{mode==='pasture'&&<label className="field-label"><span>Altura (cm, opcional)</span><input inputMode="decimal" value={heightCm} onChange={e=>setHeightCm(e.target.value)}/></label>}<button className="field-touch-button primary" disabled={busy||(mode==='body'?!animalId:!pastureId)} onClick={submit}>Registrar escore</button></div></section>;
}

function OfflineAnimal360({animals,lots,fieldData}){
  const [animalId,setAnimalId]=useState('');
  const animal=animals.find(item=>item.id===animalId)??null;
  const eventRows=unwrap(fieldData.events);
  const traceRows=unwrap(fieldData.traceability);
  const bodyRows=unwrap(fieldData.bodyCondition);
  const taskRows=unwrap(fieldData.tasks);
  if(!animal)return <section className="field-card" data-testid="field-animal360"><header><div><span className="eyebrow">Animal 360º offline</span><h3>Consulta local no campo</h3><p>Abre somente dados já sincronizados neste dispositivo.</p></div></header><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/></section>;
  const latestWeight=animal.weights?.at(-1)??null;
  const latestBody=bodyRows.filter(item=>item.animalId===animal.id).sort((a,b)=>String(a.occurredAt).localeCompare(String(b.occurredAt))).at(-1)??null;
  const animalEvents=eventRows.filter(item=>item.animalId===animal.id||item.relatedAnimalId===animal.id).sort((a,b)=>String(b.occurredAt).localeCompare(String(a.occurredAt)));
  const sanitary=animalEvents.filter(item=>item.kind==='sanitary');
  const reproduction=animalEvents.filter(item=>item.kind==='reproduction');
  const births=animalEvents.filter(item=>item.kind==='birth');
  const traceability=traceRows.filter(item=>item.animalId===animal.id);
  const pendingTasks=taskRows.filter(task=>task.animalId===animal.id&&task.status !== 'completed');
  const lot=lots.find(item=>item.id===animal.lotId);
  return <section className="field-card" data-testid="field-animal360"><header><div><span className="eyebrow">Animal 360º offline</span><h3>{animalLabel(animal)}</h3><p>Consulta local; nenhuma rede é necessária para abrir esta ficha.</p></div></header><AnimalSelect animals={animals} value={animalId} onChange={setAnimalId}/><div className="field-360-grid"><article><span>Identificação</span><strong>{animal.tag??animal.id}</strong><small>{animal.rfid??animal.officialId??'Sem RFID/documento'}</small></article><article><span>Lote atual</span><strong>{lot?lotLabel(lot):'Sem lote'}</strong></article><article><span>Último peso</span><strong>{latestWeight?`${latestWeight.weightKg} kg`:'Sem dados'}</strong></article><article><span>Escore corporal</span><strong>{latestBody?.score??'Sem dados'}</strong></article></div><div className="field-360-sections"><section><h4>Sanidade</h4>{sanitary.length?sanitary.slice(0,5).map(item=><small key={item.id}>{item.protocolId??item.type??item.id} · {String(item.occurredAt).slice(0,10)}</small>):<small>Sem eventos</small>}</section><section><h4>Reprodução</h4>{reproduction.length?reproduction.slice(0,5).map(item=><small key={item.id}>{item.type??item.id} · {String(item.occurredAt).slice(0,10)}</small>):<small>Sem eventos</small>}</section><section><h4>Nascimento</h4>{births.length?births.slice(0,3).map(item=><small key={item.id}>{String(item.occurredAt).slice(0,10)}</small>):<small>Sem evento sincronizado</small>}</section><section><h4>Rastreabilidade</h4>{traceability.length?traceability.slice(0,5).map(item=><small key={item.id}>{item.type} · {item.documentNumber??item.officialId??item.id}</small>):<small>Sem registros</small>}</section><section><h4>Tarefas pendentes</h4>{pendingTasks.length?pendingTasks.slice(0,8).map(item=><small key={item.id}>{item.title} · {String(item.dueAt??'').slice(0,10)}</small>):<small>Nenhuma tarefa pendente</small>}</section></div></section>;
}

function SecureSync({syncState,onSync,busy,setBusy}){
  const pairingInput=useRef(null),bundleInput=useRef(null);
  const [deviceName,setDeviceName]=useState('Celular do curral');
  const run=async(operation,input={})=>{setBusy(true);try{return await onSync(operation,input)}finally{setBusy(false)}};
  const configureBase=async()=>{const result=await run('configure',{role:'base',deviceName:'Base local'});if(result?.pairing)saveJson(result.pairing,'artisys-pecuaria-pareamento.json')};
  const importPairing=async event=>{try{const pairing=await readJsonFile(event.target.files?.[0]);await run('configure',{role:'field',deviceName,pairing})}finally{event.target.value=''}};
  const exportBundle=async()=>{const bundle=await run('exportBundle');saveJson(bundle,`artisys-pecuaria-${safeFile(syncState?.deviceName)}-${Date.now()}.sync.json`)};
  const importBundle=async event=>{try{const bundle=await readJsonFile(event.target.files?.[0]);await run('importBundle',{bundle})}finally{event.target.value=''}};
  return <section className="field-card field-sync-card" data-testid="field-secure-sync"><header><div><span className="eyebrow">Pacote local criptografado</span><h3>Sincronização local segura</h3><p>Troca dados entre a base e o celular por arquivo AES-GCM, sem nuvem obrigatória.</p></div></header>{syncState?.paired?<><div className="field-sync-status"><span><b>{syncState.role==='base'?'Base':'Campo'}</b> · {syncState.deviceName}</span><span>{syncState.pending??0} pendente(s) · {syncState.conflicts??0} conflito(s)</span></div><div className="field-actions"><button type="button" className="field-touch-button primary" disabled={busy} onClick={exportBundle}>Exportar pacote</button><button type="button" className="field-touch-button ghost" disabled={busy} onClick={()=>bundleInput.current?.click()}>Importar pacote</button></div><input ref={bundleInput} className="field-hidden-file" type="file" accept="application/json,.json" onChange={importBundle}/></>:<><p className="field-help">No computador principal, crie a base e transfira o arquivo de pareamento uma única vez para o celular.</p><label className="field-label"><span>Nome deste aparelho</span><input value={deviceName} onChange={event=>setDeviceName(event.target.value)}/></label><div className="field-actions"><button type="button" className="field-touch-button primary" disabled={busy} onClick={configureBase}>Criar base local</button><button type="button" className="field-touch-button ghost" disabled={busy} onClick={()=>pairingInput.current?.click()}>Importar pareamento no celular</button></div><input ref={pairingInput} className="field-hidden-file" type="file" accept="application/json,.json" onChange={importPairing}/></>}</section>;
}

const operations=[['tasks','Tarefas'],['weight','Peso'],['move','Mover'],['sanitary','Sanidade'],['reproduction','Reprodução'],['birth','Nascimento'],['lifecycle','Ciclo'],['rfid','RFID'],['traceability','Rastreio'],['batch','Coletivo'],['pasture','Pastos'],['scores','Escores'],['animal360','Animal 360º'],['sync','Sincronizar']];

export function FieldMobileWorkspace({tasks=[],animals=[],lots=[],protocols=[],fieldData={},syncState=null,onSync}){
  const [busy,setBusy]=useState(false),[activeOperation,setActiveOperation]=useState('tasks');
  const activeAnimals=useMemo(()=>unwrap(animals).filter(animal=>animal.status==='active'),[animals]);
  const allAnimals=useMemo(()=>unwrap(animals),[animals]);
  const lotRows=useMemo(()=>unwrap(lots),[lots]);
  const protocolRows=useMemo(()=>unwrap(protocols),[protocols]);
  const pastureRows=useMemo(()=>unwrap(fieldData.pastures),[fieldData.pastures]);
  const quick=async(kind,input)=>{setBusy(true);try{return await onSync('quick',{kind,input})}finally{setBusy(false)}};
  const panel={
    tasks:<FieldTaskQueue tasks={fieldData.tasks??tasks} onQuick={quick} busy={busy}/>,
    weight:<WeightKeypad animals={activeAnimals} onQuick={quick} busy={busy}/>,
    move:<QuickMove animals={activeAnimals} lots={lotRows} onQuick={quick} busy={busy}/>,
    sanitary:<QuickSanitary animals={activeAnimals} protocols={protocolRows} onQuick={quick} busy={busy}/>,
    reproduction:<QuickReproduction animals={activeAnimals} onQuick={quick} busy={busy}/>,
    birth:<QuickBirth animals={allAnimals} lots={lotRows} fieldData={fieldData} onQuick={quick} busy={busy}/>,
    lifecycle:<QuickLifecycle animals={activeAnimals} onQuick={quick} busy={busy}/>,
    rfid:<QuickRfid animals={activeAnimals} onQuick={quick} busy={busy}/>,
    traceability:<QuickTraceability animals={activeAnimals} onQuick={quick} busy={busy}/>,
    batch:<QuickBatch animals={activeAnimals} lots={lotRows} protocols={protocolRows} onQuick={quick} busy={busy}/>,
    pasture:<QuickPasture lots={lotRows} pastures={pastureRows} occupancy={fieldData.pastureOccupancy} onQuick={quick} busy={busy}/>,
    scores:<QuickScores animals={activeAnimals} pastures={pastureRows} onQuick={quick} busy={busy}/>,
    animal360:<OfflineAnimal360 animals={allAnimals} lots={lotRows} fieldData={fieldData}/>,
    sync:<SecureSync syncState={syncState} onSync={onSync} busy={busy} setBusy={setBusy}/>
  }[activeOperation];
  return <section className="field-mobile-workspace" data-testid="field-mobile-workspace"><div className="field-mobile-heading"><div><span className="eyebrow">Modo campo offline</span><h2>Curral e manejo no celular</h2><p>Uma operação por vez, com controles grandes e dados locais para sinal ruim.</p></div><div className={`field-online-pill ${syncState?.paired?'paired':''}`}>{syncState?.paired?`${syncState.pending??0} na fila`:'Não pareado'}</div></div><nav className="field-operation-switcher" data-testid="field-operation-switcher" aria-label="Operações de campo">{operations.map(([id,label])=><button type="button" key={id} className={activeOperation===id?'active':''} onClick={()=>setActiveOperation(id)}>{label}</button>)}</nav><div className="field-mobile-focus">{panel}</div></section>;
}
