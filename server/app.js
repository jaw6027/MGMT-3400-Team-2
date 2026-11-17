import express from 'express';
import { resolve } from 'node:path';
import { discover } from './discovery.js';

export function createApp(store, discoverPlaces = discover) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  // Same-origin mutations only; public deployment still requires authentication.
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin changes are not allowed.' });
    }
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/candidates', (_req, res) => res.json(store.all()));
  app.post('/api/candidates', (req, res) => {
    let source;
    if (req.body.discoveryKey) {
      const place = cachedPlaces?.find(p => p.key === req.body.discoveryKey);
      if (!place) return res.status(400).json({ error: 'Run public map search again before saving this listing.' });
      const existing = store.all().find(p => p.source.key === place.key);
      if (existing) return res.status(409).json({ error: 'This listing is already in your workspace.' });
      source = place.source;
      // Imported listings start with no field observations, regardless of submitted values.
      return res.status(201).json(store.create({ name: place.name, address: place.address, category: place.category, lat: place.lat, lng: place.lng }, source));
    }
    res.status(201).json(store.create(req.body));
  });
  app.put('/api/candidates/:id', (req, res) => {
    const result = store.update(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'Location not found.' });
    res.json(result);
  });
  app.delete('/api/candidates/:id', (req, res) => {
    if (!store.remove(req.params.id, req.body.updatedAt)) return res.status(404).json({ error: 'Location not found.' });
    res.status(204).end();
  });
  let cachedPlaces;
  let cachedAt = 0;
  let pending;
  let lastAttempt = 0;
  app.get('/api/discover', async (_req, res, next) => {
    try {
      if (cachedPlaces && Date.now() - cachedAt < 15 * 60000) return res.json({ places: cachedPlaces, fetchedAt: new Date(cachedAt).toISOString() });
      if (!pending && Date.now() - lastAttempt < 30000) return res.status(429).json({ error: 'Please wait 30 seconds between public map searches.' });
      if (!pending) {
        lastAttempt = Date.now();
        pending = discoverPlaces().then(places => { cachedPlaces = places; cachedAt = Date.now(); return places; }).finally(() => { pending = null; });
      }
      const places = await pending;
      res.json({ places, fetchedAt: new Date(cachedAt).toISOString() });
    } catch (error) { error.status = 502; next(error); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use((error, _req, res, _next) => res.status(error.status ?? 400).json({ error: error.message || 'The request could not be completed.' }));
  return app;
}

export async function attachFrontend(app) {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    return vite;
  }
}
