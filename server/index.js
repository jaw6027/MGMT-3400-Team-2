import { resolve } from 'node:path';
import { createStore } from './store.js';
import { createApp, attachFrontend } from './app.js';

const store = createStore(process.env.DB_PATH || resolve('data/vendwell.sqlite'));
const app = createApp(store);
const vite = await attachFrontend(app);
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '0.0.0.0', () => console.log(`Vendwell listening on port ${port} (${process.env.NODE_ENV || 'development'})`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => { await vite?.close(); store.close(); process.exit(0); }));
