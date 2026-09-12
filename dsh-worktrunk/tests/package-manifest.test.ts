import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

describe('package manifest', () => {
	it('publishes the host, contract, client, typert, and remote entrypoints', () => {
		expect(Object.keys(manifest.exports)).toEqual(expect.arrayContaining(['.', './client', './typert', './remote', './package.json']))
		expect(manifest.exports['./typert'].default).toBe('./lib/typert.host.js')
		expect(manifest.exports['./remote'].default).toBe('./lib/typert.remote-client.js')
		expect(manifest.exports['./client'].default).toBe('./lib/client.js')
	})

	it('declares the web client half with its injected services', () => {
		expect(manifest.dsh.client.platform).toBe('web')
		expect(manifest.dsh.client.inject).toEqual(expect.arrayContaining([
			'@deepseek-ai/dsh-client-store',
			'@deepseek-ai/dsh-client-ui-slots',
			'@deepseek-ai/dsh-client-ui-layout',
			'@deepseek-ai/dsh-client-ui-sidebar',
			'@deepseek-ai/dsh-client-ui-renderer',
			'@deepseek-ai/dsh-api-workspace-controller',
			'@deepseek-ai/dsh-client-connection',
		]))
		expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
	})

	it('pins the installed DSH contract family in devDependencies', () => {
		expect(manifest.devDependencies['@deepseek-ai/dsh-typert-protocol']).toBe('0.1.5-rc.1')
		expect(manifest.devDependencies['@deepseek-ai/dsh-typert-generator']).toBe('0.1.5-rc.1')
	})

	it('builds the client and the typert artifacts from source', () => {
		expect(manifest.scripts.build).toContain('generate-typert.mjs')
		expect(manifest.scripts.build).toContain('build-client.mjs')
	})
})
