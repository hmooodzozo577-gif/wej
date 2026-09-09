import assert from 'node:assert/strict';
import worker from '../server/worker.mjs';
const original=globalThis.fetch;let calls=0;
globalThis.fetch=async url=>{calls++;assert(String(url).startsWith('https://www.youtube.com/oembed?'));return new Response(JSON.stringify({title:'A <video> title',html:'<script>bad</script>'}));};
try{
const bad=await worker.fetch(new Request('https://vibe-social-nights.bb0949.chatgpt.site/api/video-preview?id=https://localhost'));
assert.equal(bad.status,400);assert.equal(calls,0);
const good=await worker.fetch(new Request('https://vibe-social-nights.bb0949.chatgpt.site/api/video-preview?id=M7lc1UVf-VE'));
assert.deepEqual(await good.json(),{title:'A <video> title'});assert.equal(calls,1);
const cached=await worker.fetch(new Request('https://vibe-social-nights.bb0949.chatgpt.site/api/video-preview?id=M7lc1UVf-VE'));assert.equal(cached.status,200);assert.equal(calls,1);
console.log('PASS: preview identifier validation, fixed upstream, title-only response. Upstream mocked.');
}finally{globalThis.fetch=original;}
