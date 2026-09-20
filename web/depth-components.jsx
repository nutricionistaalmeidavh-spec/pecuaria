import React,{useState} from 'react';
import {DataTable} from './components.jsx';

const number=(value,digits=1)=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits}).format(Number(value));
const money=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
const pct=value=>value==null||!Number.isFinite(Number(value))?'—':`${number(value,1)}%`;

export function ActionResultPanel({result,onClose}){
  if(result==null)return null;
  const downloadable=Boolean(result?.downloaded||result?.content&&['csv','pdf'].includes(result?.format));
  const transfer=result?.format==='artisys-pecuaria-export';
  return <section className="panel" data-testid="action-result-panel"><div className="panel-heading"><div><span className="eyebrow">Resultado da operação</span><h2>{downloadable?'Arquivo gerado':transfer?'Exportação pronta':'Resultado'}</h2></div><button className="ghost" type="button" onClick={onClose}>Fechar</button></div>{downloadable&&<p>O arquivo foi preparado para download no computador.</p>}{transfer&&<p>{result.recordCount??result.records?.length??0} registro(s) exportado(s) de {result.collection}.</p>}{!downloadable&&!transfer&&<pre className="result-json">{JSON.stringify(result,null,2)}</pre>}</section>;
}

export function PastureDecisionPanel({insights}){
  if(!insights)return null;const s=insights.summary??{};
  return <section className="panel" data-testid="pasture-decision"><div className="panel-heading"><div><span className="eyebrow">Decisão de pastejo</span><h2>Lotação e desempenho por área</h2><p>UA/ha, capacidade utilizada, ocupação, descanso e produção por hectare.</p></div></div><div className="stat-grid"><article><span>Área total</span><strong>{number(s.totalHa,2)} ha</strong></article><article><span>UA/ha média</span><strong>{number(s.averageStockingAuHa,2)}</strong></article><article><span>Áreas ocupadas</span><strong>{s.occupied??0}</strong></article><article><span>Acima da capacidade</span><strong>{s.overCapacity??0}</strong></article></div><DataTable records={insights.rows??[]}/></section>;
}

export function ReproductionDecisionPanel({insights}){
  if(!insights)return null;const m=insights.metrics??{};
  return <section className="panel" data-testid="reproduction-decision"><div className="panel-heading"><div><span className="eyebrow">Reprodução avançada</span><h2>Eficiência do ciclo reprodutivo</h2><p>Intervalo entre partos, dias em aberto e desempenho por reprodutor, método e protocolo.</p></div></div><div className="stat-grid"><article><span>Intervalo entre partos</span><strong>{number(m.averageCalvingIntervalDays,1)} dias</strong></article><article><span>Dias em aberto</span><strong>{number(m.averageDaysOpen,1)} dias</strong></article><article><span>Concepção</span><strong>{pct(m.conceptionRatePct)}</strong></article><article><span>Partos previstos 60d</span><strong>{m.expectedCalvings60d??0}</strong></article></div>{(insights.bySire??[]).length>0&&<><h3>Desempenho por touro/sêmen</h3><DataTable records={insights.bySire}/></>}{(insights.byMethod??[]).length>0&&<><h3>Métodos utilizados</h3><DataTable records={insights.byMethod.map(x=>({method:x.key,count:x.count}))}/></>}{(insights.byProtocol??[]).length>0&&<><h3>Protocolos reprodutivos</h3><DataTable records={insights.byProtocol.map(x=>({protocol:x.key,count:x.count}))}/></>}</section>;
}

export function SanitaryAnalyticsPanel({insights}){
  if(!insights)return null;const s=insights.summary??{};
  return <section className="panel" data-testid="sanitary-analytics"><div className="panel-heading"><div><span className="eyebrow">Sanidade analítica</span><h2>Cobertura e custo sanitário</h2><p>Visualize cobertura do rebanho, pendências, carências e concentração de aplicações.</p></div></div><div className="stat-grid"><article><span>Cobertura 12 meses</span><strong>{pct(s.coveragePct)}</strong></article><article><span>Próximas/vencidas</span><strong>{s.overdue??0}</strong></article><article><span>Em carência</span><strong>{s.activeWithdrawal??0}</strong></article><article><span>Custo sanitário</span><strong>{money(s.totalCostMinor)}</strong></article></div>{(insights.byProtocol??[]).length>0&&<><h3>Uso por protocolo</h3><DataTable records={insights.byProtocol.map(x=>({protocolId:x.key,applications:x.count}))}/></>}</section>;
}

