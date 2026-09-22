import React,{useEffect,useMemo,useState} from 'react';
import {DataTable,StatusBanner} from './components.jsx';

const unwrap=records=>(records??[]).map(record=>record?.payload??record).filter(Boolean);
const finite=value=>Number.isFinite(Number(value));
const number=(value,digits=1)=>value==null||!finite(value)?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits}).format(Number(value));
const money=value=>value==null||!finite(value)?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
const date=value=>{if(!value)return '—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString('pt-BR')};
const daysUntil=value=>value?Math.ceil((Date.parse(value)-Date.now())/86400000):null;
const can=(allowed,name)=>allowed.includes(name);
const today=()=>new Date().toISOString().slice(0,10);

const reportTypes=[
  ['lot-kpis','Indicadores do lote','Peso médio, GMD e resultado econômico do lote.'],
  ['animal-history','Histórico do animal','Ficha individual consolidada com eventos e pesagens.'],
  ['performance','Desempenho','Peso atual, ganho diário e projeção produtiva.'],
  ['sanitary','Sanidade','Aplicações, próximas doses e períodos de carência.'],
  ['reproduction','Reprodução','Serviços, diagnósticos, partos e desempenho reprodutivo.'],
  ['inventory','Estoque','Saldo, mínimo, lotes, validade e custos de insumos.'],
  ['nutrition','Nutrição','Consumo planejado e custo alimentar por lote.'],
  ['traceability','Rastreabilidade','Identificação oficial e documentos locais.'],
  ['pasture','Pastagens','Capacidade, ocupação e indicadores das áreas.'],
  ['commercial','Comercial','Compras, vendas, pesos, arrobas e valores.'],
  ['finance','Financeiro','Receitas, despesas e alocação por lote.'],
  ['tasks','Agenda','Manejos planejados e situação das tarefas.']
];
const reportKey='artisys-pecuaria:p1-report-builder';
const historyKey='artisys-pecuaria:p1-report-history';
const readLocal=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)??'null')??fallback}catch{return fallback}};

export function P1ReportBuilder({lots=[],animals=[],onGenerate}){
  const saved=useMemo(()=>readLocal(reportKey,{}),[]);
  const [type,setType]=useState(saved.type??'lot-kpis');
  const [format,setFormat]=useState(saved.format??'pdf');
  const [lotId,setLotId]=useState(saved.lotId??'');
  const [animalId,setAnimalId]=useState(saved.animalId??'');
  const [busy,setBusy]=useState(false);
  const [history,setHistory]=useState(()=>readLocal(historyKey,[]));
  const selected=reportTypes.find(item=>item[0]===type)??reportTypes[0];
  const filename=`artisys-${type}-${today()}.${format}`;
  useEffect(()=>{localStorage.setItem(reportKey,JSON.stringify({type,format,lotId,animalId}))},[type,format,lotId,animalId]);
  const generate=async()=>{
    setBusy(true);
    try{
      const result=await onGenerate({format,type,lotId:lotId||undefined,animalId:animalId||undefined});
      const entry={id:`${Date.now()}`,createdAt:new Date().toISOString(),type,label:selected[1],format,lotId:lotId||null,animalId:animalId||null,filename,rowCount:result?.rowCount??result?.rows?.length??null};
      const next=[entry,...history].slice(0,12);setHistory(next);localStorage.setItem(historyKey,JSON.stringify(next));
      return result;
    }finally{setBusy(false)}
  };
  return <section className="panel p1-workspace" data-testid="p1-report-builder">
    <div className="panel-heading"><div><span className="eyebrow">Relatórios P1</span><h2>Construtor de relatórios</h2><p>Escolha o objetivo, aplique os filtros e gere o arquivo sem navegar entre fluxos diferentes.</p></div></div>
    <div className="p1-report-types">{reportTypes.map(([id,label,description])=><button key={id} type="button" className={id===type?'active':''} aria-pressed={id===type} onClick={()=>setType(id)}><strong>{label}</strong><small>{description}</small></button>)}</div>
    <div className="p1-filter-grid">
      <label><span>Formato</span><select value={format} onChange={event=>setFormat(event.target.value)}><option value="pdf">PDF</option><option value="csv">CSV</option></select></label>
      <label><span>Lote</span><select value={lotId} onChange={event=>setLotId(event.target.value)}><option value="">Todos / não aplicável</option>{lots.map(lot=><option key={lot.id} value={lot.id}>{lot.name??lot.id}</option>)}</select></label>
      <label><span>Animal</span><select value={animalId} onChange={event=>setAnimalId(event.target.value)}><option value="">Todos / não aplicável</option>{animals.map(animal=><option key={animal.id} value={animal.id}>{animal.tag??animal.name??animal.id}</option>)}</select></label>
    </div>
    <div className="p1-preview" data-testid="report-preview"><div><span>Relatório</span><strong>{selected[1]}</strong></div><div><span>Arquivo previsto</span><strong>{filename}</strong></div><div><span>Escopo</span><strong>{lotId?'Lote selecionado':'Escopo geral'}{animalId?' · animal selecionado':''}</strong></div><button className="primary" type="button" disabled={busy} onClick={()=>void generate()}>{busy?'Gerando…':`Gerar ${format.toUpperCase()}`}</button></div>
    <section className="p1-history" data-testid="report-history"><div className="p1-section-title"><div><span className="eyebrow">Histórico local</span><h3>Últimas gerações</h3></div><button className="ghost" type="button" disabled={!history.length} onClick={()=>{setHistory([]);localStorage.removeItem(historyKey)}}>Limpar histórico</button></div>{history.length?<DataTable records={history} screenId="reports"/>:<div className="p1-empty-inline">O histórico aparecerá aqui após a primeira geração nesta instalação.</div>}</section>
  </section>;
}

