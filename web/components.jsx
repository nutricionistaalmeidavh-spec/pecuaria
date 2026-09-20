import React,{useEffect,useMemo,useState} from 'react';
import {Icon} from './icons.jsx';

export function StatusBanner({tone='info',children}){return <div className={`status ${tone}`} role={tone==='error'?'alert':'status'}>{children}</div>}

export function DesktopShell({brand,navigation,title,children,onLogout,notificationCount=0,onSearch=null,onNotifications=null}){
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  useEffect(()=>{
    const onKeyDown=event=>{if(event.key==='Escape')setMobileNavOpen(false)};
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[]);
  return <div className="shell">
    <button className={`sidebar-scrim ${mobileNavOpen?'show':''}`} type="button" aria-label="Fechar menu" onClick={()=>setMobileNavOpen(false)}/>
    <aside className="sidebar" data-testid="sidebar" data-open={String(mobileNavOpen)}>
      <div className="brand">{brand}</div>
      <nav aria-label="Navegação principal" onClick={()=>setMobileNavOpen(false)}>{navigation}</nav>
      <div className="sidebar-foot"><Icon name="beef" size={18}/><span>Gestão local-first</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <button data-testid="mobile-nav-toggle" className="mobile-nav-toggle" type="button" aria-label="Abrir menu" aria-expanded={mobileNavOpen} onClick={()=>setMobileNavOpen(open=>!open)}><Icon name="menu" size={21}/></button>
        <div className="topbar-title"><small>ArtiSys Pecuária</small><h1>{title}</h1></div>
        <form className="global-search" onSubmit={e=>{e.preventDefault();const term=new FormData(e.currentTarget).get("term");if(term&&onSearch)onSearch(String(term))}}><Icon name="search" size={18}/><input name="term" aria-label="Busca global" placeholder="Buscar animal, lote ou informação..."/></form>
        <div className="topbar-actions">
          <button className="notification-button" type="button" aria-label={`${notificationCount} alertas`} onClick={onNotifications}><Icon name="bell" size={19}/>{notificationCount>0&&<span>{notificationCount>99?'99+':notificationCount}</span>}</button>
          <div className="user-chip"><span className="avatar">AD</span><span><strong>Administrador</strong><small>Operação local</small></span></div>
          <button className="ghost logout-button" onClick={onLogout}>Sair</button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>;
}

const domainLabels={id:'ID',name:'Nome',tag:'Brinco',lotId:'Lote',farmUnitId:'Fazenda / unidade',purpose:'Finalidade',status:'Status',sex:'Sexo',weightKg:'Peso (kg)',measuredAt:'Pesagem em',animalId:'Animal',relatedAnimalId:'Animal relacionado',kind:'Tipo',type:'Evento',occurredAt:'Data',performedAt:'Realizado em',nextDueAt:'Próxima data',withdrawalUntil:'Fim da carência',protocolId:'Protocolo',productItemId:'Produto / insumo',productBatch:'Lote/partida',activeIngredient:'Princípio ativo',dose:'Dose',unit:'Unidade',partyId:'Cliente / fornecedor',animalIds:'Animais',totalAmountMinor:'Valor líquido',amountMinor:'Valor',grossMinor:'Valor bruto',netMinor:'Valor líquido',liveArrobas:'@ peso vivo',carcassArrobas:'@ carcaça',carcassYieldPct:'Rendimento carcaça (%)',description:'Descrição',category:'Categoria',profileId:'Integração',stationId:'Estação / curral',farmId:'Fazenda',enabled:'Ativo',roles:'Papéis',document:'CPF/CNPJ',phone:'Telefone',email:'E-mail'};
const humanize=key=>domainLabels[key]??String(key).replace(/([A-Z])/g,' $1').replace(/[-_]/g,' ').replace(/^./,letter=>letter.toUpperCase());

export function DataTable({records=[]}){
  const rows=records.map(v=>{
    const row=v?.payload??v;
    const settlement=row?.metadata?.settlement;
    if(!settlement)return row;
    return {
      id:row.id,
      type:row.type,
      partyId:row.partyId,
      carcassArrobas:settlement.carcassArrobas,
      carcassYieldPct:settlement.carcassYieldPct,
      grossMinor:settlement.grossMinor,
      netMinor:settlement.netMinor,
      totalAmountMinor:row.totalAmountMinor,
      ...row
    };
  });
  const columns=useMemo(()=>[...new Set(rows.flatMap(r=>Object.keys(r??{})))].filter(k=>!['metadata','passwordHash','passwordSalt','tokenHash'].includes(k)).slice(0,8),[records]);
  if(!rows.length)return <div className="empty"><strong>Nenhum registro</strong><span>Os dados aparecerão aqui quando forem cadastrados.</span></div>;
  const render=(v,key)=>{
    if(v==null)return '—';
    if(['amountMinor','totalAmountMinor','grossMinor','netMinor','costMinor'].includes(key)&&Number.isFinite(Number(v)))return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)/100);
    if(typeof v==='boolean')return v?'Sim':'Não';
    if(Array.isArray(v))return v.join(', ');
    if(typeof v==='object')return JSON.stringify(v);
    if(key==='carcassYieldPct'&&Number.isFinite(Number(v)))return `${Number(v).toFixed(2)}%`;
    return String(v);
  };
  return <div className="table-wrap" data-testid="data-table"><table className="responsive-table"><thead><tr>{columns.map(c=><th key={c}>{humanize(c)}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.id??i}>{columns.map(c=><td key={c} data-label={humanize(c)}>{render(row[c],c)}</td>)}</tr>)}</tbody></table></div>;
}

