import {nicheUxForScreen} from './niche-ux.js';

const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const labels={
  save:'Salvar',create:'Criar',add:'Adicionar',record:'Registrar',remove:'Excluir',start:'Iniciar',stop:'Parar',complete:'Concluir',cancel:'Cancelar',backup:'Criar backup',restore:'Restaurar',receive:'Receber',consume:'Consumir',reserve:'Reservar',release:'Liberar',move:'Mover',lifecycle:'Ciclo de vida',csv:'Gerar CSV',pdf:'Gerar PDF',issue:'Emitir',adjust:'Movimentar estoque',
  registerBirth:'Registrar nascimento',recordMilk:'Registrar produção de leite',batchMove:'Mover animais em lote',batchLifecycle:'Baixa coletiva',recordBodyCondition:'Registrar escore corporal',
  saveProtocol:'Salvar protocolo',batchRecord:'Registrar em lote',
  addCost:'Adicionar custo',fromTrade:'Gerar financeiro da negociação',saveAccount:'Salvar conta/caixa',saveCategory:'Salvar categoria',saveTitle:'Salvar título',cancelTitle:'Cancelar título',settleTitle:'Baixar título',reverseSettlement:'Estornar baixa',importStatement:'Importar extrato',reconcileStatement:'Conciliar extrato',importInvoiceXml:'Ler XML/NF-e',
  enterLot:'Entrada de lote',leaveLot:'Saída de lote',recordAssessment:'Avaliar pastagem',saveRotationPlan:'Planejar rotação',
  saveFarmUnit:'Cadastrar fazenda/unidade',saveBreed:'Cadastrar raça',saveParty:'Cadastrar contato',exportCollection:'Exportar dados',validateImport:'Validar importação',importCollection:'Importar dados',
  saveDevice:'Salvar dispositivo',removeDevice:'Remover dispositivo',testDevice:'Testar conexão',startDevice:'Iniciar dispositivo',stopDevice:'Parar dispositivo',bindRfid:'Vincular RFID',unbindRfid:'Desvincular RFID',simulateRfid:'Simular RFID',simulateWeight:'Simular pesagem'
};
const label=n=>labels[n]??String(n).replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase());

export function createFunctionalPresentation({shell,screens={},services={}}={}){
  if(!shell?.navigation)throw new TypeError('Shell navigation is required.');
  const map=new Map;
  for(const item of shell.navigation){
    const s=screens[item.id];
    if(!s)throw new Error(`Missing functional screen: ${item.id}.`);
    const actions=Object.freeze({...s.actions});
    const defs=Object.freeze(Object.fromEntries(Object.keys(actions).map(name=>[name,Object.freeze({name,label:label(name),fields:Object.freeze([]),requiresSelection:false})])));
    map.set(item.id,Object.freeze({id:item.id,title:s.title??item.label,kind:s.kind??'workspace',load:s.load??(async()=>({})),actions,actionDefinitions:defs,ux:s.ux??nicheUxForScreen(shell,item.id)}));
  }
  return Object.freeze({
    shell,
    services:Object.freeze({...services}),
    screenIds:()=>Object.freeze([...map.keys()]),
    screen(id){const s=map.get(text(id,'Screen id'));if(!s)throw new Error(`Unknown screen: ${id}.`);return s},
    async load(id,context){return this.screen(id).load(context)},
    async action(id,name,input,context){const fn=this.screen(id).actions[text(name,'Action')];if(typeof fn!=='function')throw new Error(`Unknown action ${name} on screen ${id}.`);return fn(input,context)}
  });
}
