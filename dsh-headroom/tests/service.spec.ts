import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId, createMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import type { CompressResult, OpenAIMessage } from 'headroom-ai'
import { extractDshText } from '../src/bridge.js'
import { HeadroomCompressor } from '../src/index.js'
import type { HeadroomConfig } from '../src/types.js'

const mock = vi.hoisted(() => ({
  compress: vi.fn(),
  retrieve: vi.fn(),
  stats: vi.fn(),
  health: vi.fn(),
}))

vi.mock('headroom-ai', () => ({
  HeadroomClient: class {
    compress = mock.compress
    retrieve = mock.retrieve
    proxyStats = mock.stats
    health = mock.health
  },
}))

const LONG = 'file-content-'.repeat(600) // 7800 chars
const COMPRESSED = 'compressed!'

/** Echo every message back; compress tool messages. */
function echoCompress(messages: OpenAIMessage[]): CompressResult {
  const next = messages.map((message) => (
    message.role === 'tool'
      ? { ...message, content: COMPRESSED }
      : message
  ))
  return {
    messages: next,
    tokensBefore: 2000,
    tokensAfter: 400,
    tokensSaved: 1600,
    compressionRatio: 0.2,
    transformsApplied: ['smart_crusher'],
    ccrHashes: ['abc123'],
    compressed: true,
  }
}

function appendToolStep(session: Session, call: string, text: string): number {
  const callId = CallId(call)
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'tool-call', id: callId, name: 'read', arguments: '{}' }],
      source: { kind: 'model', provider: 'test', model: 'test-model' },
    }),
  }, { surfaceOp: 'append' })
  session.append('tool/call', { turn: 1, step: 1, callId, name: 'read', arguments: '{}' })
  const result = session.append('tool/result', {
    turn: 1,
    step: 1,
    message: createToolResultMessage({ callId, content: [{ type: 'text', text }], isError: false }),
  }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return result.seq
}

function makeService(config: HeadroomConfig = {}): { ctx: Context; service: HeadroomCompressor } {
  const ctx = new Context()
  void new TokenMeter(ctx)
  const service = new HeadroomCompressor(ctx, { baseUrl: 'http://127.0.0.1:8787', ...config })
  return { ctx, service }
}

function toolResultText(session: Session, seq: number): string {
  const event = session.events[seq]
  if (event === undefined || event.type !== 'tool/result') return ''
  return extractDshText(event.data.message.content[0].content as ContentBlock[])
}

beforeEach(() => {
  mock.compress.mockReset()
  mock.compress.mockImplementation(async (messages: OpenAIMessage[]) => echoCompress(messages))
  mock.retrieve.mockReset()
  mock.stats.mockReset()
  mock.health.mockReset()
})

describe('HeadroomCompressor pass', () => {
  it('replaces the tool-result surface node with compressed content and shadow-prices it', async () => {
    const { ctx, service } = makeService({ minMessageChars: 10 })
    const session = Session.create(SessionId('compress'))
    const originalSeq = appendToolStep(session, 'c1', LONG)

    const result = await service.compressSession(session, new AbortController().signal)
    expect(result).not.toBeNull()
    expect(result?.replacements).toHaveLength(1)
    expect(result?.replacements[0]).toMatchObject({ originalSeq, callId: 'c1' })

    const replacementSeq = result!.replacements[0].replacementSeq
    expect(toolResultText(session, replacementSeq)).toBe(COMPRESSED)

    // Shadow-price protocol: the prune event prices the original node.
    const prune = session.events[replacementSeq - 1]
    expect(prune.type).toBe('compaction/prune')
    if (prune.type === 'compaction/prune') {
      expect(prune.data.shadowedSeqs).toEqual([originalSeq])
    }

    // The surface no longer contains the original node.
    expect(session.surface.nodes).not.toContain(originalSeq)
    expect(session.surface.nodes).toContain(replacementSeq)

    expect(service.stats.applied).toBe(1)
    expect(service.stats.nodesReplaced).toBe(1)
    expect(service.stats.tokensSaved).toBeGreaterThan(0)
    expect(service.stats.last?.transformsApplied).toEqual(['smart_crusher'])
  })

  it('does not re-compress identical tool-result content (seen-content guard)', async () => {
    const { service } = makeService({ minMessageChars: 10 })
    const session = Session.create(SessionId('guard'))
    appendToolStep(session, 'c1', LONG)
    const first = await service.compressSession(session, new AbortController().signal)
    expect(first).not.toBeNull()

    // A new session with the SAME file content read under a NEW tool call id.
    const session2 = Session.create(SessionId('guard2'))
    appendToolStep(session2, 'c2', LONG)
    const second = await service.compressSession(session2, new AbortController().signal)
    expect(second).toBeNull()
    expect(mock.compress).toHaveBeenCalledTimes(1)
  })

  it('returns null when the proxy reports no savings', async () => {
    mock.compress.mockImplementation(async (messages: OpenAIMessage[]) => ({
      ...echoCompress(messages),
      tokensSaved: 0,
      compressed: false,
    }))
    const { service } = makeService({ minMessageChars: 10 })
    const session = Session.create(SessionId('nosave'))
    appendToolStep(session, 'c1', LONG)
    const result = await service.compressSession(session, new AbortController().signal)
    expect(result).toBeNull()
    expect(service.stats.lastSkipReason).toBe('no-proxy-token-savings')

    // Guard-skip regression: unchanged payload must NOT retry the proxy.
    const retry = await service.compressSession(session, new AbortController().signal)
    expect(retry).toBeNull()
    expect(mock.compress).toHaveBeenCalledTimes(1)
  })

  it('returns null when the proxy unreachable (degrade, not throw)', async () => {
    mock.compress.mockRejectedValue(new Error('ECONNREFUSED'))
    const { service } = makeService({ minMessageChars: 10 })
    const session = Session.create(SessionId('unreachable'))
    appendToolStep(session, 'c1', LONG)
    const result = await service.compressSession(session, new AbortController().signal)
    expect(result).toBeNull()
    expect(service.stats.lastError).toContain('ECONNREFUSED')
  })

  it('degrades to a no-op when no baseUrl is configured', async () => {
    const { service } = makeService({ baseUrl: null, minMessageChars: 10 })
    const session = Session.create(SessionId('degraded'))
    appendToolStep(session, 'c1', LONG)
    expect(service.ready).toBe(false)
    expect(await service.compressSession(session, new AbortController().signal)).toBeNull()
    expect(mock.compress).not.toHaveBeenCalled()
  })

  it('skips short tool results below the character floor', async () => {
    const { service } = makeService({ minMessageChars: 100 })
    const session = Session.create(SessionId('short'))
    appendToolStep(session, 'c1', 'tiny')
    expect(await service.compressSession(session, new AbortController().signal)).toBeNull()
    expect(mock.compress).not.toHaveBeenCalled()
  })

  it('estimates surface tokens', () => {
    const { service } = makeService()
    const session = Session.create(SessionId('tokens'))
    appendToolStep(session, 'c1', LONG)
    expect(service.estimateSurfaceTokens(session)).toBeGreaterThan(0)
  })
})

