import test from 'node:test';
import assert from 'node:assert/strict';
import {createRpcBackend} from '../runtime/backend.mjs';
import {createEditionAccess} from '../src/editions.js';

function fixture(edition){
  const editionAccess=createEditionAccess({edition});
  const calls=[];
  const security={
    productId:'agro-pecuaria',
    permissionFor:({screenId,mode,action})=>`${screenId}:${mode}:${action??''}`,
    authorize:async()=>({user:{id:'user-1'}}),
    authenticateSession:async()=>({user:{id:'user-1'}}),
    hasUsers:async()=>true,
    listAudit:async()=>[],
    listUsers:async()=>[],
    listProfiles:async()=>[],
    createUser:async input=>input,
    updateUser:async input=>input,
    resetUserPassword:async input=>input
  };
  const screenMap={
    overview:{id:'overview',title:'Dashboard',kind:'dashboard',actions:{},actionDefinitions:{}},
    animals:{id:'animals',title:'Animais',kind:'animals',actions:{save:()=>{} ,batchMove:()=>{},recordBodyCondition:()=>{}},actionDefinitions:{save:{name:'save'},batchMove:{name:'batchMove'},recordBodyCondition:{name:'recordBodyCondition'}}},
    finance:{id:'finance',title:'Financeiro',kind:'finance',actions:{addCost:()=>{},saveTitle:()=>{}},actionDefinitions:{addCost:{name:'addCost'},saveTitle:{name:'saveTitle'}}},
    iot:{id:'iot',title:'IoT',kind:'iot',actions:{saveDevice:()=>{}},actionDefinitions:{saveDevice:{name:'saveDevice'}}}
  };
  const presentation={
    shell:{brand:{name:'ArtiSys Pecuária'},navigation:[
      {id:'overview',label:'Dashboard'},{id:'animals',label:'Animais'},{id:'finance',label:'Financeiro'},{id:'iot',label:'IoT'}
    ]},
    services:{
      security,
      editionAccess,
      reporting:{simulateSale:async input=>input,insights:async()=>({})},
      search:{query:async()=>[]},alerts:{list:async()=>[]}
    },
    screenIds:()=>Object.keys(screenMap),
    screen:id=>screenMap[id],
    load:async id=>{calls.push(['load',id]);return id==='finance'?{rows:[],admin:{titles:[1]}}:{rows:[]};},
    action:async(id,action,input)=>{calls.push(['action',id,action]);return{input};}
  };
  const backend=createRpcBackend({presentation,editionAccess});
  return{backend,calls,editionAccess};
}

const auth={sessionId:'session-1',token:'token-1'};
const isFeatureError=error=>error?.code==='FEATURE_NOT_LICENSED';

test('describe exposes only screens and actions licensed for the edition',async()=>{
  const essential=fixture('essential');
  const essentialDescription=await essential.backend.describe(auth);
  assert.deepEqual(essentialDescription.navigation.map(item=>item.id),['overview','animals']);
  assert.deepEqual(essentialDescription.screens.map(screen=>screen.id),['overview','animals']);
  assert.deepEqual(essentialDescription.screens.find(screen=>screen.id==='animals').actionDefinitions,{save:{name:'save'}});
  assert.equal(essentialDescription.edition.id,'essential');

  const management=fixture('management');
  const managementDescription=await management.backend.describe(auth);
  assert.deepEqual(managementDescription.navigation.map(item=>item.id),['overview','animals','finance']);
  assert.deepEqual(Object.keys(managementDescription.screens.find(screen=>screen.id==='finance').actionDefinitions),['addCost']);
});

test('backend denies unlicensed screens and mixed-screen actions before presentation execution',async()=>{
  const f=fixture('management');
  await assert.rejects(()=>f.backend.load({screenId:'iot',auth}),isFeatureError);
  await assert.rejects(()=>f.backend.action({screenId:'finance',action:'saveTitle',input:{id:'x'},auth}),isFeatureError);
  assert.equal(f.calls.length,0);

  await f.backend.action({screenId:'finance',action:'addCost',input:{id:'ok'},auth});
  assert.deepEqual(f.calls,[['action','finance','addCost']]);
});

test('backend sanitizes mixed-screen payloads when advanced feature is absent',async()=>{
  const f=fixture('management');
  const result=await f.backend.load({screenId:'finance',auth});
  assert.deepEqual(result,{rows:[]});
});

test('specialized Pro RPCs fail with feature error before persistence or domain access',async()=>{
  const f=fixture('management');
  await assert.rejects(()=>f.backend.audit({auth}),isFeatureError);
  await assert.rejects(()=>f.backend.reproductionAdmin({auth,operation:'state'}),isFeatureError);
  await assert.rejects(()=>f.backend.userAdmin({auth,operation:'state'}),isFeatureError);
  await assert.rejects(()=>f.backend.fieldSync({auth,operation:'state'}),isFeatureError);
});

test('management sale simulation is allowed while Essential is denied',async()=>{
  const essential=fixture('essential');
  await assert.rejects(()=>essential.backend.simulateSale({auth,priceMinor:100}),isFeatureError);
  const management=fixture('management');
  assert.deepEqual(await management.backend.simulateSale({auth,priceMinor:100}),{priceMinor:100});
});
