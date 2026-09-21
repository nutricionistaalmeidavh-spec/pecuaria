import {readFile,writeFile} from 'node:fs/promises';

async function patch(path,transform){const before=await readFile(path,'utf8');const after=transform(before);if(after===before)throw new Error(`No change applied to ${path}`);await writeFile(path,after);}

await patch('web/action-config.js',source=>source.replace(
  "reconcileStatement:form('Conciliar linha',[field('lineId','Linha importada'),field('settlementId','Baixa existente'),field('operationId','ID da operação'),field('adjustmentTitleId','Título de ajuste'),field('adjustmentSettlementId','Baixa de ajuste'),field('description','Descrição do ajuste'),field('accountId','Conta/caixa'),field('categoryId','Categoria')],v=>({lineId:clean(v.lineId),settlementId:clean(v.settlementId)||null,operationId:clean(v.operationId)||null,...(clean(v.adjustmentTitleId)?{adjustment:{titleId:clean(v.adjustmentTitleId),settlementId:clean(v.adjustmentSettlementId),description:clean(v.description)||undefined,accountId:clean(v.accountId)||null,categoryId:clean(v.categoryId)||null}}:{})})),",
  "reconcileStatement:form('Conciliar linha',[field('rowId','Linha importada'),field('mode','Modo','select',{options:[['existing','Vincular baixa existente'],['adjustment','Criar ajuste conciliatório']]}),field('settlementId','Baixa existente'),field('operationId','ID da operação'),field('accountId','Conta/caixa'),field('categoryId','Categoria'),field('description','Descrição do ajuste'),field('notes','Observações','textarea')],v=>({rowId:clean(v.rowId),mode:clean(v.mode)==='adjustment'?'adjustment':null,settlementId:clean(v.mode)==='existing'?(clean(v.settlementId)||null):null,operationId:clean(v.operationId)||null,accountId:clean(v.accountId)||null,categoryId:clean(v.categoryId)||null,description:clean(v.description)||null,notes:clean(v.notes)||null})),"
));

await patch('src/presentation.js',source=>{
  let next=source.replace(
    "const [animals,events,trades,traceability,tasks]=await Promise.all([repos.animals.list(),repos.events.list(),repos.trades.list(),p1.traceability.list(),p1.tasks.list()]);",
    "const [animals,events,trades,traceability,tasks,bodyCondition]=await Promise.all([repos.animals.list(),repos.events.list(),repos.trades.list(),p1.traceability.list(),p1.tasks.list(),p1.bodyCondition.list()]);"
  );
  next=next.replace(
    "...rows(tasks).filter(t=>t.animalId===animalId).map(t=>({kind:'task',occurredAt:t.dueAt,title:'Agenda de manejo',detail:`${t.title} · ${t.status}`}))].sort",
    "...rows(tasks).filter(t=>t.animalId===animalId).map(t=>({kind:'task',occurredAt:t.dueAt,title:'Agenda de manejo',detail:`${t.title} · ${t.status}`})),...rows(bodyCondition).filter(item=>item.animalId===animalId).map(item=>({kind:'body-condition',occurredAt:item.occurredAt,title:'Escore corporal',detail:`${item.score} (${item.scaleMin}–${item.scaleMax})`}))].sort"
  );
  next=next.replace(
    "return{rows:enriched,detail:{animal:a,timeline}};",
    "return{rows:enriched,detail:{animal:a,timeline,bodyCondition:rows(bodyCondition).filter(item=>item.animalId===animalId).sort((x,y)=>String(y.occurredAt).localeCompare(String(x.occurredAt)))}};"
  );
  return next;
});

console.log('P1 review fixes applied.');
