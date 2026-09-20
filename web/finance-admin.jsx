import React,{useMemo,useState} from 'react';

const money=value=>value==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
const date=value=>{if(!value)return'—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString('pt-BR')};
const statusLabel={open:'Aberto',partial:'Parcial',settled:'Liquidado',cancelled:'Cancelado'};
const readLocalFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result??''));reader.onerror=()=>reject(reader.error??new Error('Não foi possível ler o arquivo local.'));reader.readAsText(file);});

function Stat({label,value,detail=null}){return <div className="finance-admin-stat"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>}

export function FinanceAdminWorkspace({data,onRun}){
  const admin=data?.admin??{};
  const projection=admin.projection??{};
  const [busy,setBusy]=useState(false);
  const titles=admin.titles??[];
  const payable=useMemo(()=>titles.filter(item=>item.direction==='payable'),[titles]);
  const receivable=useMemo(()=>titles.filter(item=>item.direction==='receivable'),[titles]);
  const unreconciled=(admin.reconciliations??[]).filter(item=>item.status!=='reconciled');
  const runFile=async(action,file)=>{if(!file||!onRun)return;setBusy(true);try{const content=await readLocalFile(file);await onRun(action,action==='importStatement'?{sourceName:file.name,text:content}:{sourceName:file.name,xml:content});}finally{setBusy(false)}};
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
        <div className="finance-title-list">{payable.length?payable.slice(0,8).map(item=><div className="finance-title-row" key={item.id}><div><strong>{item.description}</strong><small>{date(item.dueAt)} · {statusLabel[item.status]??item.status}</small></div><span>{money(item.openAmountMinor)}</span></div>):<p className="finance-admin-empty">Sem títulos a pagar.</p>}</div>
        <div className="finance-admin-card-title finance-admin-subtitle"><div><h3>Contas a receber</h3></div><b>{receivable.length}</b></div>
        <div className="finance-title-list">{receivable.length?receivable.slice(0,8).map(item=><div className="finance-title-row" key={item.id}><div><strong>{item.description}</strong><small>{date(item.dueAt)} · {statusLabel[item.status]??item.status}</small></div><span>{money(item.openAmountMinor)}</span></div>):<p className="finance-admin-empty">Sem títulos a receber.</p>}</div>
      </section>

      <section className="finance-admin-card" data-testid="finance-forecast">
        <div className="finance-admin-card-title"><div><span className="eyebrow">Previsto x realizado</span><h3>Fluxo de caixa</h3></div></div>
        {[7,30,90].map(days=>{const row=projection.forecast?.[`days${days}`];return <div className="finance-forecast-row" key={days}><strong>{days} dias</strong><span>Receber {money(row?.receivableMinor)}</span><span>Pagar {money(row?.payableMinor)}</span><b>{money(row?.netMinor)}</b></div>})}
        <div className="finance-account-list">{(projection.accounts??[]).map(account=><div key={account.accountId}><span>{account.name??account.accountId}</span><strong>{money(account.balanceMinor)}</strong></div>)}</div>
      </section>
    </div>

    <section className="finance-admin-card" data-testid="finance-reconciliation">
      <div className="finance-admin-card-title"><div><span className="eyebrow">Conciliação</span><h3>Extrato local</h3><p>Linhas importadas permanecem pendentes até vínculo explícito com uma baixa ou ajuste.</p></div><b>{unreconciled.length}</b></div>
      <div className="finance-reconcile-list">{unreconciled.length?unreconciled.slice(0,10).map(line=><div key={line.id}><span>{date(line.occurredAt)}</span><strong>{line.description}</strong><b>{money(line.amountMinor)}</b></div>):<p className="finance-admin-empty">Nenhuma linha pendente de conciliação.</p>}</div>
    </section>

    <div className="finance-local-imports">
      <label className="finance-file-card" data-testid="finance-import-statement"><span className="eyebrow">Importar extrato</span><strong>CSV local</strong><small>Selecione um arquivo; nenhum dado é enviado para serviços externos.</small><input type="file" accept=".csv,text/csv" disabled={busy} onChange={event=>{const file=event.target.files?.[0];void runFile('importStatement',file);event.target.value=''}}/></label>
      <label className="finance-file-card" data-testid="finance-import-invoice"><span className="eyebrow">Ler XML/NF-e</span><strong>XML local</strong><small>O XML gera apenas uma sugestão. O título só nasce após confirmação explícita.</small><input type="file" accept=".xml,text/xml,application/xml" disabled={busy} onChange={event=>{const file=event.target.files?.[0];void runFile('importInvoiceXml',file);event.target.value=''}}/></label>
    </div>
  </section>;
}