export function ProductiveIntelligencePanel({insights}){
  if(!insights)return null;const s=insights.summary??{};
  return <section className="panel" data-testid="productive-intelligence"><div className="panel-heading"><div><span className="eyebrow">Inteligência produtiva</span><h2>Ranking e projeção de peso</h2><p>Projeta peso mantendo o GMD histórico; é apoio à decisão, não previsão garantida.</p></div></div><div className="stat-grid"><article><span>Peso médio</span><strong>{number(s.averageWeightKg,1)} kg</strong></article><article><span>GMD médio</span><strong>{number(s.averageDailyGainKg,3)} kg/d</strong></article><article><span>Meta de referência</span><strong>{number(s.targetDailyGainKg,3)} kg/d</strong></article><article><span>Abaixo da referência</span><strong>{s.belowTarget??0}</strong></article></div><DataTable records={(insights.ranking??[]).slice(0,15)}/></section>;
}

export function FinanceDecisionPanel({insights}){
  if(!insights)return null;const s=insights.summary??{};
  return <section className="panel" data-testid="finance-decision"><div className="panel-heading"><div><span className="eyebrow">Resultado econômico</span><h2>Comparativo entre lotes</h2><p>Receita, custo, resultado, custo por cabeça e margem por lote.</p></div></div><div className="stat-grid"><article><span>Receitas</span><strong>{money(s.incomeMinor)}</strong></article><article><span>Custos</span><strong>{money(s.costMinor)}</strong></article><article><span>Resultado</span><strong>{money(s.resultMinor)}</strong></article><article><span>Margem</span><strong>{pct(s.marginPct)}</strong></article></div><DataTable records={insights.lots??[]}/></section>;
}

export function CommercialSummaryPanel({insights}){
  if(!insights)return null;const s=insights.summary??{};
  return <section className="panel" data-testid="commercial-summary"><div className="panel-heading"><div><span className="eyebrow">Comercial</span><h2>Histórico de fechamento</h2><p>Resumo das vendas já efetivadas; o simulador abaixo não altera esses números.</p></div></div><div className="stat-grid"><article><span>Vendas</span><strong>{s.sales??0}</strong></article><article><span>Com fechamento</span><strong>{s.settledSales??0}</strong></article><article><span>Rendimento médio</span><strong>{pct(s.averageYieldPct)}</strong></article><article><span>Valor líquido</span><strong>{money(s.netMinor)}</strong></article></div></section>;
}

export function FieldModePanel({tasks=[],onComplete}){
  const pending=(tasks??[]).map(x=>x?.payload??x).filter(x=>x.status!=='completed').slice().sort((a,b)=>String(a.dueAt).localeCompare(String(b.dueAt))).slice(0,12);
  return <section className="panel" data-testid="field-mode"><div className="panel-heading"><div><span className="eyebrow">Modo campo offline</span><h2>Fila rápida de manejo</h2><p>Usa a base local do aplicativo: consulte e conclua tarefas mesmo sem conexão externa.</p></div></div>{pending.length===0?<div className="empty"><strong>Nenhum manejo pendente</strong><span>A fila é alimentada pela Agenda de Manejo.</span></div>:<div className="activity-list">{pending.map(task=><div className="activity-row" key={task.id}><span className="activity-copy"><strong>{task.title}</strong><small>{task.kind} · {task.animalId??task.lotId??'geral'}</small></span><button type="button" className="primary" onClick={()=>onComplete(task.id)}>Concluir</button></div>)}</div>}</section>;
}

