/**
 * Tests for the DSH-policy → heimdall-policy-JSON mapping: the mode
 * vocabulary's meaning as a heimdall-sandbox document.
 */

import { describe, expect, it } from 'vitest'
import type { SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import { buildPolicyDocument } from '../src/policy.ts'

const RO: SandboxPolicy = { mode: 'read-only', workspaceRoot: '/ws' }
const WW: SandboxPolicy = { mode: 'workspace-write', workspaceRoot: '/ws' }

describe('buildPolicyDocument', () => {
  it('read-only: declared-empty filesystem block confines read-only', () => {
    expect(buildPolicyDocument(['bash', '-c', 'ls'], RO)).toEqual({
      cwd: '/ws',
      command: ['bash', '-c', 'ls'],
      stdio: 'inherit',
      filesystem: {},
    })
  })

  it('workspace-write: writable list is exactly the workspace root by default', () => {
    expect(buildPolicyDocument(['git', 'status'], WW)).toMatchObject({
      cwd: '/ws',
      command: ['git', 'status'],
      filesystem: { writable: ['/ws'] },
    })
  })

  it('workspace-write: configured extra roots join the workspace root', () => {
    const doc = buildPolicyDocument(['cargo', 'build'], WW, {
      extraWritableRoots: ['~/github', '~/.local/share/mise'],
    })
    expect(doc.filesystem.writable).toEqual(['/ws', '~/github', '~/.local/share/mise'])
  })

  it('deny paths pass through verbatim in heimdall syntax, any mode', () => {
    for (const policy of [RO, WW]) {
      const doc = buildPolicyDocument(['cat', '.env'], policy, {
        deniedPaths: ['~/.ssh', '!~/.config/mise', '/secrets'],
      })
      expect(doc.filesystem.deny).toEqual(['~/.ssh', '!~/.config/mise', '/secrets'])
    }
  })

  it('danger-full-access never reaches the provider', () => {
    expect(() =>
      buildPolicyDocument(['ls'], { mode: 'danger-full-access', workspaceRoot: '/' }),
    ).toThrow(/danger-full-access/)
  })

  it('copies the caller argv instead of aliasing it', () => {
    const argv = ['bash', '-c', 'echo hi']
    const doc = buildPolicyDocument(argv, WW)
    expect(doc.command).not.toBe(argv)
    expect(doc.command).toEqual(argv)
  })
})
