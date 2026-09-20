import React from 'react';
import {DataTable} from './components.jsx';

export {ActionResultPanel,ReproductionDecisionPanel,SanitaryAnalyticsPanel,ProductiveIntelligencePanel,CommercialSummaryPanel,FieldModePanel,CommercialSimulator,AdvancedReportsPanel,IoTDetailsPanel} from './depth-components-base.jsx';

const number=(value,digits=1)=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:digits}).format(Number(value));
const money=value=>value==null||!Number.isFinite(Number(value))?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)/100);
const pct=value=>value==null||!Number.isFinite(Number(value))?'—':`${number(value,1)}%`;
const date=value=>value?new Intl.DateTimeFormat('pt-BR').format(new Date(value)):'—';

export function PastureDecisionPanel({insights}){
  if(!insights)return null;const s=insights.summary??{},period=insights.period??{};
  return <section className="panel" data-testid="pasture-decision">
    <div className="panel-heading"><div><span className="eyebrow">Decisão de pastejo</span><h2>Lotação e desempenho por área</h2><p>UA/ha, capacidade utilizada, ocupação, descanso e produção por hectare.</p></div></div>
    <div className="stat-grid"><article><span>Área total</span><strong>{number(s.totalHa,2)} ha</strong></article><article><span>UA/ha média</span><strong>{number(s.averageStockingAuHa,2)}</strong></article><article><span>Áreas ocupadas</span><strong>{s.occupied??0}</strong></article><article><span>Acima da capacidade</span><strong>{s.overCapacity??0}</strong></article></div>
    <DataTable records={insights.rows??[]}/>
    <div className="panel-heading"><div><span className="eyebrow">Produtividade histórica</span><h3>Comparação entre piquetes</h3><p>Período analisado: {date(period.from)} a {date(period.to)}. Compare ganho, lotação média, kg/ha/período e @/ha/período.</p></div></div>
    <DataTable records={insights.comparison??[]}/>
    {(insights.history??[]).length>0&&<><h3>Evolução de lotação e ganho por período</h3><DataTable records={insights.history}/></>}
  </section>;
}

export function FinanceDecisionPanel({insights}){
  if(!insights)return null;const s=insights.summary??{},allocation=insights.allocation??{},dre=insights.dre??{};
  return <section className="panel" data-testid="finance-decision">
    <div className="panel-heading"><div><span className="eyebrow">Resultado econômico</span><h2>Comparativo entre lotes</h2><p>Receita, custo, resultado, custo por cabeça e margem por lote.</p></div></div>
    <div className="stat-grid"><article><span>Receitas</span><strong>{money(s.incomeMinor)}</strong></article><article><span>Custos</span><strong>{money(s.costMinor)}</strong></article><article><span>Resultado</span><strong>{money(s.resultMinor)}</strong></article><article><span>Margem</span><strong>{pct(s.marginPct)}</strong></article><article><span>Cobertura de apropriação</span><strong>{pct(allocation.coveragePct)}</strong></article><article><span>Custo não apropriado</span><strong>{money(allocation.unallocatedCostMinor)}</strong></article></div>
    <DataTable records={insights.lots??[]}/>
    <div className="panel-heading"><div><span className="eyebrow">Financeiro profundo</span><h3>DRE pecuária</h3><p>Receita bruta, custos produtivos, aquisição e resultado operacional, derivados dos lançamentos já existentes.</p></div></div>
    <DataTable records={dre.lines??[]}/>
    {(insights.animals??[]).length>0&&<><h3>Custo individual por animal</h3><DataTable records={insights.animals}/></>}
    {(insights.phases??[]).length>0&&<><h3>Custo por fase</h3><DataTable records={insights.phases}/></>}
  </section>;
}
