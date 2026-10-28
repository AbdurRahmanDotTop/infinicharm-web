import { defineConfig } from 'astro/config';

// Phase 1 is intentionally static. No server adapter is needed for this build.
// This lets us deploy the storefront to Cloudflare Pages with the dist/ directory.
export default defineConfig({
  site: 'https://www.infinicharm.com',
  output: 'static',
});
