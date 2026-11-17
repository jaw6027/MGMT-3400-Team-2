import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { categories, stages, serviceOptions, LANCASTER } from '../src/model.js';

export function validate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A location object is required.');
  const text = (name, max = 200) => {
    if (input[name] != null && typeof input[name] !== 'string') throw new Error(`${name} must be text.`);
    const value = (input[name] ?? '').trim();
    if (value.length > max) throw new Error(`${name} must be ${max} characters or fewer.`);
    return value;
  };
  const choice = (name, options, fallback) => {
    const value = input[name] ?? fallback;
    if (!options.includes(value)) throw new Error(`Choose a valid ${name}.`);
    return value;
  };
  const numeric = (name, min, max) => {
    if (input[name] == null || input[name] === '') return null;
    if (typeof input[name] !== 'number' || !Number.isFinite(input[name]) || input[name] < min || input[name] > max) throw new Error(`${name} must be between ${min} and ${max}.`);
    return input[name];
  };
  const name = text('name', 160);
  if (!name) throw new Error('A location name is required.');
  const lat = numeric('lat', LANCASTER.south, LANCASTER.north);
  const lng = numeric('lng', LANCASTER.west, LANCASTER.east);
  if ((lat == null) !== (lng == null)) throw new Error('Enter both latitude and longitude, or leave both blank.');
  return {
    name, category: choice('category', categories, 'Other'), address: text('address', 300),
    lat, lng, dailyPeople: numeric('dailyPeople', 0, 100000), dwellMinutes: numeric('dwellMinutes', 0, 1440),
    openHours: numeric('openHours', 0, 24), service: choice('service', Object.keys(serviceOptions), 'unknown'),
    power: choice('power', ['unknown', 'yes', 'no'], 'unknown'), stage: choice('stage', stages, 'To research'),
    contact: text('contact', 300), owner: text('owner', 100), notes: text('notes', 5000),
    evidence: text('evidence', 1000), starred: input.starred === true,
  };
}

export function createStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, body TEXT NOT NULL);');
  const all = () => db.prepare('SELECT body FROM candidates').all().map(row => JSON.parse(row.body));
  const get = id => { const row = db.prepare('SELECT body FROM candidates WHERE id=?').get(id); return row ? JSON.parse(row.body) : null; };
  const put = candidate => { db.prepare('INSERT OR REPLACE INTO candidates (id, body) VALUES (?, ?)').run(candidate.id, JSON.stringify(candidate)); return candidate; };
  return {
    all, get,
    create(input, source = { kind: 'field', label: 'Team-added location' }) {
      const now = new Date().toISOString();
      return put({ ...validate(input), id: randomUUID(), source, createdAt: now, updatedAt: now });
    },
    update(id, input) {
      const previous = get(id);
      if (!previous) return null;
      if (!input.updatedAt || input.updatedAt !== previous.updatedAt) {
        const error = new Error('Another teammate updated this location. Cancel, refresh the workspace, and reopen it to load their changes.');
        error.status = 409;
        throw error;
      }
      return put({ ...previous, ...validate(input), updatedAt: new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString() });
    },
    remove(id, updatedAt) {
      const previous = get(id);
      if (!previous) return false;
      if (updatedAt !== previous.updatedAt) { const error = new Error('This location changed. Refresh before deleting.'); error.status = 409; throw error; }
      db.prepare('DELETE FROM candidates WHERE id=?').run(id); return true;
    },
    close: () => db.close(),
  };
}
