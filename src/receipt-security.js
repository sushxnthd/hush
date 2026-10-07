import crypto from 'node:crypto';
import { canonicalize, sha256 } from './core.js';

function messageFor(receipt){
  return Buffer.from(`hush-receipt-v1:${receipt.hash}`,'utf8');
}

export function signReceipt(receipt,privateKey){
  if(!receipt?.hash||!privateKey) throw new Error('Receipt hash and signing key are required');
  const signature=crypto.sign(null,messageFor(receipt),privateKey).toString('base64url');
  return {...receipt,signatureAlgorithm:'ed25519',signature};
}

export function verifyReceiptSignature(receipt,publicKey){
  if(!receipt?.signature||receipt.signatureAlgorithm!=='ed25519'||!publicKey) return false;
  try{return crypto.verify(null,messageFor(receipt),publicKey,Buffer.from(receipt.signature,'base64url'));}
  catch{return false;}
}

function recomputeHash(receipt){
  const {hash,signature,signatureAlgorithm,...body}=receipt;
  return sha256(canonicalize(body));
}

/**
 * Verifies the hash chain and every signed receipt. A historical unsigned prefix
 * may be accepted during migration, but once the first signed receipt appears,
 * no later unsigned receipt is allowed. The first signed receipt therefore acts
 * as an authenticity anchor over the preceding chain's final hash.
 */
export function verifySignedReceiptChain(receipts,publicKey,{allowLegacyPrefix=true}={}){
  let previous=null;
  let signedStarted=false;
  let signed=0;
  let legacyUnsigned=0;
  for(const receipt of receipts){
    if(receipt.previousHash!==previous||recomputeHash(receipt)!==receipt.hash) return {valid:false,signed,legacyUnsigned,reason:'hash-chain'};
    if(receipt.signature){
      signedStarted=true;
      if(!verifyReceiptSignature(receipt,publicKey)) return {valid:false,signed,legacyUnsigned,reason:'signature'};
      signed++;
    }else{
      legacyUnsigned++;
      if(signedStarted||!allowLegacyPrefix) return {valid:false,signed,legacyUnsigned,reason:'unsigned-receipt'};
    }
    previous=receipt.hash;
  }
  return {valid:true,signed,legacyUnsigned,anchored:signed>0,total:receipts.length};
}