const workspaceDescriptions={
  lots:'Organize grupos de manejo e acompanhe a distribuição do rebanho.',
  animals:'Consulte identificação, lote, finalidade e ciclo de vida dos animais.',
  weights:'Registre pesagens e preserve o histórico individual de desempenho.',
  sanitary:'Centralize protocolos, aplicações, estoque, custos e períodos de carência sanitária.',
  reproduction:'Acompanhe cobertura, diagnóstico, perdas, parto, desmame e indicadores reprodutivos.',
  trades:'Registre compras e vendas com fechamento por peso vivo, rendimento e arroba de carcaça.',
  finance:'Acompanhe custos e receitas relacionados à operação pecuária.',
  reports:'Emita relatórios zootécnicos e documentos operacionais.',
  data:'Gerencie fazendas, raças, categorias, contatos e faça exportação, validação e importação segura de dados.',
  iot:'Configure integrações locais com RFID, balanças e dispositivos compatíveis.',
  settings:'Administre backup, restauração e preferências locais do sistema.'
};

export function WorkspaceScreen({screenId,screen,icon,records,onAction,allowedActions=null,secondaryRecords=null,secondaryTitle=null}){
  return <section className="workspace-screen panel" data-testid="workspace-screen">
    <div className="workspace-screen-heading">
      <div className="workspace-screen-intro">
        <span className="workspace-screen-icon" data-testid="workspace-screen-icon"><Icon name={icon} size={21}/></span>
        <div><span className="eyebrow">Operação</span><h2>{screen?.title}</h2><p>{workspaceDescriptions[screenId]??'Gerencie os registros desta área.'}</p></div>
      </div>
      <div className="actions">{Object.entries(screen?.actionDefinitions??{}).filter(([name])=>!allowedActions||allowedActions.includes(name)).map(([name,definition])=><button key={name} data-testid={`action-${screenId}-${name}`} onClick={()=>onAction(name)}>{definition.label??name}</button>)}</div>
    </div>
    <DataTable records={records}/>{secondaryRecords&&<section data-testid={`secondary-${screenId}`}><div className="workspace-screen-heading"><div><span className="eyebrow">Histórico</span><h3>{secondaryTitle}</h3></div></div><DataTable records={secondaryRecords}/></section>}
  </section>;
}

