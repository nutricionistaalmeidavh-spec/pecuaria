import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSqlMigrations,openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createBackupManager} from '../src/backup.js';
import {createCattlePresentation} from '../src/presentation.js';
import {createRpcBackend} from './backend.mjs';
import {createNodeIoTDrivers} from './iot/node-drivers.mjs';
import {createLocalSecretStore} from './iot/secret-store.mjs';

const PID='agro-pecuaria';
const DB='artisys-pecuaria.sqlite';
const mdir=fileURLToPath(new URL('../migrations/',import.meta.url));

export async function createStandaloneHost({dataDir,backupDir=join(dataDir,'backups'),backupRetention=20}={}){
  await mkdir(dataDir,{recursive:true});
  await mkdir(backupDir,{recursive:true});
  const dbPath=join(dataDir,DB);
  const migrations=await loadSqlMigrations([{namespace:PID,dir:mdir}]);
  const open=()=>openProductPersistence({dbPath,productId:PID,migrations});
  let current=await open();
  const call=(name,args)=>{if(!current)throw new Error('Persistence is temporarily unavailable.');return current[name](...args);};
  const persistence={productId:PID,putRecord:(...a)=>call('putRecord',a),getRecord:(...a)=>call('getRecord',a),listRecords:(...a)=>call('listRecords',a),listCollections:(...a)=>call('listCollections',a),softDeleteRecord:(...a)=>call('softDeleteRecord',a),recordHistory:(...a)=>call('recordHistory',a),schemaState:(...a)=>call('schemaState',a),health:(...a)=>call('health',a),transaction:(...a)=>call('transaction',a)};
  const closeDatabase=async()=>{const old=current;current=null;await old?.close();};
  const reopenDatabase=async()=>{if(!current)current=await open();};
  const recovery=await createBackupManager({dbPath,backupDir,productId:PID,retention:backupRetention,closeDatabase,reopenDatabase});
  const secretStore=await createLocalSecretStore({directory:join(dataDir,'iot')});
  const drivers=createNodeIoTDrivers();
  const presentation=createCattlePresentation({persistence,recovery,iotRuntime:{drivers,secretStore}});
  const backend=createRpcBackend({presentation});
  const iotStartup=Promise.resolve().then(()=>presentation.services.iot.startEnabled()).catch(()=>[]);
  return{
    persistence,recovery,presentation,backend,
    async close(){await iotStartup;await presentation.services.iot.shutdown();await closeDatabase();}
  };
}
