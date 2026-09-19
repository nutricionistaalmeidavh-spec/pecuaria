import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('desktop UI gives the user explicit update choices',async()=>{
  const source=await read('web/main.jsx');
  assert.match(source,/Baixar atualização/);
  assert.match(source,/Instalar e reiniciar/);
  assert.match(source,/Verificar atualizações/);
  assert.match(source,/onStatus/);
  assert.match(source,/availableVersion/);
});
