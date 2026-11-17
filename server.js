import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CENTER, prospects, query } from './scout.js';

const cache = new Map();
export function createServer(fetchData = fetch) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.writeHead(405); return res.end('Method not allowed'); }
    if (url.pathname === '/api/prospects') {
      res.setHeader('Content-Type', 'application/json');
      const radius = Number(url.searchParams.get('radius') || 10);
      if (![5, 10, 20].includes(radius)) { res.writeHead(400); return res.end(JSON.stringify({error:'Choose a radius of 5, 10, or 20 km.'})); }
      const hit = cache.get(radius);
      if (hit && Date.now() - hit.time < 900000) return res.end(JSON.stringify(hit.data));
      try {
        const response = await fetchData('https://overpass-api.de/api/interpreter', {
          method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body: new URLSearchParams({data:query(radius)}), signal:AbortSignal.timeout(35000)
        });
        if (!response.ok) throw new Error(`Map provider returned ${response.status}`);
        const body = await response.json();
        if (body.remark || !Array.isArray(body.elements)) throw new Error('Map provider returned incomplete results');
        const data = { center:CENTER, radius, fetchedAt:new Date().toISOString(), source:'OpenStreetMap via Overpass', prospects:prospects(body.elements, radius) };
        cache.set(radius, {time:Date.now(), data});
        return res.end(JSON.stringify(data));
      } catch {
        res.writeHead(502); return res.end(JSON.stringify({error:'The map data service is unavailable or timed out. Try again shortly. No results have been invented.'}));
      }
    }
    const files = {'/':'index.html', '/app.js':'app.js', '/style.css':'style.css'};
    const file = files[url.pathname];
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    try {
      const content = await readFile(new URL(`./public/${file}`, import.meta.url));
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(content);
    } catch { res.writeHead(500); res.end('Unable to load application'); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Vending Scout listening on port ' + (process.env.PORT || 3000)));
}
