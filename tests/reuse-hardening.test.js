import test from 'node:test';import assert from 'node:assert/strict';
import {createDocumentService} from '../src/documents.js';
import {createCattlePdfService} from '../src/product-pdf.js';
import {SEARCHABLE_COLLECTIONS} from '../src/services/search.js';
import {ACTION_FORMS} from '../web/action-config.js';
test('real PDF module emits PDF bytes for cattle reports',async()=>{const documents=createDocumentService();const pdf=createCattlePdfService({documents});const result=await pdf.build('inventory',{rows:[{id:'i1',name:'Sal',kind:'supplement',quantity:10}]});assert.ok(result.content instanceof Uint8Array);assert.equal(new TextDecoder().decode(result.content.slice(0,8)).startsWith('%PDF-1.'),true);assert.ok(result.size>100);});
test('P1 collections are globally searchable',()=>{for(const c of ['cattle.traceability','cattle.inventory','cattle.pastures','cattle.nutrition','cattle.tasks'])assert.ok(SEARCHABLE_COLLECTIONS.includes(c));});
test('PDF is available from reports UI',()=>{assert.ok(ACTION_FORMS.reports.pdf);assert.ok(ACTION_FORMS.reports.issue.fields.find(x=>x.name==='format').options.some(([v])=>v==='pdf'));});
