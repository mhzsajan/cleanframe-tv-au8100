import { defineConfig, type Plugin } from 'vite';

/**
 * The TV runs Tizen 6.0, which ships a Chromium 76 engine on 32-bit ARM.
 * Everything is compiled to that target: modern source, conservative output.
 */

/** Emit a plain classic script: a widget loads from a custom scheme where
 *  module scripts can be refused for CORS reasons. */
function classicScript(): Plugin {
  return {
    name: 'classic-script',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin /g, '<script ')
        .replace(/ crossorigin(?= href=)/g, '');
    },
  };
}

export default defineConfig({
  // A Tizen widget is loaded from a package-relative origin, so every emitted
  // URL must be relative rather than rooted at `/`.
  base: './',
  publicDir: 'public',
  plugins: [classicScript()],
  build: {
    outDir: 'app',
    emptyOutDir: true,
    // `assets/` is reserved for the photograph and icon catalogue, so compiled
    // output goes to `build/` to avoid clobbering it.
    assetsDir: 'build',
    target: 'chrome76',
    cssTarget: 'chrome76',
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'build/[name]-[hash].js',
      },
    },
  },
  server: {
    port: 4796,
    strictPort: true,
  },
});
