import react from '@vitejs/plugin-react';
import { isBuiltin } from 'node:module';
import { defineConfig, type Plugin } from 'vite';

/**
 * Fails the build when a Node builtin reaches the browser module graph.
 *
 * Vite externalizes such a module into a stub whose every property read throws,
 * and the throw happens while the module graph evaluates. The dashboard then
 * renders nothing, and no other check notices: the tests run in Node, where the
 * builtin resolves. The resolver already walks the full graph, so this guard
 * catches a transitive import that no grep over the barrels would find.
 */
const guardNodeBuiltins = (): Plugin => ({
  name: 'guard-node-builtins',
  enforce: 'pre',
  resolveId(source: string, importer: string | undefined) {
    // The importer is undefined for an entry, which is never a Node builtin.
    if (importer !== undefined && (source.startsWith('node:') || isBuiltin(source))) {
      this.error(`The Node builtin "${source}" reached the browser graph from ${importer}. A module the dashboard imports must not need a Node capability.`);
    }
    return null;
  },
});

export default defineConfig({
  plugins: [guardNodeBuiltins(), react()],
  build: {
    // The Express production mount serves this directory, which sits outside the
    // Vite root, so Vite leaves it in place unless emptyOutDir is explicit.
    emptyOutDir: true,
    outDir: '../dist/dashboard/dist',
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
});