export function CommercialSimulator({lots=[],onSimulate,result}){
  const [values,setValues]=useState({lotId:'',carcassYieldPct:'52',pricePerCarcassArrobaMinor:'',deductionsMinor:'0',freightMinor:'0',commissionMinor:'0'});
  const change=(name,value)=>setValues(current=>({...current,[name]:value}));
  const submit=()=>onSimulate({lotId:values.lotId||null,carcassYieldPct:Number(values.carcassYieldPct),pricePerCarcassArrobaMinor:Number(values.pricePerCarcassArrobaMinor),deductionsMinor:Number(values.deductionsMinor||0),freightMinor:Number(values.freightMinor||0),commissionMinor:Number(values.commissionMinor||0)});
  return <section className="panel" data-testid="commercial-simulator"><div className="panel-heading"><div><span className="eyebrow">Simulador de venda</span><h2>Cenário antes do fechamento</h2><p>Calcula um cenário sem criar venda, dar baixa em animal ou gerar lançamento financeiro.</p></div></div><div className="form-grid"><label><span>Lote</span><select value={values.lotId} onChange={e=>change('lotId',e.target.value)}><option value="">Selecione</option>{lots.map(lot=><option key={lot.id} value={lot.id}>{lot.name??lot.id}</option>)}</select></label><label><span>Rendimento de carcaça (%)</span><input type="number" step="0.1" value={values.carcassYieldPct} onChange={e=>change('carcassYieldPct',e.target.value)}/></label><label><span>Preço/@ carcaça (centavos)</span><input type="number" value={values.pricePerCarcassArrobaMinor} onChange={e=>change('pricePerCarcassArrobaMinor',e.target.value)}/></label><label><span>Descontos (centavos)</span><input type="number" value={values.deductionsMinor} onChange={e=>change('deductionsMinor',e.target.value)}/></label><label><span>Frete (centavos)</span><input type="number" value={values.freightMinor} onChange={e=>change('freightMinor',e.target.value)}/></label><label><span>Comissão (centavos)</span><input type="number" value={values.commissionMinor} onChange={e=>change('commissionMinor',e.target.value)}/></label></div><div className="actions"><button className="primary" type="button" disabled={!values.lotId||!Number(values.pricePerCarcassArrobaMinor)} onClick={submit}>Simular cenário</button></div>{result&&<div className="stat-grid"><article><span>Animais</span><strong>{result.animalCount}</strong></article><article><span>Peso vivo</span><strong>{number(result.liveWeightKg,1)} kg</strong></article><article><span>@ carcaça</span><strong>{number(result.carcassArrobas,2)}</strong></article><article><span>Valor líquido</span><strong>{money(result.netMinor)}</strong></article></div>}</section>;
}

const advancedReportTypes=[['reproduction','Reprodução'],['commercial','Comercial e vendas'],['nutrition','Nutrição'],['finance','Financeiro pecuário'],['performance','Desempenho produtivo']];
export function AdvancedReportsPanel({lots=[],onGenerate}){
  const [type,setType]=useState('reproduction'),[format,setFormat]=useState('pdf'),[lotId,setLotId]=useState('');
  return <section className="panel" data-testid="advanced-reports"><div className="panel-heading"><div><span className="eyebrow">Relatórios aprofundados</span><h2>Decisão e gestão</h2><p>Relatórios adicionais sem criar novos módulos no menu.</p></div></div><div className="form-grid"><label><span>Relatório</span><select value={type} onChange={e=>setType(e.target.value)}>{advancedReportTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label><span>Formato</span><select value={format} onChange={e=>setFormat(e.target.value)}><option value="pdf">PDF</option><option value="csv">CSV</option></select></label><label><span>Lote opcional</span><select value={lotId} onChange={e=>setLotId(e.target.value)}><option value="">Todos</option>{lots.map(lot=><option key={lot.id} value={lot.id}>{lot.name??lot.id}</option>)}</select></label></div><div className="actions"><button className="primary" type="button" onClick={()=>onGenerate({type,format,lotId:lotId||undefined})}>Gerar relatório</button></div></section>;
}

export function IoTDetailsPanel({data}){
  if(!data)return null;const bindings=(data.bindings??[]).map(binding=>binding?.payload??binding),ports=(data.ports??[]).map(port=>typeof port==='string'?{port}:port),profiles=(data.profiles??[]).map(profile=>({profileId:profile.id??profile.profileId,name:profile.name??profile.label??profile.id}));
  return <section className="panel" data-testid="iot-details"><div className="panel-heading"><div><span className="eyebrow">Integração local</span><h2>RFID, portas e perfis disponíveis</h2></div></div>{bindings.length>0&&<><h3>Vínculos RFID</h3><DataTable records={bindings}/></>}{ports.length>0&&<><h3>Portas detectadas</h3><DataTable records={ports}/></>}{profiles.length>0&&<><h3>Perfis de integração</h3><DataTable records={profiles}/></>}</section>;
}
