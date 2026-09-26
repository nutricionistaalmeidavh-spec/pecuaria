import React,{useMemo,useState} from 'react';

const money=value=>value==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
const moneyInput=value=>value==null?'':new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)/100);
const moneyMinor=value=>{const raw=String(value??'').trim().replace(/^R\$\s*/i,'').replace(/\s+/g,'');if(!raw)return 0;const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;const parsed=Number(normalized);if(!Number.isFinite(parsed))throw new TypeError('Informe um valor monetário válido.');return Math.round(parsed*100)};
const date=value=>{if(!value)return'—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString('pt-BR')};
const statusLabel={open:'Aberto',partial:'Parcial',settled:'Liquidado',cancelled:'Cancelado'};
const readLocalFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result??''));reader.onerror=()=>reject(reader.error??new Error('Não foi possível ler o arquivo local.'));reader.readAsText(file);});
const uid=prefix=>`${prefix}-${crypto.randomUUID()}`;
const now=()=>new Date().toISOString();

function Stat({label,value,detail=null}){return <div className="finance-admin-stat"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>}

export function FinanceAdminWorkspace({data,onRun,allowedActions=[]}){
  if(!data?.admin)return null;
  const admin=data.admin;
  const projection=admin.projection??{};
  const [busy,setBusy]=useState(false);
  const [settlementDraft,setSettlementDraft]=useState(null);
  const [reconcileDraft,setReconcileDraft]=useState({});
  const titles=admin.titles??[];
  const settlements=admin.settlements??[];
  const payable=useMemo(()=>titles.filter(item=>item.direction==='payable'),[titles]);
  const receivable=useMemo(()=>titles.filter(item=>item.direction==='receivable'),[titles]);
  const unreconciled=(admin.reconciliations??[]).filter(item=>item.status!=='reconciled');
  const reversedIds=new Set(settlements.filter(item=>item.reversesSettlementId).map(item=>item.reversesSettlementId));
  const activeSettlements=settlements.filter(item=>!item.reversesSettlementId&&!reversedIds.has(item.id));
  const titleById=new Map(titles.map(item=>[item.id,item]));
  const can=action=>allowedActions.includes(action);
  const run=async(action,input)=>{if(!onRun||!can(action))return;setBusy(true);try{return await onRun(action,input)}finally{setBusy(false)}};
  const runFile=async(action,file)=>{if(!file||!onRun||!can(action))return;setBusy(true);try{const content=await readLocalFile(file);await onRun(action,action==='importStatement'?{sourceName:file.name,text:content}:{sourceName:file.name,xml:content});}finally{setBusy(false)}};
  const openSettlement=item=>{if(can('settleTitle'))setSettlementDraft({titleId:item.id,amount:moneyInput(item.openAmountMinor),accountId:item.accountId??'',method:'pix'})};
  const confirmSettlement=async()=>{if(!settlementDraft||!can('settleTitle'))return;await run('settleTitle',{id:uid('settlement'),operationId:uid('settlement-op'),titleId:settlementDraft.titleId,amountMinor:moneyMinor(settlementDraft.amount),occurredAt:now(),accountId:settlementDraft.accountId||null,method:settlementDraft.method||null});setSettlementDraft(null)};
  const cancelTitle=async item=>{if(can('cancelTitle'))return run('cancelTitle',{id:item.id,cancelledAt:now(),reason:'Cancelamento manual'})};
  const reverseSettlement=async item=>{if(can('reverseSettlement'))return run('reverseSettlement',{id:uid('reversal'),operationId:uid('reversal-op'),settlementId:item.id,occurredAt:now(),reason:'Estorno manual'})};
  const reconcile=async(line,mode)=>{if(!can('reconcileStatement'))return;const draft=reconcileDraft[line.id]??{};await run('reconcileStatement',mode==='existing'?{rowId:line.id,settlementId:draft.settlementId}:{rowId:line.id,mode:'adjustment',operationId:uid('reconciliation-op'),accountId:draft.accountId||null,categoryId:draft.categoryId||null,description:line.description,notes:'Ajuste explícito pela conciliação local'});setReconcileDraft(current=>({...current,[line.id]:{}}))};
  const patchReconcile=(lineId,changes)=>setReconcileDraft(current=>({...current,[lineId]:{...(current[lineId]??{}),...changes}}));
  const titleRows=items=>items.length?items.slice(0,12).map(item=><div className="finance-title-row" key={item.id}><div><strong>{item.description}</strong><small>{date(item.dueAt)} · {statusLabel[item.status]??item.status}</small></div><span>{money(item.openAmountMinor)}</span><div className="actions">{can('settleTitle')&&!['settled','cancelled'].includes(item.status)&&<button type="button" onClick={()=>openSettlement(item)}>Baixar</button>}{can('cancelTitle')&&!['settled','cancelled'].includes(item.status)&&<button type="button" className="ghost" disabled={busy} onClick={()=>void cancelTitle(item)}>Cancelar</button>}</div></div>):<p className="finance-admin-empty">Nenhum título.</p>;

  return <section className="finance-admin-workspace" data-testid="finance-admin-workspace">
    <header className="finance-admin-heading"><div><span className="eyebrow">Administração financeira local</span><h2>Caixa, títulos e conciliação</h2><p>Contas a pagar e receber, realizado e previsão sem depender de serviços bancários externos.</p></div></header>

    <div className="finance-admin-grid" data-testid="finance-cash-summary">
      <Stat label="Entradas realizadas" value={money(projection.realized?.inflowMinor)} />
      <Stat label="Saídas realizadas" value={money(projection.realized?.outflowMinor)} />
      <Stat label="Resultado realizado" value={money(projection.realized?.netMinor)} />
      <Stat label="Sem conta vinculada" value={money(projection.unallocatedBalanceMinor)} />
    </div>

    <div className="finance-admin-columns">
      <section className="finance-admin-card" data-testid="finance-titles">
        <div className="finance-admin-card-title"><div><span className="eyebrow">Títulos</span><h3>Contas a pagar</h3></div><b>{payable.length}</b></div>
        <div className="finance-title-list">{titleRows(payable)}</div>
        <div className="finance-admin-card-title finance-admin-subtitle"><div><h3>Contas a receber</h3></div><b>{receivable.length}</b></div>
        <div className="finance-title-list">{titleRows(receivable)}</div>
      </section>

      <section className="finance-admin-card" data-testid="finance-forecast">
        <div className="finance-admin-card-title"><div><span className="eyebrow">Previsto x realizado</span><h3>Fluxo de caixa</h3></div></div>
        {[7,30,90].map(days=>{const row=projection.forecast?.[`days${days}`];return <div className="finance-forecast-row" key={days}><strong>{days} dias</strong><span>Receber {money(row?.receivableMinor)}</span><span>Pagar {money(row?.payableMinor)}</span><b>{money(row?.netMinor)}</b></div>})}
        <div className="finance-account-list">{(projection.accounts??[]).map(account=><div key={account.accountId}><span>{account.name??account.accountId}</span><strong>{money(account.balanceMinor)}</strong></div>)}</div>
      </section>
    </div>

    <section className="finance-admin-card" data-testid="finance-context-settle">
      <div className="finance-admin-card-title"><div><span className="eyebrow">Ação contextual</span><h3>Baixar título</h3><p>{can('settleTitle')?'Use o botão “Baixar” no próprio título; os identificadores técnicos são gerados pelo sistema.':'Seu perfil possui acesso somente de leitura para baixas.'}</p></div></div>
      {can('settleTitle')&&settlementDraft?<div className="form-grid"><label><span>Título</span><strong>{titleById.get(settlementDraft.titleId)?.description??settlementDraft.titleId}</strong></label><label><span>Valor (R$)</span><input inputMode="decimal" value={settlementDraft.amount} onChange={event=>setSettlementDraft({...settlementDraft,amount:event.target.value})}/></label><label><span>Conta/caixa</span><select value={settlementDraft.accountId} onChange={event=>setSettlementDraft({...settlementDraft,accountId:event.target.value})}><option value="">Sem conta vinculada</option>{(admin.accounts??[]).filter(item=>item.active!==false).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Forma</span><select value={settlementDraft.method} onChange={event=>setSettlementDraft({...settlementDraft,method:event.target.value})}><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option><option value="card">Cartão</option><option value="other">Outra</option></select></label><div className="actions"><button type="button" className="primary" disabled={busy||!can('settleTitle')||moneyMinor(settlementDraft.amount)<=0} onClick={()=>void confirmSettlement()}>Confirmar baixa</button><button type="button" className="ghost" onClick={()=>setSettlementDraft(null)}>Fechar</button></div></div>:<p className="finance-admin-empty">{can('settleTitle')?'Selecione um título aberto para iniciar a baixa.':'Baixas indisponíveis para este perfil.'}</p>}
    </section>

    <section className="finance-admin-card" data-testid="finance-context-cancel">
      <div className="finance-admin-card-title"><div><span className="eyebrow">Cancelamento</span><h3>Cancelar direto no título</h3><p>{can('cancelTitle')?'O botão de cancelamento aparece somente em títulos ainda abertos ou parciais.':'Cancelamentos indisponíveis para este perfil.'}</p></div></div>
    </section>

    <section className="finance-admin-card" data-testid="finance-context-reverse">
      <div className="finance-admin-card-title"><div><span className="eyebrow">Baixas</span><h3>Estornar movimentação</h3><p>O estorno é imutável e reabre o saldo do título quando aplicável.</p></div><b>{activeSettlements.length}</b></div>
      <div className="finance-title-list">{activeSettlements.slice(0,10).map(item=><div className="finance-title-row" key={item.id}><div><strong>{titleById.get(item.titleId)?.description??'Título'}</strong><small>{date(item.occurredAt)} · {item.method??'Sem forma informada'}</small></div><span>{money(item.amountMinor)}</span>{can('reverseSettlement')&&<button type="button" disabled={busy} onClick={()=>void reverseSettlement(item)}>Estornar</button>}</div>)}{!activeSettlements.length&&<p className="finance-admin-empty">Nenhuma baixa ativa para estornar.</p>}</div>
    </section>

    <section className="finance-admin-card" data-testid="finance-reconciliation">
      <div className="finance-admin-card-title"><div><span className="eyebrow">Conciliação</span><h3>Extrato local</h3><p>Linhas importadas permanecem pendentes até vínculo explícito com uma baixa ou ajuste.</p></div><b>{unreconciled.length}</b></div>
      <div data-testid="finance-context-reconcile" className="finance-reconcile-list">{unreconciled.length?unreconciled.slice(0,10).map(line=>{const draft=reconcileDraft[line.id]??{};return <div key={line.id}><span>{date(line.occurredAt)}</span><strong>{line.description}</strong><b>{money(line.amountMinor)}</b>{can('reconcileStatement')&&<><select aria-label={`Baixa para ${line.description}`} value={draft.settlementId??''} onChange={event=>patchReconcile(line.id,{settlementId:event.target.value})}><option value="">Selecione uma baixa</option>{activeSettlements.map(item=><option value={item.id} key={item.id}>{titleById.get(item.titleId)?.description??item.titleId} · {money(item.amountMinor)}</option>)}</select><div className="actions"><button type="button" disabled={busy||!draft.settlementId||!can('reconcileStatement')} onClick={()=>void reconcile(line,'existing')}>Vincular baixa</button><button type="button" className="ghost" disabled={busy||!can('reconcileStatement')} onClick={()=>void reconcile(line,'adjustment')}>Criar ajuste</button></div></>}</div>}):<p className="finance-admin-empty">Nenhuma linha pendente de conciliação.</p>}</div>
    </section>

    <div className="finance-local-imports">
      <label className="finance-file-card" data-testid="finance-import-statement"><span className="eyebrow">Importar extrato</span><strong>CSV local</strong><small>Selecione um arquivo; nenhum dado é enviado para serviços externos.</small><input type="file" accept=".csv,text/csv" disabled={busy||!can('importStatement')} onChange={event=>{const file=event.target.files?.[0];void runFile('importStatement',file);event.target.value=''}}/></label>
      <label className="finance-file-card" data-testid="finance-import-invoice"><span className="eyebrow">Ler XML/NF-e</span><strong>XML local</strong><small>O XML gera apenas uma sugestão. O título só nasce após confirmação explícita.</small><input type="file" accept=".xml,text/xml,application/xml" disabled={busy||!can('importInvoiceXml')} onChange={event=>{const file=event.target.files?.[0];void runFile('importInvoiceXml',file);event.target.value=''}}/></label>
    </div>
  </section>;
}
