'use strict';

// ChaCha20 — idéntico ao msg_cipher.hpp da DLL
// CHAVE: deve ser igual aos blocos em get_key() de msg_cipher.hpp

const KEY_HEX = 'A3F7C2E19B4D60825E8A1F3CD0B276947F1E4A8D3C906B2FE5D41807B9620FAC';
const KEY     = Buffer.from(KEY_HEX, 'hex');
const MAGIC   = Buffer.from([0xAB, 0xCD, 0x12, 0x34]);

let g_ctr = BigInt(1);

function rotl32(v, n) { return ((v << n) | (v >>> (32 - n))) >>> 0; }

function chacha20Block(key, counter) {
  const s = new Uint32Array(16);
  s[0]=0x61707865; s[1]=0x3320646e; s[2]=0x79622d32; s[3]=0x6b206574;
  for (let i=0;i<8;i++) s[4+i]=key.readUInt32LE(i*4);
  s[12]=Number(counter & BigInt(0xFFFFFFFF));
  s[13]=Number((counter>>BigInt(32)) & BigInt(0xFFFFFFFF));
  s[14]=0; s[15]=0;
  const x=new Uint32Array(s);
  for (let i=0;i<10;i++){
    x[0]=(x[0]+x[4])>>>0;x[12]=rotl32(x[12]^x[0],16);x[8]=(x[8]+x[12])>>>0;x[4]=rotl32(x[4]^x[8],12);x[0]=(x[0]+x[4])>>>0;x[12]=rotl32(x[12]^x[0],8);x[8]=(x[8]+x[12])>>>0;x[4]=rotl32(x[4]^x[8],7);
    x[1]=(x[1]+x[5])>>>0;x[13]=rotl32(x[13]^x[1],16);x[9]=(x[9]+x[13])>>>0;x[5]=rotl32(x[5]^x[9],12);x[1]=(x[1]+x[5])>>>0;x[13]=rotl32(x[13]^x[1],8);x[9]=(x[9]+x[13])>>>0;x[5]=rotl32(x[5]^x[9],7);
    x[2]=(x[2]+x[6])>>>0;x[14]=rotl32(x[14]^x[2],16);x[10]=(x[10]+x[14])>>>0;x[6]=rotl32(x[6]^x[10],12);x[2]=(x[2]+x[6])>>>0;x[14]=rotl32(x[14]^x[2],8);x[10]=(x[10]+x[14])>>>0;x[6]=rotl32(x[6]^x[10],7);
    x[3]=(x[3]+x[7])>>>0;x[15]=rotl32(x[15]^x[3],16);x[11]=(x[11]+x[15])>>>0;x[7]=rotl32(x[7]^x[11],12);x[3]=(x[3]+x[7])>>>0;x[15]=rotl32(x[15]^x[3],8);x[11]=(x[11]+x[15])>>>0;x[7]=rotl32(x[7]^x[11],7);
    x[0]=(x[0]+x[5])>>>0;x[15]=rotl32(x[15]^x[0],16);x[10]=(x[10]+x[15])>>>0;x[5]=rotl32(x[5]^x[10],12);x[0]=(x[0]+x[5])>>>0;x[15]=rotl32(x[15]^x[0],8);x[10]=(x[10]+x[15])>>>0;x[5]=rotl32(x[5]^x[10],7);
    x[1]=(x[1]+x[6])>>>0;x[12]=rotl32(x[12]^x[1],16);x[11]=(x[11]+x[12])>>>0;x[6]=rotl32(x[6]^x[11],12);x[1]=(x[1]+x[6])>>>0;x[12]=rotl32(x[12]^x[1],8);x[11]=(x[11]+x[12])>>>0;x[6]=rotl32(x[6]^x[11],7);
    x[2]=(x[2]+x[7])>>>0;x[13]=rotl32(x[13]^x[2],16);x[8]=(x[8]+x[13])>>>0;x[7]=rotl32(x[7]^x[8],12);x[2]=(x[2]+x[7])>>>0;x[13]=rotl32(x[13]^x[2],8);x[8]=(x[8]+x[13])>>>0;x[7]=rotl32(x[7]^x[8],7);
    x[3]=(x[3]+x[4])>>>0;x[14]=rotl32(x[14]^x[3],16);x[9]=(x[9]+x[14])>>>0;x[4]=rotl32(x[4]^x[9],12);x[3]=(x[3]+x[4])>>>0;x[14]=rotl32(x[14]^x[3],8);x[9]=(x[9]+x[14])>>>0;x[4]=rotl32(x[4]^x[9],7);
  }
  const out=Buffer.alloc(64);
  for(let i=0;i<16;i++) out.writeUInt32LE((x[i]+s[i])>>>0,i*4);
  return out;
}

function xor(key, counter, data) {
  const out=Buffer.alloc(data.length);
  let pos=0,blk=BigInt(0);
  while(pos<data.length){
    const ks=chacha20Block(key,counter+blk);
    const chunk=Math.min(data.length-pos,64);
    for(let i=0;i<chunk;i++) out[pos+i]=data[pos+i]^ks[i];
    pos+=chunk; blk++;
  }
  return out;
}

function encrypt(json) {
  const ctr=g_ctr++;
  const plain=Buffer.from(json,'utf8');
  const enc=xor(KEY,ctr,plain);
  const pkt=Buffer.alloc(12+enc.length);
  MAGIC.copy(pkt,0);
  let c=ctr;
  for(let i=0;i<8;i++){pkt[4+i]=Number(c&BigInt(0xFF));c>>=BigInt(8);}
  enc.copy(pkt,12);
  return pkt.toString('base64');
}

function decrypt(b64) {
  const pkt=Buffer.from(b64,'base64');
  if(pkt.length<13||!pkt.slice(0,4).equals(MAGIC)) return null;
  let ctr=BigInt(0);
  for(let i=7;i>=0;i--) ctr=(ctr<<BigInt(8))|BigInt(pkt[4+i]);
  return xor(KEY,ctr,pkt.slice(12)).toString('utf8');
}

function isCiphered(b64) {
  try{const h=Buffer.from(b64.slice(0,16),'base64');return h.length>=4&&h.slice(0,4).equals(MAGIC);}
  catch{return false;}
}

module.exports = { encrypt, decrypt, isCiphered };
