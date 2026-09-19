import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const managerUrl=new URL('../src/iot/device-manager.js',import.meta.url);
const driversUrl=new URL('../runtime/iot/node-drivers.mjs',import.meta.url);
const hasManager=existsSync(fileURLToPath(managerUrl));
const hasDrivers=existsSync(fileURLToPath(driversUrl));
const managerModule=hasManager?await import(managerUrl):null;

function fakeRegistry(devices){
  const map=new Map(devices.map(device=>[device.id,device]));
  return{
    resolveDevice:async id=>map.get(id)??null,
    listDevices:async()=>[...map.values()].map(device=>({...device,config:{...device.config}}))
  };
}

function fakeConnectorFactory(log){
  return async device=>{
    const listeners=new Set();
    return{
      status:'disconnected',
      onData(fn){listeners.add(fn);return()=>listeners.delete(fn)},
      async connect(){this.status='connected';log.push(['connect',device.id])},
      async disconnect(){this.status='disconnected';log.push(['disconnect',device.id])},
      emit(payload){for(const listener of listeners)listener(payload)}
    };
  };
}

test('P1 exposes Device Manager and Node driver module',()=>{
  assert.equal(hasManager,true);
  assert.equal(hasDrivers,true);
});

test('manager starts devices independently and normalizes RFID/weight readings',{skip:!hasManager},async()=>{
  const devices=[
    {id:'rfid-1',name:'RFID',kind:'rfid',transport:'serial',stationId:'curral-a',enabled:true,config:{port:'COM4'}},
    {id:'scale-1',name:'Balança',kind:'scale',transport:'serial',stationId:'curral-b',enabled:true,config:{port:'COM5'}}
  ];
  const calls=[],readings=[];
  const manager=managerModule.createDeviceManager({
    registry:fakeRegistry(devices),
    connectorFactory:fakeConnectorFactory(calls),
    onReading:reading=>readings.push(reading),
    listSerialPorts:async()=>[{path:'COM4'},{path:'COM5'}]
  });

  assert.deepEqual(await manager.listPorts(),[{path:'COM4'},{path:'COM5'}]);
  await manager.startDevice('rfid-1');
  await manager.startDevice('scale-1');
  assert.equal(manager.getStatus('rfid-1').status,'connected');
  assert.equal(manager.getStatus('scale-1').status,'connected');

  manager.ingest('rfid-1',' 982000411823945\r\n');
  manager.ingest('scale-1','ST,GS,+00481.70 kg');
  assert.equal(readings[0].stationId,'curral-a');
  assert.deepEqual(readings[0].reading,{kind:'rfid',tagId:'982000411823945'});
  assert.equal(readings[1].stationId,'curral-b');
  assert.equal(readings[1].reading.value,481.7);
  assert.equal(readings[1].reading.stable,true);

  await manager.stopDevice('rfid-1');
  assert.equal(manager.getStatus('rfid-1').status,'disconnected');
  assert.equal(manager.getStatus('scale-1').status,'connected');
});

test('device failures are controlled and do not affect another device',{skip:!hasManager},async()=>{
  const devices=[
    {id:'bad',name:'Ocupado',kind:'scale',transport:'serial',stationId:'a',enabled:true,config:{port:'COM9'}},
    {id:'good',name:'Livre',kind:'rfid',transport:'serial',stationId:'b',enabled:true,config:{port:'COM4'}}
  ];
  const manager=managerModule.createDeviceManager({
    registry:fakeRegistry(devices),
    connectorFactory:async device=>{
      if(device.id==='bad')return{status:'disconnected',onData(){return()=>{}},async connect(){throw new Error('Port COM9 is busy')},async disconnect(){}};
      return{status:'disconnected',onData(){return()=>{}},async connect(){this.status='connected'},async disconnect(){this.status='disconnected'}};
    }
  });

  await assert.rejects(manager.startDevice('bad'),/busy/i);
  assert.equal(manager.getStatus('bad').status,'error');
  assert.match(manager.getStatus('bad').error,/busy/i);
  await manager.startDevice('good');
  assert.equal(manager.getStatus('good').status,'connected');
});

test('testDevice connects and disconnects without leaving hardware active',{skip:!hasManager},async()=>{
  const calls=[];
  const device={id:'scale-test',name:'Teste',kind:'scale',transport:'serial',stationId:'a',enabled:true,config:{port:'COM8'}};
  const manager=managerModule.createDeviceManager({registry:fakeRegistry([device]),connectorFactory:fakeConnectorFactory(calls)});
  const result=await manager.testDevice('scale-test');
  assert.deepEqual(result,{ok:true,status:'disconnected'});
  assert.deepEqual(calls,[['connect','scale-test'],['disconnect','scale-test']]);
  assert.equal(manager.getStatus('scale-test').status,'disconnected');
});

test('simulator profile can inject readings without physical hardware',{skip:!hasManager},async()=>{
  const device={id:'sim-rfid',name:'Simulador',kind:'rfid',transport:'simulator',stationId:'sim',enabled:true,config:{}};
  const readings=[];
  const manager=managerModule.createDeviceManager({registry:fakeRegistry([device]),onReading:value=>readings.push(value)});
  await manager.startDevice('sim-rfid');
  manager.simulate('sim-rfid','123456789');
  assert.equal(manager.getStatus('sim-rfid').status,'connected');
  assert.equal(readings[0].reading.tagId,'123456789');
});