const traceStatus=row=>{
  if(!row)return'missing';
  const remaining=daysUntil(row.expiresAt);
  if(remaining!=null&&remaining<0)return'expired';
  if(remaining!=null&&remaining<=30)return'expiring';
  if(!(row.documentNumber||row.officialId))return'missing';
  return'complete';
};
const traceLabels={all:'Todos',missing:'Incompletos',expiring:'Vencendo',expired:'Vencidos',complete:'Completos'};
export function P1TraceabilityPanel({records=[],allowedActions=[],onAction}){
  const rows=useMemo(()=>unwrap(records).map(row=>({...row,complianceStatus:traceStatus(row)})),[records]);
  const [filter,setFilter]=useState('all');
  const visible=filter==='all'?rows:rows.filter(row=>row.complianceStatus===filter);
  return <section className="panel p1-workspace" data-testid="p1-traceability">
    <div className="panel-heading"><div><span className="eyebrow">Conformidade local</span><h2>Documentos e identificação</h2><p>Priorize pendências por validade e mantenha o histórico documental ligado ao animal.</p></div><div className="actions">{can(allowedActions,'save')&&<button className="primary" type="button" onClick={()=>onAction('save')}>Novo registro</button>}</div></div>
    <StatusBanner tone="info"><strong>SISBOV/GTA:</strong> estes são registros locais de controle. O sistema não emite GTA e não transmite dados para bases oficiais.</StatusBanner>
    <div className="p1-quick-filters" data-testid="traceability-filter">{Object.entries(traceLabels).map(([id,label])=><button type="button" key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}<span>{id==='all'?rows.length:rows.filter(row=>row.complianceStatus===id).length}</span></button>)}</div>
    <DataTable records={visible} screenId="traceability" emptyState={{title:'Nenhum documento neste filtro',detail:'Cadastre identificação oficial, GTA, SISBOV ou certificados para organizar a conformidade local.'}}/>
  </section>;
}

