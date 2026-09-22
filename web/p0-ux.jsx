import React,{useMemo,useRef,useState} from 'react';

const money=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
const number=(value,digits=1)=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits}).format(Number(value));
const unwrap=records=>(records??[]).map(record=>record?.payload??record);

export function P0Tabs({testId,items,active,onChange,label='Subáreas'}){
  return <nav className="p0-tabs" data-testid={testId} aria-label={label}>{items.map(item=><button key={item.id} type="button" className={active===item.id?'active':''} aria-current={active===item.id?'page':undefined} onClick={()=>onChange(item.id)}><strong>{item.label}</strong>{item.detail&&<small>{item.detail}</small>}</button>)}</nav>;
}

export function SectionJumpNav({testId,items,label='Navegação da área'}){
  const [active,setActive]=useState(items[0]?.id??'');
  const jump=item=>{
    setActive(item.id);
    const target=document.querySelector(`[data-testid="${item.target}"]`);
    target?.scrollIntoView?.({behavior:'smooth',block:'start'});
  };
  return <nav className="p0-tabs p0-sticky-tabs" data-testid={testId} aria-label={label}>{items.map(item=><button key={item.id} type="button" className={active===item.id?'active':''} onClick={()=>jump(item)}><strong>{item.label}</strong>{item.detail&&<small>{item.detail}</small>}</button>)}</nav>;
}

const animalActionInitial=(name,selected)=>{
  const first=selected[0];
  if(['move','lifecycle','recordMilk'].includes(name)&&first)return{id:first};
  if(name==='recordBodyCondition'&&first)return{animalId:first};
  if(['batchMove','batchLifecycle'].includes(name)&&selected.length)return{animalIds:selected};
  return{};
};

export function AnimalOperationsBar({records=[],screen,allowedActions=[],onAction}){
  const rows=useMemo(()=>unwrap(records),[records]);
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState([]);
  const filtered=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase('pt-BR');
    if(!term)return rows;
    return rows.filter(row=>[row.tag,row.name,row.officialId,row.rfid,row.id].some(value=>String(value??'').toLocaleLowerCase('pt-BR').includes(term)));
  },[rows,query]);
  const can=name=>allowedActions.includes(name)&&screen?.actionDefinitions?.[name];
  const run=name=>onAction?.(name,{initialValues:animalActionInitial(name,selected)});
  const toggle=id=>setSelected(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id]);
  return <section className="panel animal-operations" data-testid="animal-operations">
    <div className="panel-heading"><div><span className="eyebrow">Operação rápida</span><h2>Seleção e manejo</h2><p>Localize por brinco, RFID ou identificação oficial, selecione um ou vários animais e execute o manejo com contexto.</p></div>{can('save')&&<button className="primary" type="button" data-testid="animal-primary-create" onClick={()=>run('save')}>Novo animal</button>}</div>
    <div className="animal-operations-toolbar"><label><span>Buscar animal</span><input type="search" data-testid="animal-operation-search" placeholder="Brinco, RFID, SISBOV ou nome" value={query} onChange={event=>setQuery(event.target.value)}/></label><span className="animal-selection-count" data-testid="animal-selection-count">{selected.length} selecionado(s)</span>{selected.length>0&&<button type="button" className="ghost" onClick={()=>setSelected([])}>Limpar seleção</button>}</div>
    {rows.length>0&&<><div className="animal-operation-result-count">{filtered.length} animal(is) encontrado(s)</div><div className="animal-select-list" aria-label="Seleção de animais">{filtered.slice(0,80).map(row=><label className="animal-select-row" key={row.id}><input type="checkbox" checked={selected.includes(row.id)} onChange={()=>toggle(row.id)}/><span><strong>{row.tag??row.name??row.id}</strong><small>{row.rfid??row.officialId??row.lotId??'Sem identificação complementar'}</small></span></label>)}</div></>}
    <div className="animal-action-groups">
      {can('registerBirth')&&<button type="button" onClick={()=>run('registerBirth')}>Registrar nascimento</button>}
      {can('move')&&<button type="button" disabled={selected.length!==1} onClick={()=>run('move')}>Mover selecionado</button>}
      {can('recordBodyCondition')&&<button type="button" disabled={selected.length!==1} onClick={()=>run('recordBodyCondition')}>Registrar escore</button>}
      {can('recordMilk')&&<button type="button" disabled={selected.length!==1} onClick={()=>run('recordMilk')}>Produção de leite</button>}
      {can('batchMove')&&<button type="button" disabled={selected.length<2} onClick={()=>run('batchMove')}>Mover em lote</button>}
      {can('batchLifecycle')&&<button type="button" disabled={selected.length<2} onClick={()=>run('batchLifecycle')}>Baixa coletiva</button>}
      {can('lifecycle')&&<button type="button" disabled={selected.length!==1} onClick={()=>run('lifecycle')}>Ciclo de vida</button>}
    </div>
  </section>;
}

