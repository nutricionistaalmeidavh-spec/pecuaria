import React,{useEffect,useMemo,useState} from 'react';
import {Icon} from './icons.jsx';

export function StatusBanner({tone='info',children}){return <div className={`status ${tone}`} role={tone==='error'?'alert':'status'}>{children}</div>}

export function DesktopShell({brand,navigation,title,children,onLogout,notificationCount=0}){
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">{brand}</div>
      <nav aria-label="Navegação principal">{navigation}</nav>
      <div className="sidebar-foot"><Icon name="beef" size={18}/><span>Gestão local-first</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="topbar-title"><small>ArtiSys Pecuária</small><h1>{title}</h1></div>
        <label className="global-search"><Icon name="search" size={18}/><input aria-label="Busca global" placeholder="Buscar animal, lote ou informação..."/></label>
        <div className="topbar-actions">
          <button className="notification-button" type="button" aria-label={`${notificationCount} alertas`}><Icon name="bell" size={19}/>{notificationCount>0&&<span>{notificationCount>99?'99+':notificationCount}</span>}</button>
          <div className="user-chip"><span className="avatar">AD</span><span><strong>Administrador</strong><small>Operação local</small></span></div>
          <button className="ghost logout-button" onClick={onLogout}>Sair</button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>;
}

export function DataTable({records=[]}){
  const rows=records.map(v=>v?.payload??v);
  const columns=useMemo(()=>[...new Set(rows.flatMap(r=>Object.keys(r??{})))].filter(k=>!['metadata','passwordHash','passwordSalt','tokenHash'].includes(k)).slice(0,8),[records]);
  if(!rows.length)return <div className="empty"><strong>Nenhum registro</strong><span>Os dados aparecerão aqui quando forem cadastrados.</span></div>;
  const render=v=>v==null?'—':Array.isArray(v)?v.join(', '):typeof v==='object'?JSON.stringify(v):String(v);
  return <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.id??i}>{columns.map(c=><td key={c}>{render(row[c])}</td>)}</tr>)}</tbody></table></div>;
}

export function ActionDialog({open,definition,onClose,onSubmit,busy=false}){
  const [values,setValues]=useState({});
  useEffect(()=>{if(open)setValues({...definition?.defaults})},[open,definition]);
  if(!open||!definition)return null;
  const change=(name,value)=>setValues(current=>({...current,[name]:value}));
  const submit=async e=>{e.preventDefault();await onSubmit(definition.normalize(values))};
  return <div className="dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="dialog" role="dialog" aria-modal="true" aria-label={definition.title}><header><div><small>Ação</small><h2>{definition.title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar">×</button></header><form onSubmit={submit}><div className="form-grid">{definition.fields.map(f=><label key={f.name}><span>{f.label}</span>{f.type==='select'?<select data-testid={`field-${f.name}`} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}><option value="">Selecione</option>{(f.options??[]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>:f.type==='textarea'||f.type==='list'?<textarea data-testid={`field-${f.name}`} rows={f.type==='list'?3:5} placeholder={f.placeholder} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}/>:<input data-testid={`field-${f.name}`} type={f.type} step={f.step} placeholder={f.placeholder} value={values[f.name]??''} onChange={e=>change(f.name,e.target.value)}/>}</label>)}</div><footer><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button data-testid="action-submit" className="primary" disabled={busy}>{busy?'Executando…':'Confirmar'}</button></footer></form></section></div>;
}
