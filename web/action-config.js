const clean=v=>typeof v==='string'?v.trim():v;
const num=v=>v===''||v==null?undefined:Number(v);
const list=v=>Array.isArray(v)?v.map(clean).filter(Boolean):String(v??'').split(/[\n,]+/).map(s=>s.trim()).filter(Boolean);
const dateTime=v=>v?new Date(v).toISOString():undefined;
const field=(name,label,type='text',extra={})=>Object.freeze({name,label,type,...extra});
const form=(title,fields,normalize=(values)=>Object.fromEntries(Object.entries(values).filter(([,v])=>v!==''&&v!=null)))=>Object.freeze({title,fields:Object.freeze(fields),defaults:Object.freeze({}),normalize});
const iotProfiles=[['serial-rfid','Leitor RFID Serial/USB'],['serial-scale','Balança Serial/USB'],['mqtt-rfid','Leitor RFID MQTT'],['mqtt-scale','Balança MQTT'],['http-rfid','Leitor RFID HTTP local'],['http-scale','Balança HTTP local'],['simulator-rfid','Simulador RFID'],['simulator-scale','Simulador de balança']];
const iotDevice=v=>{
  const profileId=clean(v.profileId),base={id:clean(v.id),name:clean(v.name),profileId,stationId:clean(v.stationId)||null,farmId:clean(v.farmId)||null,enabled:String(v.enabled??'true')!=='false'};
  let config={};
  if(String(profileId).startsWith('serial-'))config={port:clean(v.port),baudRate:num(v.baudRate)??9600,...(v.delimiter!==''&&v.delimiter!=null?{delimiter:String(v.delimiter)}:{})};
  else if(String(profileId).startsWith('mqtt-'))config={url:clean(v.url),topics:list(v.topics),username:clean(v.username)||null,...(v.password?{password:v.password}:{}),...(v.token?{token:v.token}:{})};
  else if(String(profileId).startsWith('http-'))config={baseUrl:clean(v.baseUrl),path:clean(v.path)||'/',pollIntervalMs:num(v.pollIntervalMs)??1000,username:clean(v.username)||null,...(v.password?{password:v.password}:{}),...(v.token?{token:v.token}:{})};
  return{...base,config};
};

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
  iot:Object.freeze({
    saveDevice:form('Adicionar ou atualizar dispositivo',[field('id','ID do dispositivo'),field('name','Nome'),field('profileId','Tipo de integração','select',{options:iotProfiles}),field('stationId','Estação/curral'),field('farmId','Fazenda'),field('enabled','Ativar automaticamente','select',{options:[['true','Sim'],['false','Não']]}),field('port','Porta serial/USB',{toString:()=> 'text'}),field('baudRate','Baud rate','number'),field('delimiter','Delimitador serial'),field('url','URL MQTT'),field('topics','Tópicos MQTT','list'),field('baseUrl','URL HTTP local'),field('path','Caminho HTTP'),field('pollIntervalMs','Intervalo HTTP (ms)','number'),field('username','Usuário'),field('password','Senha','password'),field('token','Token','password')],iotDevice),
    removeDevice:form('Remover dispositivo',[field('id','ID do dispositivo')],v=>({id:clean(v.id)})),
    testDevice:form('Testar conexão',[field('id','ID do dispositivo')],v=>({id:clean(v.id)})),
    startDevice:form('Iniciar dispositivo',[field('id','ID do dispositivo')],v=>({id:clean(v.id)})),
    stopDevice:form('Parar dispositivo',[field('id','ID do dispositivo')],v=>({id:clean(v.id)})),
    bindRfid:form('Vincular RFID a animal',[field('tagId','Código RFID'),field('animalId','ID do animal')],v=>({tagId:clean(v.tagId),animalId:clean(v.animalId)})),
    unbindRfid:form('Desvincular RFID',[field('tagId','Código RFID')],v=>({tagId:clean(v.tagId)})),
    simulateRfid:form('Simular leitura RFID',[field('deviceId','Dispositivo simulador'),field('tagId','Código RFID')],v=>({deviceId:clean(v.deviceId),tagId:clean(v.tagId)})),
    simulateWeight:form('Simular pesagem',[field('deviceId','Dispositivo simulador'),field('value','Peso','number',{step:'0.1'}),field('unit','Unidade','select',{options:[['kg','kg'],['g','g'],['lb','lb']]}),field('stable','Peso estável','select',{options:[['true','Sim'],['false','Não']]})],v=>({deviceId:clean(v.deviceId),value:num(v.value),unit:v.unit||'kg',stable:String(v.stable??'true')!=='false'}))
  }),
  settings:Object.freeze({
    backup:form('Criar backup',[field('id','Nome/ID do backup')],v=>v.id?{id:clean(v.id)}:{}),
    restore:form('Restaurar backup',[field('id','ID do backup')],v=>({id:clean(v.id)}))
  })
});

export const actionFormKeys=()=>Object.entries(ACTION_FORMS).flatMap(([screen,actions])=>Object.keys(actions).map(action=>`${screen}.${action}`));
export const getActionForm=(screenId,action)=>ACTION_FORMS[screenId]?.[action]??null;
