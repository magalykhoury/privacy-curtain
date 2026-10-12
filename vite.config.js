import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: false,
  server: { host: '127.0.0.1' },
  plugins: [react(), {
    name: 'local-extension-files',
    generateBundle() {
      const manifest = JSON.parse(readFileSync(new URL('./public/manifest.json', import.meta.url), 'utf8'));
      if (mode === 'development') {
        manifest.name = 'Privacy Curtain Dev';
        manifest.version_name = `${manifest.version} development — isolated testing`;
        manifest.action.default_title = 'Privacy Curtain Dev';
      }
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(manifest, null, 2) });
      for (const file of ['shared.js', 'content.js', 'background.js', 'assets/16.png', 'assets/32.png', 'assets/48.png', 'assets/128.png']) {
        this.emitFile({ type: 'asset', fileName: file, source: readFileSync(new URL(`./public/${file}`, import.meta.url)) });
      }
      this.emitFile({ type: 'asset', fileName: 'assets/bootstrap-icons-LICENSE.txt', source: readFileSync(new URL('./src/icons/LICENSE', import.meta.url)) });
    },
  }],
  build: {
    outDir: mode === 'development' ? 'builds/development-v2' : 'builds/production-v2',
    // Preserve existing dist and release archives, including any earlier build outputs.
    emptyOutDir: false,
  },
}));