export function ActionDialog({open,definition,onClose,onSubmit,busy=false,references={}}){
  const [values,setValues]=useState({});
  useEffect(()=>{if(open)setValues({...definition?.defaults})},[open,definition]);
  if(!open||!definition)return null;
  const change=(name,value)=>setValues(current=>({...current,[name]:value}));
  const submit=async e=>{e.preventDefault();await onSubmit(definition.normalize(values))};
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="dialog" role="dialog" aria-modal="true" aria-label={definition.title}><header><div><small>Ação</small><h2>{definition.title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></header><form onSubmit={submit}><div className="form-grid">{definition.fields.map(f=><label key={f.name}><span>{f.label}</span>{f.acceptFile?<><input type="file" accept={f.acceptFile} onChange={async e=>{const file=e.target.files?.[0];if(file)change(f.name,await file.text())}}/><textarea data-testid={`field-${f.name}`} rows="5" value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}/></>:f.refCollection&&f.type==='list'?<select multiple data-testid={`field-${f.name}`} value={Array.isArray(values[f.name])?values[f.name]:[]} onChange={e=>change(f.name,[...e.target.selectedOptions].map(o=>o.value))}>{(references[f.refCollection]??[]).map(item=><option value={item.id} key={item.id}>{item.tag??item.name??item.officialId??item.id}</option>)}</select>:f.refCollection?<select data-testid={`field-${f.name}`} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}><option value="">Selecione</option>{(references[f.refCollection]??[]).map(item=><option value={item.id} key={item.id}>{item.tag??item.name??item.officialId??item.id}</option>)}</select>:f.type==='select'?<select data-testid={`field-${f.name}`} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}><option value="">Selecione</option>{(f.options??[]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>:f.type==='textarea'||f.type==='list'?<textarea data-testid={`field-${f.name}`} rows={f.type==='list'?3:5} placeholder={f.placeholder} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}/>:<input data-testid={`field-${f.name}`} type={f.type} step={f.step} placeholder={f.placeholder} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}/>}</label>)}</div><footer><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button data-testid="action-submit" className="primary" disabled={busy}>{busy?'Executando…':'Confirmar'}</button></footer></form></section></div>;
}

export function AnimalDetail({detail,onClose}){if(!detail?.animal)return null;const a=detail.animal;const facts=[['Brinco',a.tag],['Identificação oficial',a.officialId],['RFID',a.rfid],['Lote',a.lotId],['Fazenda',a.farmUnitId],['Raça',a.breedId],['Categoria',a.categoryId],['Nascimento',a.birthDate],['Mãe',a.damId],['Pai',a.sireId],['Peso atual',a.latestWeightKg==null?null:`${a.latestWeightKg} kg`],['GMD',a.dailyGainKg==null?null:`${Number(a.dailyGainKg).toFixed(3)} kg/dia`]];return <section className="panel animal-detail" data-testid="animal-360"><div className="panel-heading"><div><span className="eyebrow">Ficha 360º</span><h2>{a.name||a.tag}</h2><p>Histórico consolidado do animal.</p></div><button className="ghost" onClick={onClose}>Fechar</button></div><div className="animal-facts">{facts.map(([k,v])=><div key={k}><span>{k}</span><strong>{v||'—'}</strong></div>)}</div><h3>Linha do tempo</h3><div className="activity-list">{(detail.timeline??[]).map((x,i)=><div className="activity-row" key={i}><span className="activity-copy"><strong>{x.title}</strong><small>{x.detail||'Registro'}</small></span><time>{x.occurredAt?new Date(x.occurredAt).toLocaleDateString('pt-BR'):'—'}</time></div>)}</div></section>}

