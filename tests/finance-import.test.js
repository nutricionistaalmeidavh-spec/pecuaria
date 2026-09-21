import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {parseStatementCsv,parseInvoiceXml} from '../src/services/finance-import.js';
import {createFinanceAdminService} from '../src/services/finance-admin.js';

test('statement CSV parser is local, deterministic and handles comma/semicolon monetary formats',()=>{
  const semicolon='date;description;amount\n2026-09-20;Compra de sal;-1.234,56\n2026-09-21;Venda;2500,00\n';
  const first=parseStatementCsv(semicolon,{sourceName:'extrato.csv'}),second=parseStatementCsv(semicolon,{sourceName:'extrato.csv'});
  assert.equal(first.rows[0].amountMinor,-123456);assert.equal(first.rows[1].amountMinor,250000);
  assert.equal(first.rows[0].id,second.rows[0].id);assert.equal(first.fileId,second.fileId);
  const comma='date,description,amount\n2026-09-20,"Frete local",-50.25';
  assert.equal(parseStatementCsv(comma,{sourceName:'bank.csv'}).rows[0].amountMinor,-5025);
  assert.throws(()=>parseStatementCsv('date,amount\n2026-09-20,10',{sourceName:'x'}),/description|column/i);
  assert.throws(()=>parseStatementCsv('date,description,amount\n2026-09-20,X,abc',{sourceName:'x'}),/amount|money/i);
});

test('NF-e XML parser extracts a local proposal and rejects active-entity XML',()=>{
  const xml=`<?xml version="1.0"?><NFe><infNFe><ide><nNF>12345</nNF><dhEmi>2026-09-20T10:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor Rural</xNome></emit><total><ICMSTot><vNF>1250.50</vNF></ICMSTot></total></infNFe></NFe>`;
  const parsed=parseInvoiceXml(xml,{sourceName:'nfe.xml'});
  assert.equal(parsed.documentNumber,'12345');assert.equal(parsed.totalAmountMinor,125050);assert.equal(parsed.partyDocument,'12345678000199');assert.equal(parsed.partyName,'Fornecedor Rural');
  assert.equal(parsed.suggestion.direction,'payable');assert.equal(parsed.suggestion.originalAmountMinor,125050);
  assert.throws(()=>parseInvoiceXml('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><NFe>&xxe;</NFe>',{sourceName:'bad.xml'}),/DOCTYPE|ENTITY|unsafe/i);
  assert.throws(()=>parseInvoiceXml('<NFe><infNFe><ide><nNF>1</nNF></ide></infNFe></NFe>',{sourceName:'bad.xml'}),/total|vNF/i);
});

test('statement import is idempotent and invoice import does not create title before confirmation',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-fin-import-'));const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});const service=createFinanceAdminService(db);
  try{
    const text='date;description;amount\n2026-09-20;Venda;100,00';
    const first=await service.importStatement({sourceName:'same.csv',text});const second=await service.importStatement({sourceName:'same.csv',text});
    assert.equal(first.imported,1);assert.equal(second.imported,0);assert.equal(second.skipped,1);
    assert.equal((await db.listRecords('cattle.finance-reconciliations')).length,1);
    const xml='<NFe><infNFe><ide><nNF>9</nNF><dEmi>2026-09-20</dEmi></ide><emit><CPF>12345678900</CPF><xNome>Fornecedor</xNome></emit><total><ICMSTot><vNF>99.90</vNF></ICMSTot></total></infNFe></NFe>';
    const proposal=await service.importInvoiceXml({sourceName:'nfe.xml',xml});
    assert.equal(proposal.suggestion.originalAmountMinor,9990);assert.equal((await db.listRecords('cattle.finance-titles')).length,0);
  }finally{await db.close();await rm(dir,{recursive:true,force:true})}
});

test('statement reconciliation links an existing settlement once and identical retry is idempotent',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-fin-reconcile-link-'));const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});const service=createFinanceAdminService(db);
  try{
    await service.saveAccount({id:'bank',name:'Banco'});
    await service.saveTitle({id:'t1',direction:'receivable',description:'Venda',originalAmountMinor:10000,issuedAt:'2026-09-20',dueAt:'2026-09-20'});
    await service.settleTitle({id:'s1',operationId:'op-s1',titleId:'t1',amountMinor:10000,occurredAt:'2026-09-20',accountId:'bank'});
    const text='date;description;amount\n2026-09-20;Venda;100,00';
    const rowId=parseStatementCsv(text,{sourceName:'link.csv'}).rows[0].id;
    await service.importStatement({sourceName:'link.csv',text});
    const reconciled=await service.reconcileStatement({rowId,settlementId:'s1'});
    const retry=await service.reconcileStatement({rowId,settlementId:'s1'});
    assert.equal(reconciled.id,rowId);assert.equal(reconciled.status,'reconciled');assert.equal(reconciled.settlementId,'s1');
    assert.deepEqual(retry,reconciled);
    await assert.rejects(()=>service.reconcileStatement({rowId,settlementId:'other'}),/already reconciled|different/i);
    assert.equal((await db.listRecords('cattle.finance-reconciliations')).length,1);
  }finally{await db.close();await rm(dir,{recursive:true,force:true})}
});

test('adjustment reconciliation derives deterministic records from rowId and identical operation retry is idempotent',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'pecuaria-fin-reconcile-adjust-'));const db=await openProductPersistence({dbPath:join(dir,'db.sqlite'),productId:'agro-pecuaria'});const service=createFinanceAdminService(db);
  try{
    await service.saveAccount({id:'bank',name:'Banco'});
    const text='date;description;amount\n2026-09-20;Ajuste inicial;-100,00';
    const rowId=parseStatementCsv(text,{sourceName:'adjust.csv'}).rows[0].id;
    await service.importStatement({sourceName:'adjust.csv',text});
    const reconciled=await service.reconcileStatement({rowId,mode:'adjustment',accountId:'bank',operationId:'op-adjust'});
    const retry=await service.reconcileStatement({rowId,mode:'adjustment',accountId:'bank',operationId:'op-adjust'});
    assert.equal(reconciled.adjustmentTitleId,`${rowId}:adjustment-title`);
    assert.equal(reconciled.adjustmentSettlementId,`${rowId}:adjustment-settlement`);
    assert.deepEqual(retry,reconciled);
    const title=(await db.getRecord('cattle.finance-titles',reconciled.adjustmentTitleId)).payload;
    const settlement=(await db.getRecord('cattle.finance-settlements',reconciled.adjustmentSettlementId)).payload;
    assert.equal(title.direction,'payable');assert.equal(title.originalAmountMinor,10000);assert.equal(title.source,'reconciliation-adjustment');
    assert.equal(settlement.operationId,'op-adjust');assert.equal(settlement.accountId,'bank');assert.equal(settlement.amountMinor,10000);
    assert.equal((await db.listRecords('cattle.finance-titles')).length,1);assert.equal((await db.listRecords('cattle.finance-settlements')).length,1);
    await assert.rejects(()=>service.reconcileStatement({rowId,mode:'adjustment',accountId:'bank',operationId:'different-op'}),/already reconciled|different/i);
  }finally{await db.close();await rm(dir,{recursive:true,force:true})}
});