export function P0CorralFlow({animals=[],onRecord}){
  const identifierRef=useRef(null),weightRef=useRef(null);
  const rows=useMemo(()=>unwrap(animals),[animals]);
  const [identifier,setIdentifier]=useState('');
  const [animalId,setAnimalId]=useState('');
  const [weight,setWeight]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const animal=rows.find(row=>row.id===animalId)??null;
  const previousEntry=animal?.weights?.at(-1)??null;
  const previous=Number(previousEntry?.weightKg);
  const nextWeight=Number(weight);
  const delta=Number.isFinite(previous)&&Number.isFinite(nextWeight)?nextWeight-previous:null;
  const anomaly=Number.isFinite(nextWeight)&&nextWeight>0&&(nextWeight<20||nextWeight>1500||(Number.isFinite(previous)&&Math.abs(delta)>Math.max(80,previous*.25)));
  const locate=()=>{
    const term=identifier.trim().toLocaleLowerCase('pt-BR');
    if(!term)return;
    const found=rows.find(row=>[row.tag,row.rfid,row.officialId,row.id].some(value=>String(value??'').toLocaleLowerCase('pt-BR')===term))??rows.find(row=>[row.tag,row.rfid,row.officialId,row.id].some(value=>String(value??'').toLocaleLowerCase('pt-BR').includes(term)));
    if(found){setAnimalId(found.id);setIdentifier(found.tag??found.rfid??found.officialId??found.id);setTimeout(()=>weightRef.current?.focus(),0)}
  };
  const submit=async()=>{
    if(anomaly&&!confirmed){setConfirmed(true);return;}
    await onRecord({id:animalId,weightKg:nextWeight,measuredAt:new Date().toISOString()});
    setWeight('');setAnimalId('');setIdentifier('');setConfirmed(false);setTimeout(()=>identifierRef.current?.focus(),0);
  };
  return <section className="panel" data-testid="corral-flow"><div className="panel-heading"><div><span className="eyebrow">Curral</span><h2>Pesagem rápida</h2><p>Identifique por brinco/RFID, confira o último peso e registre sem tirar o foco do fluxo.</p></div></div>
    <div className="corral-identifier"><label><span>Brinco, RFID ou identificação</span><input ref={identifierRef} data-testid="corral-identifier" value={identifier} placeholder="Leia ou digite e pressione Enter" onChange={event=>{setIdentifier(event.target.value);setAnimalId('');setConfirmed(false)}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();locate()}}}/></label><button type="button" onClick={locate}>Localizar</button></div>
    {animal&&<div className="corral-context"><div><span>Animal</span><strong>{animal.tag??animal.name??animal.id}</strong></div><div><span>Lote</span><strong>{animal.lotId??'Sem lote'}</strong></div><div><span>Peso anterior</span><strong>{Number.isFinite(previous)?`${number(previous)} kg`:'Sem dados'}</strong></div><div><span>Última pesagem</span><strong>{previousEntry?.measuredAt?new Date(previousEntry.measuredAt).toLocaleDateString('pt-BR'):'Sem dados'}</strong></div><div><span>GMD atual</span><strong>{animal.dailyGainKg==null?'—':`${number(animal.dailyGainKg,3)} kg/dia`}</strong></div></div>}
    <label><span>Novo peso (kg)</span><input ref={weightRef} data-testid="corral-weight" type="number" inputMode="decimal" min="1" step="0.1" value={weight} onChange={event=>{setWeight(event.target.value);setConfirmed(false)}}/></label>
    {animal&&Number.isFinite(nextWeight)&&nextWeight>0&&<div className="mini-metrics"><div><span>Diferença</span><strong>{delta==null?'—':`${number(delta)} kg`}</strong></div></div>}
    {anomaly&&<div className="weight-anomaly" data-testid="weight-anomaly"><strong>Peso fora do padrão esperado.</strong> Confira a identificação e o valor antes de confirmar.</div>}
    <div className="actions"><button className="primary" type="button" disabled={!animalId||!Number.isFinite(nextWeight)||nextWeight<=0} onClick={()=>void submit()}>{anomaly&&!confirmed?'Confirmar peso atípico':'Registrar e próximo'}</button></div>
  </section>;
}

