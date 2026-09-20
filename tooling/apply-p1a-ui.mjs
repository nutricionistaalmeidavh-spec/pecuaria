import {readFile,writeFile} from 'node:fs/promises';

const path='web/main.jsx';
let source=await readFile(path,'utf8');
const replace=(needle,replacement,label)=>{if(!source.includes(needle))throw new Error(`Missing P1A UI anchor: ${label}`);source=source.replace(needle,replacement)};
replace("import {FieldMobileWorkspace} from './field-mobile.jsx';","import {FieldMobileWorkspace} from './field-mobile.jsx';\nimport {FinanceAdminWorkspace} from './finance-admin.jsx';",'finance admin import');
replace("    const shouldShow=(screen==='data'&&name==='validateImport')||(screen==='iot'&&['testDevice','startDevice','stopDevice','simulateRfid','simulateWeight'].includes(name));","    const shouldShow=(screen==='data'&&name==='validateImport')||(screen==='iot'&&['testDevice','startDevice','stopDevice','simulateRfid','simulateWeight'].includes(name))||(screen==='finance'&&['importStatement','importInvoiceXml'].includes(name));",'finance result surface');
replace("      {screenId==='finance'&&<FinanceDecisionPanel insights={depthInsights}/>} ","      {screenId==='finance'&&<FinanceDecisionPanel insights={depthInsights}/>} \n      {screenId==='finance'&&<FinanceAdminWorkspace data={data} onRun={async(name,input)=>{try{const result=await runAction('finance',name,input);surfaceResult(result,{screen:'finance',name});await load('finance');setNotice({tone:'success',text:name==='importInvoiceXml'?'XML lido localmente. Revise a sugestão antes de criar o título.':'Financeiro administrativo atualizado.'});return result}catch(error){setNotice({tone:'error',text:error.message});throw error}}}/>} ",'finance workspace render');
await writeFile(path,source,'utf8');
console.log('P1A finance UI patch applied');
