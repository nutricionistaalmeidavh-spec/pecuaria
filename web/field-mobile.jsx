import React,{useMemo,useRef,useState} from 'react';

const unwrap=list=>(list??[]).map(item=>item?.payload??item);
const animalLabel=animal=>animal.tag??animal.name??animal.id;
const lotLabel=lot=>lot.name??lot.id;
const protocolLabel=protocol=>protocol.name??protocol.id;
const safeFile=value=>String(value??'campo').replace(/[^a-zA-Z0-9._-]+/g,'-').toLowerCase();

function saveJson(value,name){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}

async function readJsonFile(file){
  if(!file)throw new Error('Selecione um arquivo JSON.');
  return JSON.parse(await file.text());
}

function FieldTaskQueue({tasks,onQuick,busy}){
  const pending=useMemo(()=>unwrap(tasks).filter(task=>task.status!=='completed').sort((a,b)=>String(a.dueAt).localeCompare(String(b.dueAt))),[tasks]);
  return <section className="field-card" data-testid="field-task-queue">
    <header><div><span className="eyebrow">Fila de manejo</span><h3>Próximos trabalhos</h3></div><strong className="field-count">{pending.length}</strong></header>
    {pending.length===0?<div className="field-empty">Nenhum manejo pendente.</div>:<div className="field-queue">{pending.slice(0,30).map(task=><article key={task.id} className="field-task"><div><strong>{task.title}</strong><small>{task.animalId??task.lotId??'Manejo geral'}</small></div><button className="field-touch-button primary" disabled={busy} onClick={()=>onQuick('task.complete',{id:task.id})}>Concluir</button></article>)}</div>}
  </section>;
}

function WeightKeypad({animals,onQuick,busy}){
  const [animalId,setAnimalId]=useState('');
  const [value,setValue]=useState('');
  const keys=['1','2','3','4','5','6','7','8','9','.','0','⌫'];
  const press=key=>{
    if(key==='⌫')return setValue(current=>current.slice(0,-1));
    if(key==='.'&&value.includes('.'))return;
    setValue(current=>`${current}${key}`.slice(0,7));
  };
  const weight=Number(value);
  return <section className="field-card" data-testid="field-touch-keypad">
    <header><div><span className="eyebrow">Teclado de peso</span><h3>Pesagem rápida</h3></div></header>
    <label className="field-label"><span>Animal</span><select value={animalId} onChange={event=>setAnimalId(event.target.value)}><option value="">Selecione</option>{animals.map(animal=><option key={animal.id} value={animal.id}>{animalLabel(animal)}</option>)}</select></label>
    <div className="field-weight-display" aria-live="polite">{value||'0'} <small>kg</small></div>
    <div className="field-keypad">{keys.map(key=><button type="button" key={key} onClick={()=>press(key)}>{key}</button>)}</div>
    <div className="field-actions"><button type="button" className="field-touch-button ghost" onClick={()=>setValue('')}>Limpar</button><button type="button" className="field-touch-button primary" disabled={busy||!animalId||!Number.isFinite(weight)||weight<=0} onClick={async()=>{await onQuick('weight.record',{id:animalId,weightKg:weight,measuredAt:new Date().toISOString()});setValue('')}}>Registrar peso</button></div>
  </section>;
}

function QuickMove({animals,lots,onQuick,busy}){
  const [animalId,setAnimalId]=useState(''),[toLotId,setToLotId]=useState('');
  return <section className="field-card" data-testid="field-quick-move"><header><div><span className="eyebrow">Mover animal</span><h3>Troca de lote</h3></div></header><div className="field-stack"><label className="field-label"><span>Animal</span><select value={animalId} onChange={event=>setAnimalId(event.target.value)}><option value="">Selecione</option>{animals.map(animal=><option key={animal.id} value={animal.id}>{animalLabel(animal)}</option>)}</select></label><label className="field-label"><span>Destino</span><select value={toLotId} onChange={event=>setToLotId(event.target.value)}><option value="">Selecione</option>{lots.map(lot=><option key={lot.id} value={lot.id}>{lotLabel(lot)}</option>)}</select></label><button type="button" className="field-touch-button primary" disabled={busy||!animalId||!toLotId} onClick={async()=>{await onQuick('animal.move',{id:animalId,toLotId,movedAt:new Date().toISOString(),reason:'field-mobile'});setAnimalId('');setToLotId('')}}>Mover animal</button></div></section>;
}

function QuickSanitary({animals,protocols,onQuick,busy}){
  const [animalId,setAnimalId]=useState(''),[protocolId,setProtocolId]=useState('');
  return <section className="field-card" data-testid="field-quick-sanitary"><header><div><span className="eyebrow">Aplicar protocolo</span><h3>Sanidade no curral</h3></div></header><div className="field-stack"><label className="field-label"><span>Animal</span><select value={animalId} onChange={event=>setAnimalId(event.target.value)}><option value="">Selecione</option>{animals.map(animal=><option key={animal.id} value={animal.id}>{animalLabel(animal)}</option>)}</select></label><label className="field-label"><span>Protocolo</span><select value={protocolId} onChange={event=>setProtocolId(event.target.value)}><option value="">Selecione</option>{protocols.map(protocol=><option key={protocol.id} value={protocol.id}>{protocolLabel(protocol)}</option>)}</select></label><button type="button" className="field-touch-button primary" disabled={busy||!animalId||!protocolId} onClick={async()=>{await onQuick('sanitary.record',{animalId,protocolId,occurredAt:new Date().toISOString()});setAnimalId('');setProtocolId('')}}>Aplicar protocolo</button></div></section>;
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

export function FieldMobileWorkspace({tasks=[],animals=[],lots=[],protocols=[],syncState=null,onSync}){
  const [busy,setBusy]=useState(false);
  const activeAnimals=useMemo(()=>unwrap(animals).filter(animal=>animal.status==='active'),[animals]);
  const lotRows=useMemo(()=>unwrap(lots),[lots]);
  const protocolRows=useMemo(()=>unwrap(protocols),[protocols]);
  const quick=async(kind,input)=>{setBusy(true);try{return await onSync('quick',{kind,input})}finally{setBusy(false)}};
  return <section className="field-mobile-workspace" data-testid="field-mobile-workspace"><div className="field-mobile-heading"><div><span className="eyebrow">Modo campo offline</span><h2>Curral e manejo no celular</h2><p>Operações grandes, rápidas e locais para uso com sol, luva e sinal ruim.</p></div><div className={`field-online-pill ${syncState?.paired?'paired':''}`}>{syncState?.paired?`${syncState.pending??0} na fila`:'Não pareado'}</div></div><div className="field-mobile-grid"><FieldTaskQueue tasks={tasks} onQuick={quick} busy={busy}/><WeightKeypad animals={activeAnimals} onQuick={quick} busy={busy}/><QuickMove animals={activeAnimals} lots={lotRows} onQuick={quick} busy={busy}/><QuickSanitary animals={activeAnimals} protocols={protocolRows} onQuick={quick} busy={busy}/><SecureSync syncState={syncState} onSync={onSync} busy={busy} setBusy={setBusy}/></div></section>;
}
