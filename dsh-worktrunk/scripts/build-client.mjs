/**
 * Bundle the browser half into the closure-factory artifact DSH's client module
 * loader expects. Externals resolve through the loader's injected require table;
 * only local files are inlined.
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const EXTERNALS = [
	'react',
	'react/jsx-runtime',
	'react-dom',
	'@deepseek-ai/cordis',
	'@deepseek-ai/dsh-client-store',
	'@deepseek-ai/dsh-client-locale',
	'@deepseek-ai/dsh-client-locale/client',
	'@deepseek-ai/dsh-client-connection',
	'@deepseek-ai/dsh-client-connection/client',
	'@deepseek-ai/dsh-client-ui-primitives',
	'@deepseek-ai/dsh-client-ui-slots',
	'@deepseek-ai/dsh-client-ui-layout',
	'@deepseek-ai/dsh-client-ui-layout/client',
	'@deepseek-ai/dsh-client-ui-sidebar',
	'@deepseek-ai/dsh-client-ui-sidebar/client',
	'@deepseek-ai/dsh-api-session-controller',
	'@deepseek-ai/dsh-api-session-controller/client',
]

const banner = `window.__ModuleLoader__.load({
  id: "dsh-worktrunk",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`
const footer = `    return module.exports;
  },
});
`

const result = await build({
	entryPoints: [resolve(root, 'src/client/entry.ts')],
	outfile: resolve(root, 'lib/client.js'),
	bundle: true,
	format: 'cjs',
	platform: 'browser',
	target: 'es2022',
	jsx: 'automatic',
	// The panel's stylesheet is inlined as a text export and injected from `apply`.
	loader: { '.css': 'text' },
	external: EXTERNALS,
	logLevel: 'warning',
	write: false,
})

const code = result.outputFiles[0].text
mkdirSync(resolve(root, 'lib'), { recursive: true })
writeFileSync(resolve(root, 'lib/client.js'), banner + code + footer)
console.log(`dsh-worktrunk client bundle: ${code.split('\n').length} lines -> lib/client.js`)
