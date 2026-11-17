import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { prospects, CENTER } from '../scout.js';
import { createServer } from '../server.js';
const site = (id, tags, other={}) => ({type:'node',id,...CENTER,tags,...other});

test('ranking explains fit without claiming an unserved location', () => {
  const result = prospects([site(1,{name:'Clinic',amenity:'clinic'}),site(2,{name:'Laundry',shop:'laundry',opening_hours:'24/7',phone:'123'})],10);
  assert.equal(result[0].name,'Laundry');
  assert.equal(result[0].score,80);
  assert.equal(result[0].vending,'Existing vending service unknown');
  assert.match(result[0].scoreDetails,/Category 65/);
});
test('filters remote and invalid points; supports way centers and vending evidence', () => {
  const results = prospects([site(1,{office:'company'},{lat:0,lon:0}),{type:'way',id:2,center:CENTER,tags:{building:'warehouse',vending:'drinks'}},{type:'node',id:3,tags:{office:'company'}},site(4,{amenity:'vending_machine'})],5);
  assert.equal(results.length,1);
  assert.equal(results[0].category,'Workplaces');
  assert.match(results[0].vending,/mentioned/);
});
test('HTTP workflow serves app, transforms provider records, rejects invalid radius and paths', async t => {
  let calls = 0;
  const server = createServer(async (url, options) => {
    calls++;
    assert.equal(url,'https://overpass-api.de/api/interpreter');
    assert.match(options.body.get('data'),/around:5000,34.6868,-118.1542/);
    return {ok:true,json:async()=>({elements:[site(1,{name:'Test workplace',office:'company'})]})};
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.match(await (await fetch(base)).text(),/Find places with potential/);
  const result = await (await fetch(base+'/api/prospects?radius=5')).json();
  assert.equal(result.prospects[0].name,'Test workplace');
  await fetch(base+'/api/prospects?radius=5'); assert.equal(calls,1);
  assert.equal((await fetch(base+'/api/prospects?radius=500')).status,400);
  assert.equal((await fetch(base+'/server.js')).status,404);
});
test('provider failure is reported without fabricated prospects',async t=>{
  const server=createServer(async()=>{throw new Error('offline');});
  server.listen(0,'127.0.0.1'); await once(server,'listening'); t.after(()=>server.close());
  const result=await fetch(`http://127.0.0.1:${server.address().port}/api/prospects?radius=20`);
  assert.equal(result.status,502); assert.match((await result.json()).error,/unavailable/);
});
