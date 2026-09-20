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

const domainLabels={id:'ID',name:'Nome',tag:'Brinco',lotId:'Lote',farmUnitId:'Fazenda / unidade',purpose:'Finalidade',status:'Status',sex:'Sexo',weightKg:'Peso (kg)',measuredAt:'Pesagem em',animalId:'Animal',relatedAnimalId:'Animal relacionado',kind:'Tipo',type:'Evento',occurredAt:'Data',performedAt:'Realizado em',nextDueAt:'Próxima data',protocolId:'Protocolo',productItemId:'Produto / insumo',dose:'Dose',unit:'Unidade',partyId:'Cliente / fornecedor',animalIds:'Animais',totalAmountMinor:'Valor total',amountMinor:'Valor',description:'Descrição',category:'Categoria',profileId:'Integração',stationId:'Estação / curral',farmId:'Fazenda',enabled:'Ativo'};
const humanize=key=>domainLabels[key]??String(key).replace(/([A-Z])/g,' $1').replace(/[-_]/g,' ').replace(/^./,letter=>letter.toUpperCase());

export function DataTable({records=[]}){
  const rows=records.map(v=>v?.payload??v);
  const columns=useMemo(()=>[...new Set(rows.flatMap(r=>Object.keys(r??{})))].filter(k=>!['metadata','passwordHash','passwordSalt','tokenHash'].includes(k)).slice(0,8),[records]);
  if(!rows.length)return <div className="empty"><strong>Nenhum registro</strong><span>Os dados aparecerão aqui quando forem cadastrados.</span></div>;
  const render=(v,key)=>{
    if(v==null)return '—';
    if((key==='amountMinor'||key==='totalAmountMinor')&&Number.isFinite(Number(v)))return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)/100);
    if(typeof v==='boolean')return v?'Sim':'Não';
    if(Array.isArray(v))return v.join(', ');
    if(typeof v==='object')return JSON.stringify(v);
    return String(v);
  };
  return <div className="table-wrap" data-testid="data-table"><table className="responsive-table"><thead><tr>{columns.map(c=><th key={c}>{humanize(c)}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.id??i}>{columns.map(c=><td key={c} data-label={humanize(c)}>{render(row[c],c)}</td>)}</tr>)}</tbody></table></div>;
}

const workspaceDescriptions={
  lots:'Organize grupos de manejo e acompanhe a distribuição do rebanho.',
  animals:'Consulte identificação, lote, finalidade e ciclo de vida dos animais.',
  weights:'Registre pesagens e preserve o histórico individual de desempenho.',
  sanitary:'Centralize protocolos, aplicações e próximos manejos sanitários.',
  reproduction:'Acompanhe cobertura, diagnóstico, parto e desmame.',
  trades:'Registre compras e vendas vinculadas ao rebanho.',
  finance:'Acompanhe custos e receitas relacionados à operação pecuária.',
  reports:'Emita relatórios zootécnicos e documentos operacionais.',
  data:'Gerencie raças e categorias e faça exportação, validação e importação segura de dados.',
  iot:'Configure integrações locais com RFID, balanças e dispositivos compatíveis.',
  settings:'Administre backup, restauração e preferências locais do sistema.'
};

export function WorkspaceScreen({screenId,screen,icon,records,onAction}){
  return <section className="workspace-screen panel" data-testid="workspace-screen">
    <div className="workspace-screen-heading">
      <div className="workspace-screen-intro">
        <span className="workspace-screen-icon" data-testid="workspace-screen-icon"><Icon name={icon} size={21}/></span>
        <div><span className="eyebrow">Operação</span><h2>{screen?.title}</h2><p>{workspaceDescriptions[screenId]??'Gerencie os registros desta área.'}</p></div>
      </div>
      <div className="actions">{Object.entries(screen?.actionDefinitions??{}).map(([name,definition])=><button key={name} data-testid={`action-${screenId}-${name}`} onClick={()=>onAction(name)}>{definition.label??name}</button>)}</div>
    </div>
    <DataTable records={records}/>
  </section>;
}

export function ActionDialog({open,definition,onClose,onSubmit,busy=false,references={}}){
  const [values,setValues]=useState({});
  useEffect(()=>{if(open)setValues({...definition?.defaults})},[open,definition]);
  if(!open||!definition)return null;
  const change=(name,value)=>setValues(current=>({...current,[name]:value}));
  const submit=async e=>{e.preventDefault();await onSubmit(definition.normalize(values))};
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="dialog" role="dialog" aria-modal="true" aria-label={definition.title}><header><div><small>Ação</small><h2>{definition.title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></header><form onSubmit={submit}><div className="form-grid">{definition.fields.map(f=><label key={f.name}><span>{f.label}</span>{f.refCollection?<select data-testid={`field-${f.name}`} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}><option value="">Selecione</option>{(references[f.refCollection]??[]).map(item=><option value={item.id} key={item.id}>{item.tag??item.name??item.officialId??item.id}</option>)}</select>:f.type==='select'?<select data-testid={`field-${f.name}`} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}><option value="">Selecione</option>{(f.options??[]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>:f.type==='textarea'||f.type==='list'?<textarea data-testid={`field-${f.name}`} rows={f.type==='list'?3:5} placeholder={f.placeholder} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}/>:<input data-testid={`field-${f.name}`} type={f.type} step={f.step} placeholder={f.placeholder} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}/>}</label>)}</div><footer><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button data-testid="action-submit" className="primary" disabled={busy}>{busy?'Executando…':'Confirmar'}</button></footer></form></section></div>;
}