export function P1InventoryPanel({items=[],movements=[],allowedActions=[],onAction}){
  const rows=useMemo(()=>unwrap(items),[items]);
  const moveRows=useMemo(()=>unwrap(movements),[movements]);
  const [selectedId,setSelectedId]=useState('');
  const selected=rows.find(row=>row.id===selectedId)??null;
  const low=rows.filter(row=>finite(row.minQuantity)&&finite(row.quantity)&&Number(row.quantity)<=Number(row.minQuantity));
  const expired=rows.filter(row=>daysUntil(row.expiresAt)!=null&&daysUntil(row.expiresAt)<0);
  const expiring=rows.filter(row=>{const days=daysUntil(row.expiresAt);return days!=null&&days>=0&&days<=30});
  const history=selected?moveRows.filter(row=>[row.itemId,row.productItemId,row.id].includes(selected.id)):[];
  return <section className="panel p1-workspace" data-testid="p1-inventory">
    <div className="panel-heading"><div><span className="eyebrow">Estoque operacional</span><h2>Saldo, validade e histórico</h2><p>Veja primeiro o que exige ação e depois aprofunde no insumo selecionado.</p></div><div className="actions">{can(allowedActions,'save')&&<button className="primary" type="button" onClick={()=>onAction('save')}>Novo insumo</button>}{can(allowedActions,'adjust')&&<button type="button" disabled={!selectedId} onClick={()=>onAction('adjust',{initialValues:{id:selectedId}})}>Movimentar selecionado</button>}</div></div>
    <div className="p1-alert-grid" data-testid="inventory-alerts"><article className={low.length?'attention':''}><span>Estoque baixo</span><strong>{low.length}</strong><small>no mínimo ou abaixo</small></article><article className={expiring.length?'attention':''}><span>Vencendo</span><strong>{expiring.length}</strong><small>próximos 30 dias</small></article><article className={expired.length?'danger':''}><span>Vencidos</span><strong>{expired.length}</strong><small>requerem revisão</small></article><article><span>Itens cadastrados</span><strong>{rows.length}</strong><small>controle local</small></article></div>
    {(low.length>0||expiring.length>0||expired.length>0)&&<div className="p1-warning-list">{[...expired.map(row=>`${row.name??row.id}: vencido`),...expiring.map(row=>`${row.name??row.id}: vence em ${daysUntil(row.expiresAt)} dia(s)`),...low.map(row=>`${row.name??row.id}: saldo ${number(row.quantity)} ${row.unit??''} / mínimo ${number(row.minQuantity)} ${row.unit??''}`)].slice(0,8).map(text=><span key={text}>{text}</span>)}</div>}
    <div className="p1-context-select"><label><span>Ver histórico do insumo</span><select value={selectedId} onChange={event=>setSelectedId(event.target.value)}><option value="">Selecione</option>{rows.map(row=><option key={row.id} value={row.id}>{row.name??row.id}</option>)}</select></label>{selected&&<div className="p1-inline-metrics"><div><span>Saldo</span><strong>{number(selected.quantity)} {selected.unit??''}</strong></div><div><span>Mínimo</span><strong>{number(selected.minQuantity)} {selected.unit??''}</strong></div><div><span>Validade</span><strong>{date(selected.expiresAt)}</strong></div><div><span>Custo unitário</span><strong>{money(selected.costMinor)}</strong></div></div>}</div>
    <DataTable records={rows} screenId="inventory"/>
    {selected&&<section className="p1-subsection"><div className="p1-section-title"><div><span className="eyebrow">Movimentações</span><h3>{selected.name??selected.id}</h3></div></div><DataTable records={history} screenId="inventory" emptyState={{title:'Sem movimentações',detail:'Entradas e saídas deste insumo aparecerão aqui.'}}/></section>}
  </section>;
}

