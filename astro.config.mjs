import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://hansakoch.com',
  output: 'static',
  build: {
    assets: 'assets',
  },
  server: {
    port: 4321,
  },
});
