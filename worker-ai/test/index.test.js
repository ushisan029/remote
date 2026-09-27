import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAgentStream,validateSummary,normalizeResult,trimFence,usageSummary} from '../src/index.js';

test('trimFence removes JSON markdown fences',()=>{
  assert.equal(trimFence('```json\n{"ok":true}\n```'),'{"ok":true}');
});

test('validateSummary accepts normal payload and rejects oversized arrays',()=>{
  const base={overall:{total:10},subjects:[]};
  assert.equal(validateSummary(base),true);
  assert.equal(validateSummary({...base,recent:Array.from({length:31},()=>({}))}),false);
  assert.equal(validateSummary(null),false);
});

test('normalizeResult filters invalid subjects and modes and clamps count',()=>{
  const result=normalizeResult({
    summary:'ok',
    priorities:[
      {subject:'industrial_general',reason:'a'},
      {subject:'invalid',reason:'b'}
    ],
    plan:[
      {subject:'machine_safety',mode:'weak',count:99,reason:'x'},
      {subject:'industrial_law',mode:'invalid',count:3,reason:'y'}
    ],
    message:'done'
  });
  assert.deepEqual(result.priorities,[{subject:'industrial_general',reason:'a'}]);
  assert.deepEqual(result.plan,[{subject:'machine_safety',mode:'weak',count:10,reason:'x'}]);
  assert.equal(result.message,'done');
});

test('parseAgentStream reads final text, completion and usage',()=>{
  const stream=[
    'data: '+JSON.stringify({type:'agent.session.turn.output_text.delta',session_id:'sess_1',turn_id:'turn_1',delta:'{"summary":"'}),
    'data: '+JSON.stringify({type:'agent.session.turn.output_text.done',session_id:'sess_1',turn_id:'turn_1',text:'{"summary":"ok","priorities":[],"plan":[],"message":""}'}),
    'data: '+JSON.stringify({type:'agent.session.turn.completed',session_id:'sess_1',turn:{id:'turn_1',usage:{input_tokens:100,input_tokens_details:{cached_tokens:20},output_tokens:25,output_tokens_details:{reasoning_tokens:5},total_tokens:125}}})
  ].join('\n\n');
  const parsed=parseAgentStream(stream);
  assert.equal(parsed.sessionId,'sess_1');
  assert.equal(parsed.turnId,'turn_1');
  assert.equal(parsed.completed,true);
  assert.match(parsed.text,/"summary":"ok"/);
  assert.deepEqual(usageSummary(parsed.usage),{inputTokens:100,cachedInputTokens:20,outputTokens:25,reasoningTokens:5,totalTokens:125});
});

test('parseAgentStream reports lifecycle failure',()=>{
  const stream='data: '+JSON.stringify({type:'agent.session.turn.failed',turn:{error:{message:'boom'}}});
  const parsed=parseAgentStream(stream);
  assert.equal(parsed.failure,'boom');
  assert.equal(parsed.completed,false);
});
