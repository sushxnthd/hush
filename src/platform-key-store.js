import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const KEY_BYTES=32;
const SERVICE='io.hush.local';
const ACCOUNT='root-key-v1';

function commandExists(command,args=['--help']){
  try{ const result=spawnSync(command,args,{stdio:'ignore',timeout:3000}); return !result.error; }
  catch{return false;}
}
function validKey(buffer){ return Buffer.isBuffer(buffer)&&buffer.length===KEY_BYTES; }
function atomicWrite(file,data,mode=0o600){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=`${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp,data,{mode});
  fs.renameSync(temp,file);
  try{fs.chmodSync(file,mode);}catch{}
}
function readLegacy(file){
  if(!fs.existsSync(file)) return null;
  const key=fs.readFileSync(file);
  return validKey(key)?key:null;
}
function commandFailure(label,run){
  const raw=String(run?.stderr||'').trim().replace(/\s+/g,' ').slice(0,400);
  const detail=raw||run?.error?.message;
  return new Error(detail?`${label}: ${detail}`:label);
}

function windowsDpapi(dir,legacy){
  if(process.platform!=='win32') return null;
  // A cold CLR start can exceed the generic probe deadline. Locate the system
  // binary without starting PowerShell, then validate DPAPI in the real call.
  const powershell=path.join(process.env.SystemRoot||process.env.WINDIR||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  if(!fs.existsSync(powershell)) return null;
  fs.mkdirSync(dir,{recursive:true});
  const blob=path.join(dir,'root-key.dpapi');
  const common=`$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;`;
  const protect=`${common}$b=[Convert]::FromBase64String($env:HUSH_KEY_INPUT);$p=[System.Security.Cryptography.ProtectedData]::Protect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[IO.File]::WriteAllText($env:HUSH_KEY_PATH,[Convert]::ToBase64String($p),[Text.Encoding]::ASCII)`;
  const unprotect=`${common}$p=[Convert]::FromBase64String([IO.File]::ReadAllText($env:HUSH_KEY_PATH,[Text.Encoding]::ASCII));$b=[System.Security.Cryptography.ProtectedData]::Unprotect($p,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($b))`;
  const seal=key=>{
    const run=spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',protect],{env:{...process.env,HUSH_KEY_INPUT:key.toString('base64'),HUSH_KEY_PATH:blob},encoding:'utf8',timeout:20000,windowsHide:true});
    if(run.error||run.status!==0||!fs.existsSync(blob)) throw commandFailure('Windows DPAPI failed to seal Hush root key',run);
  };
  if(!fs.existsSync(blob)) seal(legacy??crypto.randomBytes(KEY_BYTES));
  const run=spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',unprotect],{env:{...process.env,HUSH_KEY_PATH:blob},encoding:'utf8',timeout:20000,windowsHide:true});
  if(run.error||run.status!==0) throw commandFailure('Windows DPAPI failed to unlock Hush root key',run);
  const key=Buffer.from(String(run.stdout||'').trim(),'base64');
  if(!validKey(key)) throw new Error('Windows DPAPI returned an invalid Hush root key');
  return {key,backend:'windows-dpapi',sealedPath:blob};
}

function macKeychain(legacy){
  if(process.platform!=='darwin'||!commandExists('security',['help'])) return null;
  const lookup=()=>spawnSync('security',['find-generic-password','-a',ACCOUNT,'-s',SERVICE,'-w'],{encoding:'utf8',timeout:5000});
  let found=lookup();
  if(found.status!==0){
    const key=(legacy??crypto.randomBytes(KEY_BYTES)).toString('base64');
    const add=spawnSync('security',['add-generic-password','-a',ACCOUNT,'-s',SERVICE,'-w',key,'-U'],{encoding:'utf8',timeout:5000});
    if(add.status!==0) throw new Error('macOS Keychain failed to store Hush root key');
    found=lookup();
  }
  const key=Buffer.from(String(found.stdout||'').trim(),'base64');
  if(found.status!==0||!validKey(key)) throw new Error('macOS Keychain failed to unlock Hush root key');
  return {key,backend:'macos-keychain',sealedPath:null};
}

function linuxSecretService(legacy){
  if(process.platform!=='linux'||!commandExists('secret-tool',['--help'])) return null;
  const lookup=()=>spawnSync('secret-tool',['lookup','service',SERVICE,'account',ACCOUNT],{encoding:'utf8',timeout:5000});
  let found=lookup();
  if(found.status!==0||!String(found.stdout||'').trim()){
    const key=(legacy??crypto.randomBytes(KEY_BYTES)).toString('base64');
    const add=spawnSync('secret-tool',['store','--label=Hush local root key','service',SERVICE,'account',ACCOUNT],{input:key,encoding:'utf8',timeout:5000});
    if(add.status!==0) throw new Error('Secret Service failed to store Hush root key');
    found=lookup();
  }
  const key=Buffer.from(String(found.stdout||'').trim(),'base64');
  if(found.status!==0||!validKey(key)) throw new Error('Secret Service failed to unlock Hush root key');
  return {key,backend:'linux-secret-service',sealedPath:null};
}

function restrictedFile(dir,legacy){
  const file=path.join(dir,'master.key');
  let key=legacy??readLegacy(file);
  if(!key){ key=crypto.randomBytes(KEY_BYTES); atomicWrite(file,key); }
  try{fs.chmodSync(file,0o600);}catch{}
  return {key,backend:'restricted-file',sealedPath:file};
}

/**
 * Returns the local root key plus the backing security mechanism. In production
 * mode, Hush refuses to silently fall back to a plaintext file unless the user
 * explicitly opts in via HUSH_ALLOW_FILE_KEY_FALLBACK=1.
 */
export function getOrCreatePlatformRootKey(dir,{production=process.env.NODE_ENV==='production',allowFileFallback=process.env.HUSH_ALLOW_FILE_KEY_FALLBACK==='1'}={}){
  fs.mkdirSync(dir,{recursive:true});
  const legacyPath=path.join(dir,'master.key');
  const legacy=readLegacy(legacyPath);
  let result=null;
  for(const attempt of [()=>windowsDpapi(dir,legacy),()=>macKeychain(legacy),()=>linuxSecretService(legacy)]){
    try{result=attempt(); if(result) break;}catch(error){ if(production&&!allowFileFallback) throw error; }
  }
  if(!result){
    if(production&&!allowFileFallback) throw new Error('No supported OS credential store is available. Production Hush will not use a plaintext root-key file.');
    result=restrictedFile(dir,legacy);
  }
  if(legacy&&result.backend!=='restricted-file'){
    try{fs.rmSync(legacyPath,{force:true});}catch{}
  }
  return {...result,migratedLegacy:Boolean(legacy&&result.backend!=='restricted-file')};
}

export function deriveContextPassphrase(rootKey){
  if(!validKey(rootKey)) throw new Error('A valid Hush root key is required');
  return Buffer.from(crypto.hkdfSync('sha256',rootKey,Buffer.from('hush-context-kernel-v1'),Buffer.from('local-context-passphrase'),32)).toString('base64url');
}
