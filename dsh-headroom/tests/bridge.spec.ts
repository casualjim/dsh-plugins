import { describe, expect, it } from 'vitest'
import { CallId, createMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, Message } from '@deepseek-ai/dsh-llm'
import type { OpenAIMessage } from 'headroom-ai'
import {
  applyCompressionResult,
  buildCompressionPayload,
  convertMessage,
  estimateTokens,
  generateCandidateFingerprint,
  generateFingerprint,
  naturalizeHeadroomMarkers,
  SeenContentCache,
  stableHash,
} from '../src/bridge.js'

function userMessage(text: string): Message {
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  })
}

function assistantToolCall(call: string, name = 'bash'): Message {
  return createMessage({
    role: 'assistant',
    content: [{ type: 'tool-call', id: CallId(call), name, arguments: '{}' }],
    source: { kind: 'model', provider: 'test', model: 'test-model' },
  })
}

function toolResult(call: string, text: string): Message {
  return createToolResultMessage({
    callId: CallId(call),
    content: [{ type: 'text', text }],
    isError: false,
  })
}

const LONG = 'x'.repeat(4000)

describe('buildCompressionPayload', () => {
  it('converts tool results as candidates and assistant/user as context', () => {
    const messages = [userMessage('question'), assistantToolCall('c1'), toolResult('c1', LONG)]
    const payload = buildCompressionPayload(messages, 10, true)
    expect(payload.messages).toHaveLength(3)
    expect(payload.messages[0]).toEqual({ role: 'user', content: 'question' })
    expect(payload.messages[1]).toMatchObject({ role: 'assistant', content: null })
    expect(payload.messages[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1', content: LONG })
    expect(payload.mappings.map((m) => m.applyTo)).toEqual([null, null, 'toolResult'])
    expect(payload.candidateCount).toBe(1)
  })

  it('renames protected tool names in the wire payload only', () => {
    const messages = [assistantToolCall('c1', 'read'), toolResult('c1', LONG)]
    const payload = buildCompressionPayload(messages, 10, true)
    const assistant = payload.messages[0] as { tool_calls?: Array<{ function: { name: string; arguments: string } }> }
    expect(assistant.tool_calls?.[0]?.function.name).toBe('pi_tool_result')
    expect(JSON.parse(assistant.tool_calls?.[0]?.function.arguments ?? '{}')).toEqual({ originalToolName: 'read' })
    const plain = buildCompressionPayload(messages, 10, false)
    const plainAssistant = plain.messages[0] as { tool_calls?: Array<{ function: { name: string } }> }
    expect(plainAssistant.tool_calls?.[0]?.function.name).toBe('read')
  })

  it('drops tool results below the character floor from candidacy', () => {
    const messages = [toolResult('c1', 'tiny')]
    const payload = buildCompressionPayload(messages, 10, true)
    expect(payload.candidateCount).toBe(0)
    expect(payload.mappings[0].applyTo).toBeNull()
  })

  it('skips messages with no convertible content', () => {
    const reasoning: ContentBlock = { type: 'reasoning', text: 'private reasoning' }
    const messages = [
      createMessage({ role: 'assistant', content: [reasoning], source: { kind: 'model', provider: 'test', model: 'test-model' } }),
      toolResult('c1', LONG),
    ]
    const payload = buildCompressionPayload(messages, 10, true)
    expect(payload.messages).toHaveLength(1)
    expect(payload.mappings[0].sourceIndex).toBe(1)
  })
})

describe('applyCompressionResult', () => {
  const messages = [userMessage('q'), toolResult('c1', LONG)]
  const payload = buildCompressionPayload(messages, 10, true)

  it('accepts aligned tool-result compression', () => {
    const compressed = structuredClone(payload.messages)
    ;(compressed[1] as { content: string }).content = 'compressed!'
    const result = applyCompressionResult(payload.mappings, compressed)
    expect(result).toEqual({ ok: true, changes: [{ sourceIndex: 1, originalText: LONG, nextText: 'compressed!' }] })
  })

  it('rejects message-count changes', () => {
    const result = applyCompressionResult(payload.mappings, payload.messages.slice(0, 1))
    expect(result).toEqual({ ok: false, reason: 'message-count-changed' })
  })

  it('rejects tool-call-id changes', () => {
    const compressed = structuredClone(payload.messages)
    ;(compressed[1] as { tool_call_id: string }).tool_call_id = 'other'
    const result = applyCompressionResult(payload.mappings, compressed)
    expect(result).toEqual({ ok: false, reason: 'tool-call-id-changed' })
  })

  it('ignores mangles on non-candidates and reports no change', () => {
    const compressed = structuredClone(payload.messages)
    ;(compressed[0] as { content: string }).content = 'MANGLE!'
    const result = applyCompressionResult(payload.mappings, compressed)
    expect(result).toEqual({ ok: false, reason: 'no-applicable-message-changed' })
  })
})

describe('markers and estimates', () => {
  it('naturalizes CCR markers to name headroom_retrieve', () => {
    const text = 'Result: [42 items compressed to 3. Retrieve more: hash=abc123] end'
    expect(naturalizeHeadroomMarkers(text)).toBe(
      'Result: [42 items compressed to 3. Retrieve the full original with the `headroom_retrieve` tool using hash=abc123.] end',
    )
  })

  it('estimates tokens cheaply', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('a')).toBe(1)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
  })
})

describe('fingerprints and seen cache', () => {
  it('candidate fingerprint is stable across identical candidate content', () => {
    const messages = [userMessage('different context each turn'), toolResult('c1', LONG)]
    const payloadA = buildCompressionPayload(messages, 10, true)
    const payloadB = buildCompressionPayload(messages, 10, true)
    expect(generateCandidateFingerprint(payloadA)).toBe(generateCandidateFingerprint(payloadB))
  })

  it('seen cache blocks, ignores, records, and evicts FIFO', () => {
    const cache = new SeenContentCache(2)
    const messages = [toolResult('c1', LONG)]
    const payload = buildCompressionPayload(messages, 10, true)
    const hash = stableHash(LONG)
    cache.add(hash)
    cache.add('older')
    cache.add('newest') // evicts placeholder
    expect(cache.has(hash)).toBe(false)
    expect(cache.has('newest')).toBe(true)

    const cache2 = new SeenContentCache(16)
    expect(cache2.hasAll([hash])).toBe(false)
    cache2.add(hash)
    expect(cache2.hasAll([hash])).toBe(true)

    cache2.ignoreSeen(payload)
    expect(payload.mappings[0].applyTo).toBeNull()
    expect(generateCandidateFingerprint(payload)).not.toBe(generateCandidateFingerprint(buildCompressionPayload(messages, 10, true)))

    const fresh = buildCompressionPayload(messages, 10, true)
    cache2.recordApplied(fresh, [{ sourceIndex: 0, nextText: 'compressed' }])
    expect(cache2.has(hash)).toBe(true)
    expect(cache2.has(stableHash('compressed'))).toBe(true)
  })

  it('payload fingerprint tracks content changes', () => {
    const payloadA = buildCompressionPayload([toolResult('c1', LONG)], 10, true)
    const payloadB = buildCompressionPayload([toolResult('c1', `${LONG}x`)], 10, true)
    expect(generateFingerprint(payloadA.messages as OpenAIMessage[])).not.toBe(generateFingerprint(payloadB.messages as OpenAIMessage[]))
  })

  it('converts a plain user message', () => {
    expect(convertMessage(userMessage('hi'), true)).toEqual({ role: 'user', content: 'hi' })
  })
})
