import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The existing public/ directory belongs to the standalone Vending Scout app.
export default defineConfig({ publicDir: false, plugins: [react()] });