export function P1NutritionPanel({plans=[],inventory=[],animals=[],lots=[],allowedActions=[],onAction}){
  const rows=useMemo(()=>unwrap(plans),[plans]);
  const itemRows=useMemo(()=>unwrap(inventory),[inventory]);
  const animalRows=useMemo(()=>unwrap(animals),[animals]);
  const [selectedId,setSelectedId]=useState('');
  const computed=useMemo(()=>rows.map(plan=>{
    const headCount=animalRows.filter(animal=>animal.status==='active'&&animal.lotId===plan.lotId).length;
    const dailyKg=finite(plan.dailyKgPerHead)?Number(plan.dailyKgPerHead)*headCount:null;
    const feed=itemRows.find(item=>item.id===plan.feedItemId);
    const stockKg=finite(feed?.quantity)?Number(feed.quantity):null;
    const autonomyDays=dailyKg>0&&stockKg!=null?stockKg/dailyKg:null;
    const dailyCostMinor=dailyKg!=null&&finite(feed?.costMinor)?dailyKg*Number(feed.costMinor):null;
    const costHeadDayMinor=headCount>0&&dailyCostMinor!=null?dailyCostMinor/headCount:null;
    const lot=lots.find(item=>item.id===plan.lotId);
    return{...plan,lotName:lot?.name??plan.lotId,headCount,dailyKg,stockKg,autonomyDays,dailyCostMinor,costHeadDayMinor,belowMinimum:feed&&finite(feed.minQuantity)&&stockKg!=null&&stockKg<=Number(feed.minQuantity)};
  }),[rows,itemRows,animalRows,lots]);
  const selected=computed.find(plan=>plan.id===selectedId)??computed[0]??null;
  const preview=selected?{needed:selected.dailyKg,remaining:selected.stockKg!=null&&selected.dailyKg!=null?selected.stockKg-selected.dailyKg:null}:null;
  return <section className="panel p1-workspace" data-testid="p1-nutrition">
    <div className="panel-heading"><div><span className="eyebrow">Nutrição operacional</span><h2>Plano, estoque e autonomia</h2><p>Relacione o consumo planejado ao rebanho e ao saldo real do alimento.</p></div><div className="actions">{can(allowedActions,'save')&&<button className="primary" type="button" onClick={()=>onAction('save')}>Novo plano</button>}{can(allowedActions,'consume')&&<button type="button" disabled={!selected} onClick={()=>onAction('consume',{initialValues:{planId:selected?.id}})}>Registrar consumo</button>}</div></div>
    <div className="p1-context-select"><label><span>Plano analisado</span><select value={selected?.id??''} onChange={event=>setSelectedId(event.target.value)}>{computed.length===0&&<option value="">Sem planos</option>}{computed.map(plan=><option key={plan.id} value={plan.id}>{plan.name??plan.id}</option>)}</select></label></div>
    <div className="p1-alert-grid" data-testid="nutrition-autonomy"><article><span>Cabeças no lote</span><strong>{selected?.headCount??'—'}</strong><small>{selected?.lotName??'Selecione um plano'}</small></article><article><span>Consumo/dia</span><strong>{selected?.dailyKg==null?'—':`${number(selected.dailyKg)} kg`}</strong><small>{selected?.dailyKgPerHead==null?'—':`${number(selected.dailyKgPerHead,2)} kg/cab/dia`}</small></article><article className={selected?.autonomyDays!=null&&selected.autonomyDays<7?'attention':''}><span>Autonomia</span><strong>{selected?.autonomyDays==null?'—':`${number(selected.autonomyDays)} dias`}</strong><small>com o saldo atual</small></article><article><span>Custo/cab/dia</span><strong>{money(selected?.costHeadDayMinor)}</strong><small>Custo diário total {money(selected?.dailyCostMinor)}</small></article></div>
    {selected?.belowMinimum&&<StatusBanner tone="error">O alimento deste plano está no estoque mínimo ou abaixo.</StatusBanner>}
    {preview&&<div className="p1-preview"><div><span>Prévia de 1 dia</span><strong>{preview.needed==null?'—':`${number(preview.needed)} kg de baixa`}</strong></div><div><span>Saldo projetado</span><strong>{preview.remaining==null?'—':`${number(preview.remaining)} kg`}</strong></div>{preview.remaining!=null&&preview.remaining<0&&<strong className="p1-danger-text">Estoque insuficiente para um dia do plano.</strong>}</div>}
    <DataTable records={computed} screenId="nutrition"/>
  </section>;
}

const dataCollections=[['farms','Fazendas'],['breeds','Raças'],['categories','Categorias'],['parties','Contatos']];
export function P1DataTransferPanel({references={},allowedActions=[],onAction}){
  const [step,setStep]=useState(1);
  return <section className="panel p1-workspace" data-testid="p1-data-transfer">
    <div className="panel-heading"><div><span className="eyebrow">Dados locais</span><h2>Cadastros e portabilidade</h2><p>Separe dados mestres da transferência entre instalações para reduzir risco operacional.</p></div></div>
    <div className="p1-alert-grid">{dataCollections.map(([key,label])=><article key={key}><span>{label}</span><strong>{references[key]?.length??0}</strong><small>cadastros disponíveis</small></article>)}</div>
    <div className="p1-data-actions"><section><h3>Cadastros mestres</h3><p>Fazendas, raças, categorias e contatos usados nas demais rotinas.</p><div className="actions">{can(allowedActions,'saveFarmUnit')&&<button type="button" onClick={()=>onAction('saveFarmUnit')}>Nova fazenda</button>}{can(allowedActions,'saveBreed')&&<button type="button" onClick={()=>onAction('saveBreed')}>Nova raça</button>}{can(allowedActions,'saveCategory')&&<button type="button" onClick={()=>onAction('saveCategory')}>Nova categoria</button>}{can(allowedActions,'saveParty')&&<button type="button" onClick={()=>onAction('saveParty')}>Novo contato</button>}</div></section><section><h3>Exportação local</h3><p>Exporte uma coleção em JSON para backup lógico, migração ou conferência independente.</p>{can(allowedActions,'exportCollection')&&<button className="primary" type="button" onClick={()=>onAction('exportCollection')}>Exportar coleção</button>}</section></div>
    <section className="p1-import-wizard" data-testid="import-wizard"><div className="p1-section-title"><div><span className="eyebrow">Importação guiada</span><h3>Validar antes de gravar</h3></div></div><div className="p1-steps">{[['1','Selecionar arquivo'],['2','Validar estrutura'],['3','Revisar prévia'],['4','Confirmar importação']].map(([id,label])=><button type="button" key={id} className={step===Number(id)?'active':''} onClick={()=>setStep(Number(id))}><span>{id}</span>{label}</button>)}</div><div className="p1-wizard-body"><p>{step===1?'Escolha um arquivo JSON exportado pelo ArtiSys Pecuária. Nenhum dado é enviado para a internet.':step===2?'Use a validação para conferir formato, coleção e conflitos antes de persistir qualquer registro.':step===3?'A prévia de validação mostra o que foi reconhecido. Revise antes da confirmação final.':'A importação grava localmente apenas após sua confirmação explícita.'}</p><div className="actions">{can(allowedActions,'validateImport')&&<button type="button" onClick={()=>{setStep(2);onAction('validateImport')}}>Selecionar e validar</button>}{can(allowedActions,'importCollection')&&<button className="primary" type="button" onClick={()=>{setStep(4);onAction('importCollection')}}>Importar JSON validado</button>}</div></div></section>
    <StatusBanner tone="info">Portabilidade local: os dados operacionais permanecem no banco desta instalação; exportações permitem cópia e migração sem serviço de nuvem obrigatório.</StatusBanner>
  </section>;
}