export function FieldP0CommandBar({syncState}){
  const groups=[
    ['Rotina',[['Tarefas','Tarefas'],['Peso','Peso'],['Animal 360º','Animal 360º']]],
    ['Manejo',[['Mover','Mover'],['Coletivo','Coletivo'],['Ciclo','Ciclo'],['Nascimento','Nascimento']]],
    ['Saúde',[['Sanidade','Sanidade'],['Reprodução','Reprodução'],['Escores','Escores']]],
    ['Identificação',[['RFID','RFID'],['Rastreio','Rastreio']]],
    ['Pastagem',[['Pastos','Pastos']]],
    ['Dados',[['Sincronizar','Sincronizar']]]
  ];
  const open=label=>{
    const buttons=[...document.querySelectorAll('[data-testid="field-operation-switcher"] button')];
    buttons.find(button=>button.textContent?.trim()===label)?.click();
  };
  return <section className="panel p0-compact-panel"><div className="panel-heading"><div><span className="eyebrow">Atalhos de campo</span><h2>Manejo por intenção</h2><p>As ações mais usadas ficam agrupadas sem alterar o protocolo offline existente.</p></div></div><div className="field-sync-summary" data-testid="field-sync-status"><div><span>Dispositivo</span><strong>{syncState?.paired?'Pareado':'Não pareado'}</strong></div><div><span>Na fila</span><strong>{syncState?.pending??0}</strong></div><div><span>Conflitos</span><strong>{syncState?.conflicts??0}</strong></div></div><div className="field-action-groups" data-testid="field-action-groups">{groups.map(([group,actions])=><div className="field-action-group" key={group}><small>{group}</small>{actions.map(([label,target])=><button type="button" key={label} onClick={()=>open(target)}>{label}</button>)}</div>)}</div></section>;
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
  return <section className="panel p0-compact-panel" data-testid="trade-live-summary"><div className="panel-heading"><div><span className="eyebrow">Prévia do fechamento</span><h2>Confira antes de registrar</h2><p>O simulador é somente leitura; nenhum animal ou lançamento financeiro é alterado nesta etapa.</p></div></div><div className="p0-metric-grid"><article><span>Peso vivo</span><strong>{number(liveWeightKg)} kg</strong></article><article><span>Rendimento</span><strong>{yieldPct==null?'—':`${number(yieldPct,2)}%`}</strong></article><article><span>Peso carcaça</span><strong>{number(carcassWeightKg)} kg</strong></article><article><span>@ peso vivo</span><strong>{number(liveArrobas,2)}</strong></article><article><span>@ carcaça</span><strong>{number(carcassArrobas,2)}</strong></article><article><span>Bruto</span><strong>{money(grossMinor)}</strong></article><article><span>Descontos + frete + comissão</span><strong>{money(Number(deductionsMinor)+Number(freightMinor)+Number(commissionMinor))}</strong></article><article className="p0-metric-emphasis"><span>Líquido previsto</span><strong>{money(netMinor)}</strong></article></div></section>;
}

export function SettingsBackupPanel({screen,onAction,allowedActions=[]}){
  const can=name=>allowedActions.includes(name);
  return <section className="panel" data-testid="settings-backup-panel"><div className="panel-heading"><div><span className="eyebrow">Proteção local</span><h2>Backup e restauração</h2><p>Os arquivos continuam sob controle do operador. Antes de restaurar, o runtime cria o safety backup previsto no core.</p></div></div><div className="actions">{can('backup')&&<button type="button" className="primary" data-testid="action-settings-backup-p0" onClick={()=>onAction('backup')}>{screen?.actionDefinitions?.backup?.label??'Criar backup'}</button>}{can('restore')&&<button type="button" data-testid="action-settings-restore-p0" onClick={()=>onAction('restore')}>{screen?.actionDefinitions?.restore?.label??'Restaurar backup'}</button>}</div></section>;
}
