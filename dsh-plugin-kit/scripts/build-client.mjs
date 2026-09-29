// Build the browser client bundle: src/client/index.js → lib/client.js
// (Dsh module-table contract).
//
// The bundle is a single CJS closure registered through
// `window.__ModuleLoader__.load({ id, factory })`. `react` stays external —
// the module table provides it and the client half has no JSX transpilation,
// so the source only uses React.createElement. CSS lives inline in the
// source and is injected as a <style data-plugin-css> tag.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const id = 'dsh-plugin-kit';

await build({
  entryPoints: [join(root, 'src/client/index.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  outfile: join(root, 'lib/client.js'),
  sourcemap: false,
  external: ['react', 'react/jsx-runtime'],
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: `window.__ModuleLoader__.load({ id: "${id}", factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info',
});
console.log('built lib/client.js');