const statusFor=(data,device)=>{
  const statusCollection=data?.statuses??data?.status??{};
  if(Array.isArray(statusCollection))return statusCollection.find(item=>item.id===device.id||item.deviceId===device.id)?.status??'desconhecido';
  if(statusCollection&&typeof statusCollection==='object')return statusCollection[device.id]?.status??statusCollection[device.id]??device.status??'desconhecido';
  return device.status??'desconhecido';
};
export function P1IoTDevicesPanel({data={},allowedActions=[],onAction}){
  const devices=unwrap(data?.devices??data?.rows??[]);
  const [selectedId,setSelectedId]=useState('');
  const selected=devices.find(device=>device.id===selectedId)??devices[0]??null;
  const contextual=(name,label)=>can(allowedActions,name)&&<button type="button" disabled={!selected} onClick={()=>onAction(name,{initialValues:{id:selected?.id}})}>{label}</button>;
  return <section className="panel p1-workspace" data-testid="p1-iot-devices">
    <div className="panel-heading"><div><span className="eyebrow">Dispositivos locais</span><h2>Status e diagnóstico</h2><p>Administre leitores RFID, balanças e conectores sem tornar o hardware obrigatório para usar o sistema.</p></div><div className="actions">{can(allowedActions,'saveDevice')&&<button className="primary" type="button" onClick={()=>onAction('saveDevice')}>Adicionar dispositivo</button>}</div></div>
    <div className="p1-device-grid">{devices.length?devices.map(device=>{const status=statusFor(data,device);return <button key={device.id} type="button" className={selected?.id===device.id?'selected':''} onClick={()=>setSelectedId(device.id)}><span className={`status-chip status-chip-${String(status).toLowerCase()}`} data-testid="iot-device-status">{status}</span><strong>{device.name??device.id}</strong><small>{device.profileId??device.transport??'Perfil local'} · {device.stationId??'Sem estação'}</small></button>}):<div className="p1-empty-inline">Nenhum dispositivo configurado. O sistema continua funcionando normalmente sem hardware.</div>}</div>
    {selected&&<div className="p1-device-command"><div><span>Selecionado</span><strong>{selected.name??selected.id}</strong><small>{selected.id}</small></div><div className="actions">{contextual('testDevice','Testar')}{contextual('startDevice','Iniciar')}{contextual('stopDevice','Parar')}{contextual('removeDevice','Remover')}</div></div>}
    <div className="p1-data-actions"><section><h3>Leitor RFID</h3><p>Serial/USB, MQTT ou HTTP local para identificação no curral e manejo.</p></section><section><h3>Balança</h3><p>Serial/USB, MQTT ou HTTP local; a pesagem manual continua disponível.</p></section><section><h3>Conector local</h3><p>Parâmetros técnicos de porta, tópico, URL e credenciais ficam no cadastro avançado do dispositivo.</p></section></div>
    <StatusBanner tone="info"><strong>Simulador:</strong> perfis de simulador são ambiente de teste e não representam hardware conectado.</StatusBanner>
    <div className="actions">{can(allowedActions,'simulateRfid')&&<button type="button" onClick={()=>onAction('simulateRfid')}>Simular RFID</button>}{can(allowedActions,'simulateWeight')&&<button type="button" onClick={()=>onAction('simulateWeight')}>Simular balança</button>}{can(allowedActions,'bindRfid')&&<button type="button" onClick={()=>onAction('bindRfid')}>Vincular RFID</button>}</div>
  </section>;
}
