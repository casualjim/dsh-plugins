/**
 * Emit the Typert host descriptor and its browser remote contribution from the
 * host face of this package.
 *
 * Layout shim: `WorkspaceAnalyzer` only discovers referenced TS projects whose
 * *real* path sits under `<root>/packages` (dsh-typert-generator lib/index.js
 * `loadRegistrations`), and this repository keeps its `dsh-*` packages at the
 * repository root — a symlink cannot help because the gate resolves real paths.
 * So we mirror exactly the analyzer inputs into a throwaway
 * `<tmp>/packages/dsh-worktrunk` workspace, analyze there with the real
 * generator, and write the emitted artifacts back into this package's `lib/`.
 */
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { FaceModelEmitter, WorkspaceAnalyzer } from '@deepseek-ai/dsh-typert-generator'

const packageDirectory = fileURLToPath(new URL('..', import.meta.url))
const outputDirectory = path.join(packageDirectory, 'lib')
const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'))
const packageName = manifest.name

for (const [subpath, expected] of Object.entries({
	'./typert': { types: './lib/typert.host.d.ts', default: './lib/typert.host.js' },
	'./remote': { types: './lib/typert.remote-client.d.ts', default: './lib/typert.remote-client.js' },
})) {
	const actual = manifest.exports?.[subpath]
	if (actual?.types !== expected.types || (actual.default ?? actual.import) !== expected.default) {
		throw new Error(`${subpath} must publish ${JSON.stringify(expected)} for Typert generation`)
	}
}

/** Exactly the inputs the analyzer and its TS program read, and nothing else. */
const scratchRoot = await mkdtemp(path.join(tmpdir(), 'dsh-worktrunk-typert-'))
const scratchPackage = path.join(scratchRoot, 'packages', packageName)

/**
 * The hoisted pnpm store leaves a second, older `@deepseek-ai/dsh-session` in
 * the program (reached through `dsh-agent` peers), and the analyzer rejects the
 * same `TypertLookupMap` key twice. A canonical monorepo has one session in the
 * graph, so pin every session specifier to the installed version this package
 * depends on. Scratch-only: the real `tsconfig.host.json` is untouched.
 */
const hostConfig = JSON.parse(await readFile(path.join(packageDirectory, 'tsconfig.host.json'), 'utf8'))
const session = './node_modules/@deepseek-ai/dsh-session'
hostConfig.compilerOptions = {
	...hostConfig.compilerOptions,
	paths: {
		...hostConfig.compilerOptions?.paths,
		'@deepseek-ai/dsh-session': [`${session}/lib/types/index.d.ts`],
		'@deepseek-ai/dsh-session/types': [`${session}/lib/types/types.d.ts`],
		'@deepseek-ai/dsh-session/invariant': [`${session}/lib/types/invariant.d.ts`],
		'@deepseek-ai/dsh-session/surface': [`${session}/lib/types/surface.d.ts`],
		'@deepseek-ai/dsh-session/src/*': [`${session}/src/*`],
	},
}

let artifact
try {
	await mkdir(path.join(scratchPackage, 'scripts'), { recursive: true })
	await Promise.all([
		...['package.json', 'tsconfig.json'].map(file =>
			cp(path.join(packageDirectory, file), path.join(scratchPackage, file)),
		),
		writeFile(path.join(scratchPackage, 'tsconfig.host.json'), `${JSON.stringify(hostConfig, undefined, 2)}\n`),
	])
	await cp(path.join(packageDirectory, 'src'), path.join(scratchPackage, 'src'), { recursive: true })
	await cp(
		path.join(packageDirectory, 'scripts', 'typert-protocol-meta.d.ts'),
		path.join(scratchPackage, 'scripts', 'typert-protocol-meta.d.ts'),
	)
	// Module resolution for the protocol/zod imports must work from the copy.
	await symlink(path.join(packageDirectory, 'node_modules'), path.join(scratchPackage, 'node_modules'), 'junction')

	const workspace = new WorkspaceAnalyzer({
		root: scratchRoot,
		hostConfig: `packages/${packageName}/tsconfig.host.json`,
		faces: ['host'],
		packages: [packageName],
	}).analyze()

	const face = workspace.faces.find(candidate => candidate.face === 'host')
	if (face === undefined) throw new Error('Typert did not discover the host face')
	artifact = new FaceModelEmitter(face).emit(packageName)
	if (artifact.remote === undefined) throw new Error('Typert did not generate a Remote contribution')
} finally {
	await rm(scratchRoot, { recursive: true, force: true })
}

const outputs = [
	['typert.host.js', artifact.js],
	['typert.host.d.ts', artifact.dts],
	['typert.remote-client.js', artifact.remote.js],
	['typert.remote-client.d.ts', artifact.remote.dts],
	...(artifact.remote.dtsMap === undefined ? [] : [['typert.remote-client.d.ts.map', artifact.remote.dtsMap]]),
]

await mkdir(outputDirectory, { recursive: true })
await Promise.all(outputs.map(([file, contents]) => writeFile(path.join(outputDirectory, file), contents)))
console.log(`dsh-worktrunk: typert artifacts emitted for ${packageName}`)
