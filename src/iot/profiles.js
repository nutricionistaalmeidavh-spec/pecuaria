const requiredText=(value,field)=>{const text=String(value??'').trim();if(!text)throw new TypeError(`${field} is required`);return text;};
const positiveNumber=(value,field,fallback)=>{const number=Number(value??fallback);if(!Number.isFinite(number)||number<=0)throw new TypeError(`${field} must be positive`);return number;};
const optionalText=value=>value==null?null:String(value).trim()||null;
const topics=value=>{const list=Array.isArray(value)?value:String(value??'').split(/[\n,]+/);const normalized=list.map(v=>String(v).trim()).filter(Boolean);if(!normalized.length)throw new TypeError('mqtt.topics requires at least one topic');return Object.freeze(normalized);};

const profile=(id,label,kind,transport)=>Object.freeze({id,label,kind,transport});
export const IOT_PROFILES=Object.freeze({
  'serial-rfid':profile('serial-rfid','Leitor RFID Serial/USB','rfid','serial'),
  'serial-scale':profile('serial-scale','Balança Serial/USB','scale','serial'),
  'mqtt-rfid':profile('mqtt-rfid','Leitor RFID MQTT','rfid','mqtt'),
  'mqtt-scale':profile('mqtt-scale','Balança MQTT','scale','mqtt'),
  'http-rfid':profile('http-rfid','Leitor RFID HTTP local','rfid','http'),
  'http-scale':profile('http-scale','Balança HTTP local','scale','http'),
  'simulator-rfid':profile('simulator-rfid','Simulador RFID','rfid','simulator'),
  'simulator-scale':profile('simulator-scale','Simulador de balança','scale','simulator')
});

export const SENSITIVE_CONFIG_KEYS=Object.freeze(['password','token','apiKey','clientSecret']);
const sensitive=new Set(SENSITIVE_CONFIG_KEYS.map(key=>key.toLowerCase()));

export function splitSensitiveConfig(config={}){
  const publicConfig={},secrets={};
  for(const [key,value] of Object.entries(config??{})){
    if(sensitive.has(key.toLowerCase())){if(value!==undefined&&value!==null&&String(value)!=='')secrets[key]=value;}
    else publicConfig[key]=value;
  }
  return{publicConfig:Object.freeze(publicConfig),secrets:Object.freeze(secrets)};
}

function normalizeSerial(config){
  return Object.freeze({
    port:requiredText(config?.port,'serial.port'),
    baudRate:positiveNumber(config?.baudRate,'serial.baudRate',9600),
    dataBits:positiveNumber(config?.dataBits,'serial.dataBits',8),
    stopBits:positiveNumber(config?.stopBits,'serial.stopBits',1),
    parity:String(config?.parity??'none').trim()||'none',
    delimiter:config?.delimiter==null?'\n':String(config.delimiter)
  });
}
function normalizeMqtt(config){
  const url=requiredText(config?.url,'mqtt.url');
  if(!/^(mqtt|mqtts|ws|wss):\/\//i.test(url))throw new TypeError('mqtt.url must use mqtt://, mqtts://, ws:// or wss://');
  return Object.freeze({url,topics:topics(config?.topics),username:optionalText(config?.username),password:config?.password,token:config?.token,clientId:optionalText(config?.clientId)});
}
function normalizeHttp(config){
  const baseUrl=requiredText(config?.baseUrl,'http.baseUrl').replace(/\/$/,'');
  if(!/^https?:\/\//i.test(baseUrl))throw new TypeError('http.baseUrl must use http:// or https://');
  return Object.freeze({baseUrl,path:String(config?.path??'').trim()||'/',pollIntervalMs:positiveNumber(config?.pollIntervalMs,'http.pollIntervalMs',1000),username:optionalText(config?.username),password:config?.password,token:config?.token});
}

export function validateDeviceDefinition(input){
  if(!input||typeof input!=='object')throw new TypeError('device definition is required');
  const profileId=requiredText(input.profileId,'device.profileId');
  const profileDef=IOT_PROFILES[profileId];
  if(!profileDef)throw new TypeError(`Unsupported IoT profile: ${profileId}`);
  let config={};
  if(profileDef.transport==='serial')config=normalizeSerial(input.config??{});
  else if(profileDef.transport==='mqtt')config=normalizeMqtt(input.config??{});
  else if(profileDef.transport==='http')config=normalizeHttp(input.config??{});
  else config=Object.freeze({});
  return Object.freeze({
    id:requiredText(input.id,'device.id'),
    name:requiredText(input.name,'device.name'),
    profileId,
    kind:profileDef.kind,
    transport:profileDef.transport,
    stationId:optionalText(input.stationId),
    farmId:optionalText(input.farmId),
    enabled:input.enabled!==false,
    config
  });
}
