import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore, validate } from '../server/store.js';
import { createApp } from '../server/app.js';
import { parsePlaces } from '../server/discovery.js';
import { assess, nextStep } from '../src/model.js';

test('unknown observations do not manufacture demand or a service gap', () => {
  const candidate = validate({ name: 'Unresearched site' });
  assert.equal(assess(candidate).score, 0);
  assert.equal(assess(candidate).coverage, 0);
  assert.equal(assess(candidate).label, 'Needs research');
  assert.match(nextStep(candidate), /existing vending service/);
});

test('rubric caps each input and distinguishes unknown from observed zero', () => {
  const full = validate({ name: 'Site', dailyPeople: 10000, dwellMinutes: 120, openHours: 24, service: 'none', power: 'yes', stage: 'Approved' });
  assert.equal(assess(full).score, 100);
  assert.equal(assess(full).coverage, 100);
  assert.equal(assess(full).label, 'Worth a visit');
  assert.equal(assess({ ...full, service: 'served' }).score, 75);
  assert.equal(assess({ ...full, service: 'served' }).label, 'Already well served');
  assert.equal(assess({ ...full, service: 'unknown' }).label, 'Verify vending gap');
  assert.equal(assess({ ...full, dailyPeople: 0 }).score, 70);
  assert.equal(assess({ ...full, dailyPeople: 0 }).coverage, 100);
  assert.equal(assess({ ...full, service: 'limited' }).score, 90);
});

test('location validation enforces Lancaster bounds and rejects malformed values', () => {
  for (const invalid of [{ name: '' }, { name: 'Site', lat: 34.68 }, { name: 'Site', lat: 40, lng: -118.15 }, { name: 'Site', openHours: 25 }, { name: 'Site', dailyPeople: -1 }, { name: 'Site', service: 'invented' }, { name: 'Site', power: true }, { name: 'Site', notes: 'a'.repeat(5001) }]) assert.throws(() => validate(invalid));
  assert.equal(validate({ name: ' Site ', lat: 34.68, lng: -118.15, dailyPeople: 0 }).dailyPeople, 0);
});

test('saved team data survives reopening and stale changes are rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vendwell-unit-'));
  const path = join(dir, 'test.sqlite');
  let store = createStore(path);
  try {
    const created = store.create({ name: 'Real field lead' });
    store.close(); store = createStore(path);
    assert.equal(store.get(created.id).name, 'Real field lead');
    const updated = store.update(created.id, { ...created, owner: 'Student A' });
    assert.equal(updated.owner, 'Student A');
    assert.notEqual(updated.updatedAt, created.updatedAt);
    assert.throws(() => store.update(created.id, { ...created, owner: 'Student B' }), /teammate/);
    assert.throws(() => store.remove(created.id, created.updatedAt), /changed/);
    assert.equal(store.remove(created.id, updated.updatedAt), true);
    assert.deepEqual(store.all(), []);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('OSM parsing preserves provenance and excludes out-of-area or unnamed records', () => {
  const result = parsePlaces({ elements: [
    { type: 'node', id: 123, lat: 34.68, lon: -118.15, tags: { name: 'Example public listing', shop: 'laundry', 'addr:housenumber': '123', 'addr:street': 'Test St' } },
    { type: 'way', id: 456, center: { lat: 34.69, lon: -118.17 }, tags: { name: 'Example auto shop', shop: 'car_repair' } },
    { type: 'node', id: 789, lat: 40, lon: -118.15, tags: { name: 'Outside area', office: 'yes' } },
    { type: 'node', id: 4, lat: 34.68, lon: -118.15, tags: { shop: 'laundry' } },
  ] });
  assert.equal(result.length, 2);
  assert.equal(result[0].category, 'Laundromat');
  assert.equal(result[0].address, '123 Test St');
  assert.equal(result[0].source.url, 'https://www.openstreetmap.org/node/123');
  assert.equal(result[1].category, 'Auto service');
  assert.equal(result[0].dailyPeople, undefined);
});

test('API supports shared CRUD, conflicts, verified import provenance, and duplicate prevention', async () => {
  const store = createStore(':memory:');
  let discoveries = 0;
  const places = parsePlaces({ elements: [{ type: 'node', id: 1, lat: 34.68, lon: -118.15, tags: { name: 'Fixture listing', shop: 'laundry' } }] });
  const app = createApp(store, async () => { discoveries++; return places; });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = 'GET', body, headers = {}) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
  }
  try {
    assert.equal((await request('/api/health')).data.status, 'ok');
    assert.deepEqual((await request('/api/candidates')).data, []);
    assert.equal((await request('/api/candidates', 'POST', { name: 'Bad', service: 'invalid' })).status, 400);
    assert.equal((await request('/api/candidates', 'POST', { name: 'Cross origin' }, { Origin: 'https://other.example' })).status, 403);
    const create = await request('/api/candidates', 'POST', { name: 'Field lead', service: 'none', source: { kind: 'osm' } });
    assert.equal(create.status, 201);
    assert.equal(create.data.source.kind, 'field');
    const updated = await request(`/api/candidates/${create.data.id}`, 'PUT', { ...create.data, starred: true, stage: 'Contacted' });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.starred, true);
    assert.equal((await request(`/api/candidates/${create.data.id}`, 'PUT', create.data)).status, 409);
    assert.equal((await request('/api/candidates', 'POST', { discoveryKey: 'node/1' })).status, 400);
    const discovered = await request('/api/discover');
    assert.equal(discovered.data.places.length, 1);
    await request('/api/discover'); assert.equal(discoveries, 1, 'discovery is cached');
    const imported = await request('/api/candidates', 'POST', { discoveryKey: 'node/1', dailyPeople: 900, service: 'none' });
    assert.equal(imported.status, 201);
    assert.equal(imported.data.source.kind, 'osm');
    assert.equal(imported.data.dailyPeople, null);
    assert.equal(imported.data.service, 'unknown');
    assert.equal((await request('/api/candidates', 'POST', { discoveryKey: 'node/1' })).status, 409);
    assert.equal((await request(`/api/candidates/${create.data.id}`, 'DELETE', { updatedAt: create.data.updatedAt })).status, 409);
    assert.equal((await request(`/api/candidates/${create.data.id}`, 'DELETE', { updatedAt: updated.data.updatedAt })).status, 204);
    assert.equal((await request('/api/candidates/missing', 'PUT', {})).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});

test('public provider failure is actionable and does not prevent manual scouting', async () => {
  const store = createStore(':memory:');
  const app = createApp(store, async () => { throw new Error('Provider unavailable. Add a location manually.'); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const failed = await fetch(base + '/api/discover'); assert.equal(failed.status, 502);
    assert.match((await failed.json()).error, /manually/);
    assert.equal((await fetch(base + '/api/discover')).status, 429);
    const created = await fetch(base + '/api/candidates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Manual lead' }) });
    assert.equal(created.status, 201);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});
