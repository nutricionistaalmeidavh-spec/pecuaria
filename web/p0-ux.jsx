import React from 'react';

const money=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
const number=(value,digits=1)=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits}).format(Number(value));

export function P0Tabs({testId,items,active,onChange,label='Subáreas'}){
  return <nav className="p0-tabs" data-testid={testId} aria-label={label}>{items.map(item=><button key={item.id} type="button" className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>onChange(item.id)}><strong>{item.label}</strong>{item.detail&&<small>{item.detail}</small>}</button>)}</nav>;
}

export function TradeLiveSummary({result}){
  if(!result)return <section className="panel p0-compact-panel" data-testid="trade-live-summary"><div className="panel-heading"><div><span className="eyebrow">Fechamento</span><h2>Resumo em tempo real</h2><p>Simule o lote para conferir peso, rendimento, arrobas e valor antes de registrar a negociação.</p></div></div></section>;
  const settlement=result.settlement??result.summary??result;
  const liveWeightKg=settlement.liveWeightKg??result.liveWeightKg;
  const carcassWeightKg=settlement.carcassWeightKg??result.carcassWeightKg;
  const liveArrobas=settlement.liveArrobas??result.liveArrobas;
  const carcassArrobas=settlement.carcassArrobas??result.carcassArrobas;
  const yieldPct=settlement.carcassYieldPct??result.carcassYieldPct;
  const grossMinor=settlement.grossMinor??result.grossMinor;
  const deductionsMinor=settlement.deductionsMinor??result.deductionsMinor??0;
  const freightMinor=settlement.freightMinor??result.freightMinor??0;
  const commissionMinor=settlement.commissionMinor??result.commissionMinor??0;
  const netMinor=settlement.netMinor??result.netMinor;
  return <section className="panel p0-compact-panel" data-testid="trade-live-summary">
    <div className="panel-heading"><div><span className="eyebrow">Prévia do fechamento</span><h2>Confira antes de registrar</h2><p>O simulador é somente leitura; nenhum animal ou lançamento financeiro é alterado nesta etapa.</p></div></div>
    <div className="p0-metric-grid">
      <article><span>Peso vivo</span><strong>{number(liveWeightKg)} kg</strong></article>
      <article><span>Rendimento</span><strong>{yieldPct==null?'—':`${number(yieldPct,2)}%`}</strong></article>
      <article><span>Peso carcaça</span><strong>{number(carcassWeightKg)} kg</strong></article>
      <article><span>@ peso vivo</span><strong>{number(liveArrobas,2)}</strong></article>
      <article><span>@ carcaça</span><strong>{number(carcassArrobas,2)}</strong></article>
      <article><span>Bruto</span><strong>{money(grossMinor)}</strong></article>
      <article><span>Descontos + frete + comissão</span><strong>{money(Number(deductionsMinor)+Number(freightMinor)+Number(commissionMinor))}</strong></article>
      <article className="p0-metric-emphasis"><span>Líquido previsto</span><strong>{money(netMinor)}</strong></article>
    </div>
  </section>;
}

export function SettingsBackupPanel({screen,onAction,allowedActions=[]}){
  const can=name=>allowedActions.includes(name);
  return <section className="panel" data-testid="settings-backup-panel"><div className="panel-heading"><div><span className="eyebrow">Proteção local</span><h2>Backup e restauração</h2><p>Os arquivos continuam sob controle do operador. Antes de restaurar, o runtime cria o safety backup previsto no core.</p></div></div><div className="actions">{can('backup')&&<button type="button" className="primary" data-testid="action-settings-backup" onClick={()=>onAction('backup')}>{screen?.actionDefinitions?.backup?.label??'Criar backup'}</button>}{can('restore')&&<button type="button" data-testid="action-settings-restore" onClick={()=>onAction('restore')}>{screen?.actionDefinitions?.restore?.label??'Restaurar backup'}</button>}</div></section>;
}
