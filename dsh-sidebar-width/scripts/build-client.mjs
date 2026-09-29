// 浏览器半区打包：src/client/index.js → lib/client.js（DSH module-table 契约）。
// 产物是单个 CJS 闭包，通过 window.__ModuleLoader__.load({ id, factory }) 注册；
// `react` / `react/jsx-runtime` 保持 external（宿主 module table 提供）。
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)) + '/..';
const id = 'dsh-sidebar-width';

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
  jsx: 'automatic',
  banner: { js: `window.__ModuleLoader__.load({ id: "${id}", factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
  logLevel: 'info',
});
console.log('built lib/client.js');
