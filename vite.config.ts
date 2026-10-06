import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(version) },
  // Listening on every interface serves three needs at once: localhost, the 127.0.0.1 loopback that Spotify demands for authorization, and the wall tablet on the local network.
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 4173, strictPort: true },
  plugins: [react(), VitePWA({ registerType: 'prompt', includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'], manifest: {
    name: 'Domoryx — Maison connectée', short_name: 'Domoryx', description: 'Le tableau de bord sensible de votre maison.',
    theme_color: '#101315', background_color: '#101315', display: 'standalone', orientation: 'landscape', start_url: '/', icons: [
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }, workbox: { navigateFallbackDenylist: [/^\/api\//], globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'], runtimeCaching: [] } })]
});
