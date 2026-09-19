import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,readdir,stat,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const safe=value=>String(value??Date.now()).replace(/[^a-zA-Z0-9._-]/g,'-');
const metaPath=path=>`${path}.json`;

async function sha256(path){
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function verifySqlite(path,productId){
  let db;
  try{
    db=new DatabaseSync(path,{readOnly:true});
    const integrity=db.prepare('PRAGMA integrity_check').get();
    if(integrity?.integrity_check!=='ok')throw new Error('SQLite integrity check failed.');
    const row=db.prepare("SELECT value FROM __artisys_meta WHERE key='product_id'").get();
    if(!row||row.value!==productId)throw new Error('Backup belongs to another product or is invalid.');
    return true;
  }catch(error){
    throw new Error(`Invalid or corrupt backup: ${error.message}`);
  }finally{
    try{db?.close()}catch{}
  }
}

async function readMetadata(path){
  try{return JSON.parse(await readFile(metaPath(path),'utf8'))}catch{return null}
}

export async function createBackupManager({dbPath,backupDir,productId='agro-pecuaria',closeDatabase,reopenDatabase,retention=20}={}){
  if(typeof closeDatabase!=='function'||typeof reopenDatabase!=='function')throw new TypeError('Backup manager requires database lifecycle callbacks.');
  await mkdir(backupDir,{recursive:true});
  const limit=Math.max(1,Number(retention)||20);

  async function snapshotMetadata(id,path,{protected:protectedFlag=false,kind='regular'}={}){
    verifySqlite(path,productId);
    const file=await stat(path);
    return{id,productId,createdAt:file.mtime.toISOString(),path,size:file.size,sha256:await sha256(path),verified:true,protected:Boolean(protectedFlag),kind};
  }

  async function listBackups(){
    const names=(await readdir(backupDir)).filter(name=>name.endsWith('.sqlite'));
    const items=[];
    for(const name of names){
      const path=join(backupDir,name),id=name.slice(0,-7),metadata=await readMetadata(path),file=await stat(path);
      let verified=false,currentHash=null;
      try{
        currentHash=await sha256(path);
        verified=Boolean(metadata?.sha256&&metadata.sha256===currentHash);
        if(verified)verifySqlite(path,productId);
      }catch{verified=false}
      items.push({id,createdAt:metadata?.createdAt??file.mtime.toISOString(),path,size:file.size,sha256:metadata?.sha256??currentHash,verified,protected:Boolean(metadata?.protected),kind:metadata?.kind??(id.startsWith('safety-')?'safety':'legacy')});
    }
    return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function pruneRetention(justCreatedId){
    const backups=await listBackups();
    const regular=backups.filter(item=>item.kind!=='safety'&&!item.id.startsWith('safety-'));
    const keep=new Set(regular.filter(item=>item.protected).map(item=>item.id));
    keep.add(justCreatedId);
    let slots=Math.max(0,limit-keep.size);
    for(const item of regular){
      if(keep.has(item.id))continue;
      if(slots>0){keep.add(item.id);slots-=1;continue}
      await unlink(item.path).catch(()=>{});
      await unlink(metaPath(item.path)).catch(()=>{});
    }
  }

  async function createBackup({id=`backup-${Date.now()}`,protected:protectedFlag=false,kind='regular'}={}){
    const backupId=safe(id),path=join(backupDir,`${backupId}.sqlite`);
    await closeDatabase();
    try{await copyFile(dbPath,path)}finally{await reopenDatabase()}
    const metadata=await snapshotMetadata(backupId,path,{protected:protectedFlag,kind});
    await writeFile(metaPath(path),JSON.stringify(metadata,null,2),'utf8');
    if(kind!=='safety'&&!backupId.startsWith('safety-'))await pruneRetention(backupId);
    return metadata;
  }

  async function restoreBackup(id){
    const backupId=safe(id),source=join(backupDir,`${backupId}.sqlite`),metadata=await readMetadata(source);
    if(!metadata?.sha256)throw new Error('Backup integrity metadata is missing.');
    const actual=await sha256(source).catch(()=>null);
    if(actual!==metadata.sha256)throw new Error('Backup SHA256 integrity verification failed.');
    verifySqlite(source,productId);

    const safetyBackupId=`safety-${Date.now()}`;
    const safety=await createBackup({id:safetyBackupId,protected:true,kind:'safety'});
    await closeDatabase();
    try{
      await copyFile(source,dbPath);
      verifySqlite(dbPath,productId);
    }catch(error){
      await copyFile(safety.path,dbPath).catch(()=>{});
      throw error;
    }finally{
      await reopenDatabase();
    }
    return{restored:true,backupId,safetyBackupId:safety.id};
  }

  return Object.freeze({createBackup,listBackups,restoreBackup});
}
