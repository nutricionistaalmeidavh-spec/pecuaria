const clean=v=>typeof v==='string'?v.trim():v;
const num=v=>v===''||v==null?undefined:Number(v);
const list=v=>Array.isArray(v)?v.map(clean).filter(Boolean):String(v??'').split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
const dateTime=v=>v?new Date(v).toISOString():undefined;
const field=(name,label,type='text',extra={})=>Object.freeze({name,label,type,...extra});
const form=(title,fields,normalize=(values)=>Object.fromEntries(Object.entries(values).filter(([,v])=>v!==''&&v!=null)))=>Object.freeze({title,fields:Object.freeze(fields),defaults:Object.freeze({}),normalize});

export const ACTION_FORMS=Object.freeze({
  lots:Object.freeze({
    save:form('Salvar lote',[field('id','ID'),field('name','Nome'),field('farmUnitId','Unidade/Fazenda'),field('purpose','Finalidade','select',{options:[['beef','Corte'],['dairy','Leite'],['breeding','Reprodução']]})]),
    remove:form('Excluir lote',[field('id','ID do lote'),field('expectedVersion','Versão','number')],v=>({id:clean(v.id),expectedVersion:num(v.expectedVersion)}))
  }),
  animals:Object.freeze({
    save:form('Salvar animal',[field('id','ID'),field('tag','Brinco/identificação'),field('farmUnitId','Unidade/Fazenda'),field('lotId','Lote'),field('purpose','Finalidade','select',{options:[['beef','Corte'],['dairy','Leite'],['breeding','Reprodução']]}),field('sex','Sexo','select',{options:[['female','Fêmea'],['male','Macho'],['unknown','Não informado']]})]),
    move:form('Mover animal',[field('id','ID do animal'),field('toLotId','Lote destino'),field('movedAt','Data/hora','datetime-local'),field('reason','Motivo')],v=>({id:clean(v.id),toLotId:clean(v.toLotId),movedAt:dateTime(v.movedAt),reason:clean(v.reason)||'management'})),
    lifecycle:form('Registrar ciclo de vida',[field('id','ID do animal'),field('type','Evento','select',{options:[['birth','Nascimento'],['death','Morte'],['sale','Venda'],['disposal','Baixa']]}),field('occurredAt','Data/hora','datetime-local'),field('reason','Motivo')],v=>({id:clean(v.id),type:v.type,occurredAt:dateTime(v.occurredAt),reason:clean(v.reason)||null}))
  }),
  weights:Object.freeze({record:form('Registrar pesagem',[field('id','ID do animal'),field('weightKg','Peso (kg)','number',{step:'0.1'}),field('measuredAt','Data/hora','datetime-local')],v=>({id:clean(v.id),weightKg:num(v.weightKg),measuredAt:dateTime(v.measuredAt)}))}),
  sanitary:Object.freeze({
    saveProtocol:form('Salvar protocolo sanitário',[field('id','ID'),field('name','Nome'),field('productItemId','Produto/insumo'),field('dose','Dose','number',{step:'0.01'}),field('unit','Unidade')],v=>({...v,id:clean(v.id),name:clean(v.name),productItemId:clean(v.productItemId),dose:num(v.dose),unit:clean(v.unit)})),
    record:form('Registrar manejo sanitário',[field('id','ID do evento'),field('animalId','Animal'),field('protocolId','Protocolo'),field('productItemId','Produto/insumo'),field('dose','Dose','number',{step:'0.01'}),field('unit','Unidade'),field('occurredAt','Aplicação','datetime-local'),field('nextDueAt','Próxima dose','datetime-local')],v=>({...v,id:clean(v.id),animalId:clean(v.animalId),protocolId:clean(v.protocolId),productItemId:clean(v.productItemId),dose:num(v.dose),unit:clean(v.unit),occurredAt:dateTime(v.occurredAt),nextDueAt:v.nextDueAt?dateTime(v.nextDueAt):null}))
  }),
  reproduction:Object.freeze({record:form('Registrar reprodução',[field('id','ID do evento'),field('animalId','Animal'),field('type','Evento','select',{options:[['service','Cobertura/IA'],['pregnancy-check','Diagnóstico de gestação'],['calving','Parto'],['weaning','Desmame']]}),field('occurredAt','Data/hora','datetime-local'),field('relatedAnimalId','Animal relacionado')],v=>({id:clean(v.id),animalId:clean(v.animalId),type:v.type,occurredAt:dateTime(v.occurredAt),relatedAnimalId:clean(v.relatedAnimalId)||null}))}),
  trades:Object.freeze({create:form('Registrar negociação',[field('id','ID'),field('type','Tipo','select',{options:[['sale','Venda'],['purchase','Compra']]}),field('partyId','Cliente/fornecedor'),field('animalIds','Animais','list',{placeholder:'a1, a2 ou um por linha'}),field('totalAmountMinor','Valor total (centavos)','number'),field('occurredAt','Data/hora','datetime-local')],v=>({id:clean(v.id),type:v.type,partyId:clean(v.partyId),animalIds:list(v.animalIds),totalAmountMinor:num(v.totalAmountMinor),occurredAt:dateTime(v.occurredAt)}))}),
  finance:Object.freeze({
    addCost:form('Adicionar custo',[field('id','ID'),field('lotId','Lote'),field('amountMinor','Valor (centavos)','number'),field('description','Descrição'),field('category','Categoria')],v=>({id:clean(v.id),lotId:clean(v.lotId),amountMinor:num(v.amountMinor),description:clean(v.description),category:clean(v.category)})),
    fromTrade:form('Gerar financeiro da negociação',[field('tradeId','ID da negociação'),field('id','ID do lançamento'),field('lotId','Lote')])
  }),
  reports:Object.freeze({
    csv:form('Gerar CSV',[field('type','Relatório','select',{options:[['animal-history','Histórico do animal'],['lot-kpis','Indicadores do lote'],['sanitary','Manejo sanitário']]})],v=>({type:v.type,rows:[]})),
    issue:form('Emitir documento',[field('id','ID'),field('type','Tipo','select',{options:[['animal-history','Histórico do animal'],['lot-kpis','Indicadores do lote'],['sanitary','Manejo sanitário']]}),field('format','Formato','select',{options:[['csv','CSV'],['pdf','PDF']]}),field('content','Conteúdo','textarea')])
  }),
  settings:Object.freeze({
    backup:form('Criar backup',[field('id','Nome/ID do backup')],v=>v.id?{id:clean(v.id)}:{}),
    restore:form('Restaurar backup',[field('id','ID do backup')],v=>({id:clean(v.id)}))
  })
});

export const actionFormKeys=()=>Object.entries(ACTION_FORMS).flatMap(([screen,actions])=>Object.keys(actions).map(action=>`${screen}.${action}`));
export const getActionForm=(screenId,action)=>ACTION_FORMS[screenId]?.[action]??null;
