import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.ts'
import { isDotenvPath } from '../src/guards/env-protect.ts'
import { getKubectlBlockReason } from '../src/guards/kubectl.ts'
import { getSopsBlockReason } from '../src/guards/sops.ts'
import { checkCommand, splitShellLines } from '../src/guards/command-policy.ts'
import type { CommandPolicy } from '../src/config.ts'
import { getSecretReference, redactOutput, type SecretGuardState } from '../src/guards/secret.ts'

describe('env-protect', () => {
  const blocked = ['.env', '.envrc', '.env.local', 'foo.env', 'sub/.env', '@.env', '.env.production']
  const allowed = ['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.defaults', 'env.example.txt', 'app.ts', '.environment']

  for (const p of blocked) it(`blocks ${p}`, () => { expect(isDotenvPath(p)).toBe(true) })
  for (const p of allowed) it(`allows ${p}`, () => { expect(isDotenvPath(p)).toBe(false) })
})

describe('kubectl-secret-guard', () => {
  const blocked = [
    'kubectl get secrets',
    'kubectl get secret my-secret -o yaml',
    'kubectl patch pvc x -p \'{"metadata":{"finalizers":null}}\'',
    'kubectl exec -it pod-1 -- printenv',
    'kubectl exec pod-1 -- cat /var/run/secrets/kubernetes.io/serviceaccount/token',
    'kubectl exec pod-1 -- cat /etc/gitea/app.ini',
  ]
  const allowed = ['kubectl get pods', 'kubectl apply -f deploy.yaml', 'kubectl describe pod x']

  for (const c of blocked) it(`blocks ${c}`, () => { expect(getKubectlBlockReason(c)).not.toBeNull() })
  for (const c of allowed) it(`allows ${c}`, () => { expect(getKubectlBlockReason(c)).toBeNull() })
})

describe('sops-secret-guard', () => {
  const blocked = [
    'sops decrypt secrets.yaml',
    'sops -d secrets.yaml',
    'sops --decrypt secrets.yaml',
    'sops exec-env secrets.env cmd',
    'sops exec-file secrets.yaml cmd',
    'sops edit secrets.yaml',
    'sops secrets.yaml',
  ]
  const allowed = ['sops encrypt secrets.yaml', 'sops --version', 'sops -v', 'sops help', 'sops updatekeys', 'sops -r secrets.yaml']

  for (const c of blocked) it(`blocks ${c}`, () => { expect(getSopsBlockReason(c)).not.toBeNull() })
  for (const c of allowed) it(`allows ${c}`, () => { expect(getSopsBlockReason(c)).toBeNull() })
})

describe('command-policy-guard', () => {
  const cargo: CommandPolicy = {
    name: 'no-cargo-test',
    blocked: ['cargo', 'test'],
    message: 'Use `mise test`.',
  }
  const bareApply: CommandPolicy = {
    name: 'bare-kubectl-apply',
    blocked: ['kubectl', 'apply'],
    bare: true,
    message: 'kubectl apply must run bare.',
  }

  const blocked = [
    'cargo test',
    'cargo test --lib',
    'sudo cargo test',
    'env cargo test',
    'bash -c \'cargo test\'',
    '/usr/bin/cargo test',
    'cd /x\ncargo test',
    'echo hi # note\ncargo test',
    'CARGO_TARGET_DIR=/tmp cargo test',
  ]
  const allowed = [
    'echo "cargo test"',
    'grep cargo test file.txt',
    'git commit -m "cargo test"',
    'timeout 60 cargo test', // known gap: wrapper with args before command
    'cat <<EOF\ncargo test\nEOF',
    'cargo build',
  ]

  for (const c of blocked) it(`blocks ${JSON.stringify(c)}`, () => { expect(checkCommand(c, [cargo])).not.toBeNull() })
  for (const c of allowed) it(`allows ${JSON.stringify(c)}`, () => { expect(checkCommand(c, [cargo])).toBeNull() })

  const bareBlocked = ['kubectl apply -f x.yaml | tee', 'kubectl apply > out', 'kubectl apply -f x.yaml 2>&1']
  const bareAllowed = ['kubectl apply -f x.yaml', 'echo hi | kubectl apply -f x.yaml', 'kubectl apply -f x.yaml && echo done', 'kubectl apply < input.txt']

  for (const c of bareBlocked) it(`bare-blocks ${JSON.stringify(c)}`, () => { expect(checkCommand(c, [bareApply])).not.toBeNull() })
  for (const c of bareAllowed) it(`bare-allows ${JSON.stringify(c)}`, () => { expect(checkCommand(c, [bareApply])).toBeNull() })
})

