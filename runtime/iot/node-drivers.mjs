import {SerialPort} from 'serialport';
import mqtt from 'mqtt';
import {SerialConnector} from '../../src/iot/connectors/serial.js';
import {HttpConnector} from '../../src/iot/connectors/http.js';

const toPromise=fn=>new Promise((resolve,reject)=>fn(error=>error?reject(error):resolve()));

function createSerialTransport(SerialPortClass){
  const transport={port:null};
  transport.open=async(config,onData)=>{
    const delimiter=String(config.delimiter??'\n');
    let buffer='';
    const port=new SerialPortClass({path:config.port,baudRate:config.baudRate,dataBits:config.dataBits,stopBits:config.stopBits,parity:config.parity,autoOpen:false});
    transport.port=port;
    port.on('data',chunk=>{
      if(!delimiter){onData(chunk);return;}
      buffer+=Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk);
      for(;;){const index=buffer.indexOf(delimiter);if(index<0)break;const frame=buffer.slice(0,index).trim();buffer=buffer.slice(index+delimiter.length);if(frame)onData(frame);}
    });
    await toPromise(callback=>port.open(callback));
  };
  transport.close=async()=>{if(transport.port?.isOpen)await toPromise(callback=>transport.port.close(callback));transport.port=null;};
  transport.write=async data=>{if(!transport.port?.isOpen)throw new Error('Serial port is not open');await toPromise(callback=>transport.port.write(data,callback));};
  return transport;
}

function createMqttRuntimeConnector(device,mqttConnect){
  let client=null,status='disconnected';
  const listeners=new Set();
  const emit=payload=>{for(const listener of listeners)listener(payload);};
  const options={username:device.config.username??undefined,password:device.config.password??device.config.token??undefined,clientId:device.config.clientId??undefined,reconnectPeriod:1000,connectTimeout:5000};
  return{
    get status(){return status;},
    onData(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    async connect(){
      if(status==='connected')return;
      status='connecting';
      client=mqttConnect(device.config.url,options);
      if(!client?.on)throw new TypeError('MQTT client is invalid');
      client.on('message',(topic,payload)=>emit({topic:String(topic),payload:Buffer.isBuffer(payload)?payload.toString('utf8'):String(payload)}));
      client.on('close',()=>{status='disconnected';});
      await new Promise((resolve,reject)=>{
        let settled=false;
        const timer=setTimeout(()=>{if(settled)return;settled=true;status='disconnected';reject(new Error('MQTT connection timeout'));},5500);
        client.once('connect',()=>{if(settled)return;settled=true;clearTimeout(timer);status='connected';for(const topic of device.config.topics??[])client.subscribe(topic);resolve();});
        client.once('error',error=>{if(settled)return;settled=true;clearTimeout(timer);status='disconnected';reject(error);});
      });
    },
    async disconnect(){if(client){await new Promise(resolve=>client.end(false,{},resolve));client=null;}status='disconnected';},
    async publish(topic,payload){if(!client||status!=='connected')throw new Error('MQTT client is not connected');return new Promise((resolve,reject)=>client.publish(String(topic),payload,error=>error?reject(error):resolve()));}
  };
}

function httpHeaders(config){
  const headers={};
  if(config.token)headers.authorization=`Bearer ${config.token}`;
  else if(config.username||config.password){
    const encoded=Buffer.from(`${config.username??''}:${config.password??''}`,'utf8').toString('base64');
    headers.authorization=`Basic ${encoded}`;
  }
  return headers;
}

function createPollingHttpConnector(device,fetchImpl){
  const base=new HttpConnector({id:device.id,baseUrl:device.config.baseUrl,fetchImpl});
  let timer=null;
  const interval=Math.max(250,Number(device.config.pollIntervalMs??1000));
  const requestOptions={headers:httpHeaders(device.config)};
  const originalConnect=base.connect.bind(base),originalDisconnect=base.disconnect.bind(base);
  const poll=async({required=false}={})=>{
    try{
      const payload=await base.request(device.config.path??'/',requestOptions);
      base.emitData(payload);
      return payload;
    }catch(error){
      if(required)throw error;
      return null;
    }
  };
  base.connect=async()=>{
    await originalConnect();
    await poll({required:true});
    timer=setInterval(()=>{void poll();},interval);
  };
  base.disconnect=async()=>{if(timer){clearInterval(timer);timer=null;}await originalDisconnect();};
  return base;
}

export function createNodeIoTDrivers({SerialPortClass=SerialPort,mqttConnect=mqtt.connect,fetchImpl=globalThis.fetch}={}){
  if(!SerialPortClass)throw new TypeError('SerialPort implementation is required');
  if(typeof mqttConnect!=='function')throw new TypeError('MQTT connect implementation is required');
  if(typeof fetchImpl!=='function')throw new TypeError('fetch implementation is required');
  return Object.freeze({
    listSerialPorts:async()=>SerialPortClass.list(),
    connectorFactory:async device=>{
      if(device.transport==='serial')return new SerialConnector({id:device.id,...device.config,transport:createSerialTransport(SerialPortClass)});
      if(device.transport==='mqtt')return createMqttRuntimeConnector(device,mqttConnect);
      if(device.transport==='http')return createPollingHttpConnector(device,fetchImpl);
      throw new TypeError(`Unsupported local IoT transport: ${device.transport}`);
    }
  });
}