describe('HeadroomCompressor retrieve', () => {
  it('returns the original content for a hash', async () => {
    mock.retrieve.mockResolvedValue({ hash: 'abc123', originalContent: 'full original', originalTokens: 12, originalItemCount: 3, compressedItemCount: 1, toolName: 'read', retrievalCount: 1 })
    const { service } = makeService()
    await expect(service.retrieve('abc123')).resolves.toBe('full original')
  })

  it('fails with guidance when no proxy is configured', async () => {
    const { service } = makeService({ baseUrl: null })
    await expect(service.retrieve('abc123')).rejects.toThrow(/proxy is not configured/)
  })
})

describe('HeadroomCompressor toggles', () => {
  it('toggles enabled state and mode', () => {
    const { service } = makeService()
    expect(service.isEnabled()).toBe(true)
    service.toggle(false)
    expect(service.isEnabled()).toBe(false)
    service.setMode('silent')
    expect(service.getMode()).toBe('silent')
  })
})

describe('HeadroomCompressor settings application', () => {
  const base = {
    enabled: true,
    baseUrl: 'http://127.0.0.1:8787',
    mode: 'normal',
    minContextTokens: 20000,
    minMessageChars: 2000,
    timeoutMs: 30000,
    throttleMs: 3000,
    allowRemote: false,
    renameToolCalls: true,
    maxSeenFingerprints: 512,
  } as const

  it('live-applies a baseUrl change by rebuilding the transport', () => {
    const { service } = makeService({ baseUrl: null })
    expect(service.ready).toBe(false)
    expect(service.transport).toBeNull()

    service.applySettings({ ...base })
    expect(service.ready).toBe(true)
    expect(service.transport).not.toBeNull()
    expect(service.config.baseUrl).toBe('http://127.0.0.1:8787')
  })

  it('degrades again when baseUrl is cleared from settings', () => {
    const { service } = makeService({ baseUrl: 'http://127.0.0.1:8787' })
    expect(service.ready).toBe(true)
    service.applySettings({ ...base, baseUrl: null })
    expect(service.ready).toBe(false)
    expect(service.transport).toBeNull()
  })

  it('applies mode and enabled from settings', () => {
    const { service } = makeService()
    service.applySettings({ ...base, mode: 'silent', enabled: false })
    expect(service.getMode()).toBe('silent')
    expect(service.isEnabled()).toBe(false)
  })

  it('rejects unknown settings keys through config validation', () => {
    const { service } = makeService()
    expect(() => service.applySettings({ ...base, autoStart: true } as never)).toThrow(/unknown key "autoStart"/)
  })

  it('normalizes out-of-range settings to defaults', () => {
    const { service } = makeService()
    service.applySettings({ ...base, minMessageChars: 0 })
    expect(service.config.minMessageChars).toBe(2000)
  })
})
