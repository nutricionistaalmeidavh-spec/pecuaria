import {readFile,writeFile} from 'node:fs/promises';

const path='web/main.jsx';
let source=await readFile(path,'utf8');
const from="{screenId==='tasks'&&<FieldMobileWorkspace tasks={rows} animals={references.animals??[]} lots={references.lots??[]} protocols={references.protocols??[]} syncState={fieldSyncState} onSync={runFieldSync}/>}";
const to="{screenId==='tasks'&&<FieldMobileWorkspace tasks={rows} animals={references.animals??[]} lots={references.lots??[]} protocols={references.protocols??[]} fieldData={references} syncState={fieldSyncState} onSync={runFieldSync}/>}";
if(!source.includes(from))throw new Error('P1C FieldMobileWorkspace wiring anchor not found.');
source=source.replace(from,to);
await writeFile(path,source);
console.log('P1C field UI wiring patch applied.');
