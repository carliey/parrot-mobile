import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.EXPO_PUBLIC_API_URL='http://test.local';
const { RealTutor }=await import('../src/lib/practice.ts');

test('starting practice uses the real backend and sends validation fields',async()=>{
  const original=globalThis.fetch;let requestBody;
  globalThis.fetch=async(_url,request)=>{
    requestBody=JSON.parse(request.body);
    return {ok:true,json:async()=>({session_id:'s',access_token:'secret',provider_mode:'real',initial_tutor_message:'Sannu'})};
  };
  try{
    const session=await new RealTutor().start('greetings',true,'P01');
    assert.equal(session.provider_mode,'real');
    assert.deepEqual(requestBody,{topic:'greetings',consent:true,participant_id:'P01'});
  }finally{globalThis.fetch=original;}
});

test('real turn retry preserves ID and draft on failure',async()=>{
  const calls=[];const original=globalThis.fetch;let fails=true;
  globalThis.fetch=async(_url,request)=>{
    calls.push(JSON.parse(request.body));
    if(fails) return {ok:false,status:503,json:async()=>({detail:{message:'Tutor unavailable'}})};
    return {ok:true,json:async()=>({turn_id:'stable',tutor_response:'Lafiya lau',processing_ms:20,provider_mode:'real'})};
  };
  try{
    const service=new RealTutor();const session={session_id:'s',access_token:'secret',provider_mode:'real',initial_tutor_message:'Sannu'};
    await assert.rejects(service.turn(session,'stable','Sannu'),/Tutor unavailable/);
    fails=false;
    const result=await service.turn(session,'stable','Sannu');
    assert.equal(result.tutor_response,'Lafiya lau');
    assert.deepEqual(calls,[{turn_id:'stable',text:'Sannu'},{turn_id:'stable',text:'Sannu'}]);
  }finally{globalThis.fetch=original;}
});
