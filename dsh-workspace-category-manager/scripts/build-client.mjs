// Build the browser client bundle: src/client/* → lib/client.js (Dsh module-table contract).
// The bundle is a single CJS closure registered through window.__ModuleLoader__.load({ id, factory }).
// `react` stays external (the module table provides it); CSS is inlined and injected as a
// <style data-plugin-css> tag matching dsh's own compiled-artifact convention.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const id = 'dsh-workspace-category-manager';

await build({
  entryPoints: [join(root, 'src/client/index.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  outfile: join(root, 'lib/client.js'),
  sourcemap: false,
  external: ['react', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'text' },
  jsx: 'automatic',
  banner: { js: `window.__ModuleLoader__.load({ id: "${id}", factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info',
});
console.log('built lib/client.js');
