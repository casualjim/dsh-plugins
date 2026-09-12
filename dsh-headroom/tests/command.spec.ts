import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import { buildHeadroomCommand, HeadroomCompressor } from '../src/index.js'

describe('buildHeadroomCommand', () => {
  it('declares an input hint so argued forms resolve client-side', () => {
    const ctx = new Context()
    void new SessionProjectionRegistry(ctx)
    void new TokenMeter(ctx)
    const service = new HeadroomCompressor(ctx, { baseUrl: null })
    const command = buildHeadroomCommand(service)

    // The web client only resolves argued lines (`/headroom run`) for
    // commands that declare `input`; without it, `if (!bare) return
    // undefined` drops the line through as plain chat text.
    expect(command.name).toBe('headroom')
    expect(command.input).toBeDefined()
    expect(command.input?.hint).toContain('status')
    expect(command.input?.hint).toContain('run')
    expect(command.input?.hint).toContain('mode')
  })
})