describe('splitShellLines', () => {
  it('turns separator newlines into semicolons', () => {
    expect(splitShellLines('cd /x\ncargo test')).toBe('cd /x;cargo test')
  })
  it('keeps heredoc bodies verbatim', () => {
    expect(splitShellLines('cat <<EOF\ncargo test\nEOF\necho done')).toBe('cat <<EOF\ncargo test\nEOF;echo done')
  })
  it('drops line comments', () => {
    expect(splitShellLines('echo hi # note\ncargo test')).toBe('echo hi ;cargo test')
  })
})

describe('loadConfig', () => {
  const mk = (root: string, rel: string, content: string) => {
    const p = join(root, ...rel.split('/'))
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content)
  }

  it('merges .dsh/heimdall.json over the row config', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-cfg-'))
    mk(root, '.dsh/heimdall.json', JSON.stringify({
      disabled: ['sops-secret-guard'],
      commandPolicies: [{ name: 'no-cargo-test', blocked: ['cargo', 'test'], message: 'Use mise test.' }],
    }))

    const loaded = loadConfig(root, { commandPolicies: [{ name: 'row-deny', blocked: ['terraform'], message: 'no' }] })
    expect(loaded.config.commandPolicies?.map((p) => p.name)).toEqual(['row-deny', 'no-cargo-test'])
    expect([...loaded.disabled]).toEqual(['sops-secret-guard'])

    rmSync(root, { recursive: true, force: true })
  })

  it('falls back to row config when no workspace file exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-cfg-'))
    const loaded = loadConfig(root, { commandPolicies: [{ name: 'row-only', blocked: ['rm'], message: 'no rm' }] })
    expect(loaded.config.commandPolicies?.map((p) => p.name)).toEqual(['row-only'])

    rmSync(root, { recursive: true, force: true })
  })
})

describe('secret-guard', () => {
  const state: SecretGuardState = {
    secretKeys: ['GITHUB_TOKEN'],
    secretValues: { GITHUB_TOKEN: 'ghp_abc123secret' },
    keyPattern: /\b(?:GITHUB_TOKEN)\b/i,
  }

  it('detects secret references in commands', () => {
    expect(getSecretReference('echo $GITHUB_TOKEN', state)).toBe('GITHUB_TOKEN')
    expect(getSecretReference('echo hi', state)).toBeNull()
  })

  const secret = 'ghp_abc123secret'
  const full = `GITHUB_TOKEN=${secret}`

  it('redacts plaintext', () => {
    expect(redactOutput(`export ${full}\n`, state.secretValues)).not.toContain(secret)
  })
  it('redacts base64', () => {
    const b64 = Buffer.from(full).toString('base64')
    expect(redactOutput(`token: ${b64}`, state.secretValues)).toBe(`token: [REDACTED]`)
  })
  it('redacts rot13', () => {
    const r13 = full.replace(/[a-zA-Z]/g, (c) => {
      const base = c <= 'Z' ? 65 : 97
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
    })
    expect(redactOutput(r13, state.secretValues)).toBe('[REDACTED]')
  })
  it('redacts reversed', () => {
    expect(redactOutput(full.split('').reverse().join(''), state.secretValues)).toBe('[REDACTED]')
  })
  it('redacts trailing KEY=value patterns without a manifest', () => {
    const out = redactOutput('some line\nAWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG', {})
    expect(out).toContain('AWS_SECRET_ACCESS_KEY=[REDACTED]')
  })
  it('leaves clean output alone', () => {
    const clean = 'all tests passed\n'
    expect(redactOutput(clean, state.secretValues)).toBe(clean)
  })
})