export function CorralFlow({animals=[],onRecord}){const [animalId,setAnimalId]=useState('');const [weight,setWeight]=useState('');const animal=animals.map(x=>x.payload??x).find(x=>x.id===animalId);const previous=animal?.weights?.at(-1)?.weightKg??null;return <section className="panel" data-testid="corral-flow"><div className="panel-heading"><div><span className="eyebrow">Curral</span><h2>Pesagem rápida</h2><p>Identifique, confira o histórico e registre o próximo peso.</p></div></div><div className="form-grid"><label><span>Animal</span><select value={animalId} onChange={e=>setAnimalId(e.target.value)}><option value="">Selecione</option>{animals.map(r=>{const a=r.payload??r;return <option key={a.id} value={a.id}>{a.tag??a.name??a.id}</option>})}</select></label><label><span>Novo peso (kg)</span><input type="number" step="0.1" value={weight} onChange={e=>setWeight(e.target.value)}/></label></div>{animal&&<div className="mini-metrics"><div><span>Peso anterior</span><strong>{previous??'—'} kg</strong></div><div><span>GMD atual</span><strong>{animal.dailyGainKg==null?'—':`${Number(animal.dailyGainKg).toFixed(3)} kg/dia`}</strong></div><div><span>Diferença</span><strong>{previous!=null&&weight?`${(Number(weight)-previous).toFixed(1)} kg`:'—'}</strong></div></div>}<div className="actions"><button className="primary" disabled={!animalId||!Number(weight)} onClick={()=>onRecord({id:animalId,weightKg:Number(weight),measuredAt:new Date().toISOString()}).then(()=>{setWeight('');setAnimalId('')})}>Registrar e próximo</button></div></section>}

export function FinanceMetrics({metrics}){if(!metrics)return null;const money=v=>v==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)/100);return <section className="panel" data-testid="finance-metrics"><div className="panel-heading"><div><span className="eyebrow">Economia produtiva</span><h2>Indicadores do lote</h2></div></div><div className="stat-grid"><article><span>Custo/cabeça</span><strong>{money(metrics.costPerHeadMinor)}</strong></article><article><span>Custo/kg ganho</span><strong>{money(metrics.costPerKgGainMinor)}</strong></article><article><span>Custo/@ peso vivo</span><strong>{money(metrics.costPerLiveArrobaMinor??metrics.costPerArrobaMinor)}</strong></article><article><span>Margem</span><strong>{money(metrics.marginMinor)}</strong></article></div></section>}

const percent=value=>value==null?'—':`${Number(value).toFixed(1)}%`;
export function ReproductionSummary({records=[],metrics=null}){const rows=records.map(r=>r.payload??r);const upcoming=rows.filter(r=>r.metadata?.expectedCalvingAt);return <section className="panel" data-testid="reproduction-summary"><div className="panel-heading"><div><span className="eyebrow">Gestão reprodutiva</span><h2>Indicadores e previsões</h2><p>{upcoming.length} parto(s) com previsão registrada.</p></div></div>{metrics&&<div className="stat-grid" data-testid="reproduction-metrics"><article><span>Taxa de serviço</span><strong>{percent(metrics.serviceRatePct)}</strong></article><article><span>Taxa de concepção</span><strong>{percent(metrics.conceptionRatePct)}</strong></article><article><span>Taxa de prenhez</span><strong>{percent(metrics.pregnancyRatePct)}</strong></article><article><span>Perda gestacional</span><strong>{percent(metrics.pregnancyLossRatePct)}</strong></article><article><span>Taxa de parto</span><strong>{percent(metrics.calvingRatePct)}</strong></article><article><span>Taxa de desmame</span><strong>{percent(metrics.weaningRatePct)}</strong></article></div>}<DataTable records={upcoming.map(r=>({animalId:r.animalId,type:r.type,expectedCalvingAt:r.metadata.expectedCalvingAt,result:r.metadata.result??''}))}/></section>}
