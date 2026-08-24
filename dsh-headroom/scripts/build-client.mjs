/**
 * Bundle the browser half of dsh-headroom into the closure-factory artifact
 * the client module loader expects:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *
 * Externals (@deepseek-ai/* client modules, react) resolve through the
 * loader's injected `require` module table; only local files are inlined.
 * Mirrors the harness `tsdown.client.ts` preset's output contract without
 * importing harness-internal build scripts.
 */

import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const EXTERNALS = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-settings/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-api-remotes/client',
  '@deepseek-ai/dsh-api-remotes/types',
  '@deepseek-ai/dsh-settings/types',
  'react',
  'react/jsx-runtime',
  'react-dom',
]

const banner = `window.__ModuleLoader__.load({
  id: "dsh-headroom",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`

const footer = `    return module.exports;
  },
});
`

await build({
  entryPoints: [resolve(root, 'src/client/index.ts')],
  outfile: resolve(root, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: EXTERNALS,
  logLevel: 'warning',
  write: false,
}).then((result) => {
  const code = result.outputFiles[0].text
  mkdirSync(resolve(root, 'lib'), { recursive: true })
  writeFileSync(resolve(root, 'lib/client.js'), banner + code + footer)
  return code
}).then((code) => {
  console.log(`dsh-headroom client bundle: ${code.split('\n').length} lines -> lib/client.js`)
})
