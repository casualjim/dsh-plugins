/**
 * dsh-headroom: Headroom context compression as a DeepSeek Harness service.
 *
 * The DSH-native integration pattern mirrors the built-in
 * `@deepseek-ai/dsh-compaction-tool-result-pruner`: compression is applied by
 * rewriting the live session SURFACE (tool-result nodes are replaced with
 * their compressed forms), each replacement preceded by the shared
 * `compaction/prune` shadow-price event so pure token consumers can subtract
 * the shadowed node's price. The model therefore sees compressed content on
 * its next request without any interception of the outgoing payload.
 *
 * Policy is ported from noheadroom (the Pi extension this bundle replaces):
 * only tool-result content mutates; user/assistant messages are sent as
 * compression context; every guard (reentrancy, throttle, fingerprint trio,
 * seen-content cache) is preserved. The proxy is never spawned or managed —
 * it is a configured URL, and an unset or unreachable URL degrades to a
 * no-op with a warning.
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { freezeMessage } from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock,
  Message,
  ToolResultMessage,
} from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
// Type-only: merges the `agent/*` event map for the `agent/pre-step` listener.
import type {} from '@deepseek-ai/dsh-agent'
import type { CommandDefinition, CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
// Type-only: merges the `compaction/prune` shadow-price event into the session map.
import type {} from '@deepseek-ai/dsh-compaction'
// Type-only: merges `ctx.tokenMeter` for the declared injection.
import type {} from '@deepseek-ai/dsh-token-meter'
import {
  applyCompressionResult,
  buildCompressionPayload,
  estimateTokens,
  generateCandidateFingerprint,
  generateFingerprint,
  SeenContentCache,
  stableHash,
} from './bridge.js'
import { isRemoteBlocked, resolveConfig } from './config.js'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { HeadroomTransport } from './transport.js'
import type {
  HeadroomConfig,
  HeadroomMode,
  HeadroomPassResult,
  HeadroomStats,
  ResolvedHeadroomConfig,
} from './types.js'

declare module '@deepseek-ai/cordis' {
  interface Context {
    headroom: HeadroomCompressor
  }
}

const MODES: readonly HeadroomMode[] = ['normal', 'quiet', 'silent']

/** One snapshot entry: a surface node and its message. */
interface SurfaceNode {
  readonly seq: number
  readonly event: SessionEvent<'tool/result'> | SessionEvent<'user/message'> | SessionEvent<'assistant/message'>
  readonly message: Message
}

function emptyStats(): HeadroomStats {
  return {
    attempts: 0,
    applied: 0,
    guardSkips: 0,
    tokensSaved: 0,
    charsRemoved: 0,
    nodesReplaced: 0,
  }
}

/** Build the proxy transport for one resolved configuration, or `null`. */
function buildTransport(config: ResolvedHeadroomConfig): HeadroomTransport | null {
  return config.baseUrl === null
    ? null
    : new HeadroomTransport({ baseUrl: config.baseUrl, timeoutMs: config.timeoutMs })
}

/** Replace the text blocks of one DSH tool-result message with compressed text. */
export function withCompressedContent(message: ToolResultMessage, text: string): ToolResultMessage {
  const result = message.content[0]
  const next: ContentBlock[] = []
  let replaced = false
  for (const block of result.content) {
    if (block.type === 'text') {
      if (!replaced) {
        next.push({ ...block, text })
        replaced = true
      }
      continue
    }
    next.push(block)
  }
  if (!replaced && text.length > 0) next.unshift({ type: 'text', text })
  return freezeMessage({
    ...message,
    content: [{
      ...result,
      content: next,
    }],
  })
}

export class HeadroomCompressor extends Service {
  static inject = ['tokenMeter', 'commands', 'tools']

  static Config = z.object({
    enabled: z.boolean().default(true),
    baseUrl: z.union([z.string(), z.const(null)]).default(null),
    mode: z.union([z.const('normal'), z.const('quiet'), z.const('silent')]).default('normal'),
    minContextTokens: z.number().step(1).min(0).default(20_000),
    minMessageChars: z.number().step(1).min(1).default(2_000),
    timeoutMs: z.number().step(1).min(100).default(30_000),
    throttleMs: z.number().step(1).min(0).default(3_000),
    allowRemote: z.boolean().default(false),
    renameToolCalls: z.boolean().default(true),
    maxSeenFingerprints: z.number().step(1).min(16).default(512),
  })

  /** Current effective configuration (row config, then live settings writes). */
  get config(): ResolvedHeadroomConfig {
    return this.runtime
  }

  /** Per-process cumulative counters. */
  readonly stats: HeadroomStats

  private runtime: ResolvedHeadroomConfig
  private _transport: HeadroomTransport | null
  private readonly seen: SeenContentCache
  private enabled: boolean
  private mode: HeadroomMode
  private processing = false
  private lastCompressionTime = 0
  private lastInputFingerprint: string | null = null
  private lastOutputFingerprint: string | null = null
  private lastGuardSkipCandidateFingerprint: string | null = null
  private degradedWarningShown = false

  constructor(ctx: Context, config: HeadroomConfig = {}) {
    super(ctx, 'headroom')
    this.runtime = resolveConfig(config)
    this.enabled = this.runtime.enabled
    this.mode = this.runtime.mode
    this.seen = new SeenContentCache(this.runtime.maxSeenFingerprints)
    this._transport = buildTransport(this.runtime)
    this.stats = emptyStats()
    this.installSettingsSection(config)

    const self = this
    this.ctx.effect(function* () {
      const commands = ctx.get('commands')
      if (commands !== undefined) {
        yield commands.register(buildHeadroomCommand(self))
      }
      const tools = ctx.get('tools')
      if (tools !== undefined) yield tools.register(buildRetrieveTool(self))
      yield ctx.on('agent/pre-step', async (
        { agent, signal }: { agent: { session: Session }; signal: AbortSignal },
        next: () => Promise<PreStepDecision>,
      ): Promise<PreStepDecision> => {
        if (!signal.aborted) {
          try {
            await self.considerPass(agent.session, signal)
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            ctx.logger.warn(`headroom step pass failed: ${message}; continuing the turn`)
          }
        }
        return next()
      })
    }, 'dsh-headroom lifecycle')
  }

  /** The configured proxy transport, or `null` when degraded. */
  get transport(): HeadroomTransport | null {
    return this._transport
  }

  /** Live enabled state (mutated by `/headroom on|off`). */
  isEnabled(): boolean {
    return this.enabled
  }

  /** Live output mode (mutated by `/headroom mode`). */
  getMode(): HeadroomMode {
    return this.mode
  }

  /** Whether a proxy transport is configured and usable. */
  get ready(): boolean {
    return this._transport !== null
      && this.config.baseUrl !== null
      && !isRemoteBlocked(this.config)
  }

  /**
   * Register the `headroom` settings namespace so configuration UIs can read
   * and write it (persisted by the settings-file provider). Row config is the
   * composition `base`; user settings layer on top; live writes are applied
   * to the running service through {@link applySettings}.
   */
  private installSettingsSection(entry: HeadroomConfig): void {
    const self = this
    let source: () => unknown = () => self.runtime
    installSettingsSection(
      this.ctx,
      settingsNamespace('headroom'),
      HeadroomCompressor.Config,
      entry as never,
      {
        setSource: (current: () => unknown) => { source = current },
        onChange: () => { self.applySettings(source() as ResolvedHeadroomConfig) },
      },
    )
  }

  /** Re-resolve and live-apply a new configuration (settings write or attach). */
  applySettings(next: ResolvedHeadroomConfig): void {
    const resolved = resolveConfig(next)
    const transportChanged = resolved.baseUrl !== this.runtime.baseUrl
      || resolved.timeoutMs !== this.runtime.timeoutMs
    this.runtime = resolved
    this.enabled = resolved.enabled
    this.mode = resolved.mode
    if (transportChanged) {
      this._transport = buildTransport(resolved)
      this.degradedWarningShown = false
      this.ctx.logger.info(
        `dsh-headroom proxy ${resolved.baseUrl ?? 'unset (degraded)'}`
        + `, timeout ${resolved.timeoutMs}ms`,
      )
    }
  }

  /**
   * Run one compression pass over the current session surface when the gates
   * allow it. Returns `null` when no pass was needed or possible.
   */
  async considerPass(session: Session, signal: AbortSignal): Promise<HeadroomPassResult | null> {
    if (!this.enabled) return null
    if (this.processing) return null
    const now = Date.now()
    if (now - this.lastCompressionTime < this.config.throttleMs) return null
    if (this._transport === null) {
      this.warnDegraded('no Headroom proxy URL configured; set `baseUrl` (or DSH_HEADROOM_URL) to enable compression')
      return null
    }
    if (isRemoteBlocked(this.config)) {
      this.warnDegraded(`remote Headroom proxy blocked (${this.config.baseUrl}); set allowRemote: true only if you trust that proxy`)
      return null
    }

    const tokens = this.estimateSurfaceTokens(session)
    if (tokens < this.config.minContextTokens) return null

    return this.compressSession(session, signal)
  }

  /** Estimate the token count of the current surface messages. */
  estimateSurfaceTokens(session: Session): number {
    let tokens = 0
    for (const seq of session.surface.nodes) {
      const event = session.events[seq]
      if (event === undefined) continue
      if (event.type === 'tool/result') {
        tokens += this.ctx.tokenMeter.estimateMessage(event.data.message)
      } else if (event.type === 'user/message') {
        tokens += this.ctx.tokenMeter.estimateMessage(event.data)
      } else if (event.type === 'assistant/message') {
        tokens += this.ctx.tokenMeter.estimateMessage(event.data.message)
      }
    }
    return tokens
  }

  /**
   * Compress the current tool-result surface nodes. Snapshots the surface,
   * sends the converted payload to the configured proxy, and lands validated
   * tool-result replacements with the shared shadow-price protocol.
   */
  async compressSession(session: Session, signal: AbortSignal): Promise<HeadroomPassResult | null> {
    if (this._transport === null) return null
    const nodes = snapshotSurface(session)
    const payload = buildCompressionPayload(
      nodes.map((node) => node.message),
      this.config.minMessageChars,
      this.config.renameToolCalls,
    )
    if (payload.candidateCount === 0) return null

    const inputFingerprint = generateFingerprint(payload.messages)
    // Mirror guard: we already compressed exactly this payload.
    if (inputFingerprint === this.lastOutputFingerprint) return null
    // Input unchanged since the last attempt — nothing new to do.
    if (inputFingerprint === this.lastInputFingerprint) return null
    const candidateFingerprint = generateCandidateFingerprint(payload)
    if (candidateFingerprint === this.lastGuardSkipCandidateFingerprint) return null

    // Seen-content cache: identical tool-result text already compressed
    // (possibly under a different tool call) does not re-trigger a proxy call.
    const candidateHashes = payload.mappings
      .filter((mapping) => mapping.applyTo !== null)
      .map((mapping) => stableHash(mapping.originalText))
    if (this.seen.hasAll(candidateHashes)) return null
    this.seen.ignoreSeen(payload)
    if (payload.mappings.every((mapping) => mapping.applyTo === null)) return null

    this.processing = true
    this.lastCompressionTime = Date.now()
    this.stats.attempts++
    try {
      const result = await this._transport.compress(payload.messages)
      signal.throwIfAborted()
      if (!result.compressed || result.tokensSaved <= 0) {
        this.recordSkip('no-proxy-token-savings', inputFingerprint, candidateFingerprint)
        return null
      }
      const applied = applyCompressionResult(payload.mappings, result.messages)
      if (!applied.ok) {
        this.recordSkip(applied.reason, inputFingerprint, candidateFingerprint)
        return null
      }

      const replacements: HeadroomPassResult['replacements'] = []
      let tokensSaved = 0
      let charsRemoved = 0
      for (const change of applied.changes) {
        const node = nodes[change.sourceIndex]
        if (node === undefined || node.event.type !== 'tool/result') continue
        tokensSaved += Math.max(0, estimateTokens(change.originalText) - estimateTokens(change.nextText))
        charsRemoved += change.originalText.length - change.nextText.length
        const message = withCompressedContent(node.event.data.message, change.nextText)
        // Shadow-price protocol: the metering event and its replacement are
        // appended synchronously adjacent (see dsh-compaction-tool-result-pruner).
        session.append('compaction/prune', {
          shadowedRange: { start: node.seq, end: node.seq },
          shadowedSeqs: [node.seq],
          shadowedTokenCount: this.ctx.tokenMeter.estimateMessage(node.event.data.message),
        })
        const replacement = session.append('tool/result', {
          ...node.event.data,
          message,
        }, {
          surfaceOp: { op: 'replace', start: node.seq, end: node.seq },
          sourceEventSeqs: [node.seq],
        })
        replacements.push({
          originalSeq: node.seq,
          replacementSeq: replacement.seq,
          callId: node.event.data.message.source.callId,
        })
      }

      if (replacements.length === 0) {
        this.recordSkip('no-applied-replacement-landed', inputFingerprint, candidateFingerprint)
        return null
      }

      this.stats.applied++
      this.stats.tokensSaved += tokensSaved
      this.stats.charsRemoved += Math.max(0, charsRemoved)
      this.stats.nodesReplaced += replacements.length
      this.stats.lastError = undefined
      this.stats.lastSkipReason = undefined
      this.stats.last = {
        tokensBefore: result.tokensBefore,
        tokensAfter: result.tokensAfter,
        tokensSaved,
        compressionRatio: result.compressionRatio,
        transformsApplied: result.transformsApplied,
        appliedMessages: replacements.length,
        timestamp: Date.now(),
      }
      this.lastInputFingerprint = inputFingerprint
      this.lastOutputFingerprint = generateFingerprint(result.messages)
      this.lastGuardSkipCandidateFingerprint = null
      this.seen.recordApplied(payload, applied.changes)
      this.announceApplied(replacements.length, tokensSaved)
      return { replacements, appliedMessages: replacements.length, tokensSaved, charsRemoved, transformsApplied: result.transformsApplied }
    } catch (error: unknown) {
      if (signal.aborted) return null
      const message = error instanceof Error ? error.message : String(error)
      this.stats.lastError = message
      this.warnDegraded(`compression call failed: ${message}`)
      return null
    } finally {
      this.processing = false
    }
  }

  /** Fetch one CCR original from the configured proxy. */
  async retrieve(hash: string): Promise<string> {
    if (this._transport === null) {
      throw new Error('Headroom proxy is not configured. Re-read the source file or re-run the tool call instead.')
    }
    const result = await this._transport.retrieve(hash)
    if ('results' in result) {
      throw new Error('headroom_retrieve: query search is not supported; pass the exact hash from the compression marker.')
    }
    return result.originalContent
  }

  toggle(enabled: boolean): void {
    this.enabled = enabled
  }

  setMode(mode: HeadroomMode): void {
    this.mode = mode
  }

  private recordSkip(reason: string, inputFingerprint: string, candidateFingerprint: string): void {
    this.stats.guardSkips++
    this.stats.lastSkipReason = reason
    // Record the exact inputs we skipped so an unchanged payload does not
    // retry the proxy on every later step (noheadroom's guard-skip fix).
    this.lastInputFingerprint = inputFingerprint
    this.lastGuardSkipCandidateFingerprint = candidateFingerprint
  }

  private warnDegraded(reason: string): void {
    if (this.degradedWarningShown) return
    this.degradedWarningShown = true
    this.ctx.logger.warn(`dsh-headroom degraded: ${reason}`)
  }

  private announceApplied(messages: number, tokensSaved: number): void {
    if (this.mode !== 'normal') return
    this.ctx.logger.info(`headroom: compressed ${messages} tool result(s), ~${tokensSaved} tokens saved`)
  }
}

/** Snapshot the current surface into seq + message entries. */
function snapshotSurface(session: Session): SurfaceNode[] {
  const nodes: SurfaceNode[] = []
  for (const seq of session.surface.nodes) {
    const event = session.events[seq]
    if (event === undefined) continue
    if (event.type === 'tool/result') {
      nodes.push({ seq, event, message: event.data.message })
    } else if (event.type === 'user/message') {
      nodes.push({ seq, event, message: event.data })
    } else if (event.type === 'assistant/message') {
      nodes.push({ seq, event, message: event.data.message })
    }
  }
  return nodes
}

/** The `/headroom` command. Exported for registration tests. */
export function buildHeadroomCommand(service: HeadroomCompressor): CommandDefinition {
  return {
    name: 'headroom',
    description: 'Headroom token compression and control.',
    // Client-side argument admission: a command WITHOUT an `input` descriptor
    // resolves only when entered bare — `/headroom run` would fall through to
    // the model as plain chat text. The hint declares the argued forms.
    input: { hint: 'status | on | off | health | stats | mode <normal|quiet|silent> | run' },
    handler: (invocation: CommandInvocation): Promise<CommandResult> => handleCommand(service, invocation),
  }
}

/** Dispatch one `/headroom` invocation. */
async function handleCommand(
  service: HeadroomCompressor,
  invocation: CommandInvocation,
): Promise<CommandResult> {
  const parts = invocation.rawInput.trim().split(/\s+/).filter(Boolean)
  const first = (parts[0] ?? 'status').toLowerCase()
  if (first === 'mode') return handleModeChange(service, parts[1]?.toLowerCase() ?? '')
  switch (first) {
    case 'on': {
      service.toggle(true)
      return { kind: 'success', text: 'Headroom compression enabled.' }
    }
    case 'off': {
      service.toggle(false)
      return { kind: 'success', text: 'Headroom compression disabled.' }
    }
    case 'health': return handleHealth(service)
    case 'stats': return handleStats(service)
    case 'run': return handleRun(service, invocation)
    case 'status':
    case '': return { kind: 'success', text: renderStatus(service) }
    default: {
      return { kind: 'error', text: `Unknown subcommand "${first}". Usage: /headroom [on|off|status|health|stats|mode <normal|quiet|silent>|run]` }
    }
  }
}

async function handleModeChange(
  service: HeadroomCompressor,
  rawMode: string,
): Promise<CommandResult> {
  const mode = rawMode.toLowerCase() as HeadroomMode
  if (!MODES.includes(mode)) {
    return { kind: 'error', text: `Unknown mode "${rawMode}". Valid modes: ${MODES.join(', ')}.` }
  }
  service.setMode(mode)
  return { kind: 'success', text: `Headroom output mode set to ${mode}.` }
}

async function handleHealth(service: HeadroomCompressor): Promise<CommandResult> {
  if (service.transport === null) {
    return { kind: 'error', text: 'No Headroom proxy URL configured. Set `baseUrl` in the dsh-headroom row config or DSH_HEADROOM_URL.' }
  }
  try {
    const healthy = await service.transport.health()
    return { kind: 'success', text: `Headroom proxy ${service.config.baseUrl} is ${healthy ? 'healthy' : 'unhealthy'}.` }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: 'error', text: `Headroom proxy unreachable: ${message}` }
  }
}

async function handleStats(service: HeadroomCompressor): Promise<CommandResult> {
  let proxy: string | undefined
  if (service.transport !== null) {
    try {
      const stats = await service.transport.stats()
      const raw = JSON.stringify(stats)
      proxy = raw.length > 4000 ? `${raw.slice(0, 4000)}...` : raw
    } catch (error: unknown) {
      proxy = `unreachable: ${error instanceof Error ? error.message : String(error)}`
    }
  } else {
    proxy = 'not configured'
  }
  const lines = [
    'Headroom proxy stats:',
    proxy,
    '',
    renderStatus(service),
  ]
  return { kind: 'success', text: lines.join('\n') }
}

async function handleRun(
  service: HeadroomCompressor,
  invocation: CommandInvocation,
): Promise<CommandResult> {
  if (!service.isEnabled()) return { kind: 'error', text: 'Headroom is disabled. Run /headroom on first.' }
  const result = await service.compressSession(invocation.agent.session, invocation.signal)
  if (result === null) {
    const reason = service.stats.lastError
      ?? service.stats.lastSkipReason
      ?? 'no compressible tool results in the current surface'
    return { kind: 'error', text: `Nothing compressed: ${reason}` }
  }
  return {
    kind: 'success',
    text: `Compressed ${result.appliedMessages} tool result(s), ~${result.tokensSaved} tokens saved (${result.replacements.length} surface node(s) replaced).`,
    sourceEventSeq: result.replacements[0]?.replacementSeq,
  }
}

function renderStatus(service: HeadroomCompressor): string {
  const config = service.config
  const lines = [
    `Headroom status: ${service.isEnabled() ? 'enabled' : 'disabled'}`,
    `Proxy: ${config.baseUrl ?? 'not configured (degraded — compression is a no-op)'}`,
    `Mode: ${service.getMode()}`,
    `Min context tokens: ${config.minContextTokens}, min message chars: ${config.minMessageChars}, timeout: ${config.timeoutMs}ms`,
    `Remote allowed: ${config.allowRemote ? 'yes' : 'no (non-localhost URLs are refused)'}`,
    `Session stats: attempts=${service.stats.attempts} applied=${service.stats.applied} guardSkips=${service.stats.guardSkips} tokensSaved=${service.stats.tokensSaved} nodesReplaced=${service.stats.nodesReplaced}`,
  ]
  if (service.stats.lastError !== undefined) lines.push(`Last error: ${service.stats.lastError}`)
  else if (service.stats.lastSkipReason !== undefined) lines.push(`Last skip: ${service.stats.lastSkipReason}`)
  if (service.stats.last !== undefined) {
    const last = service.stats.last
    lines.push(`Last pass: ${last.appliedMessages} result(s), ~${last.tokensSaved} tokens saved, transforms: ${last.transformsApplied.join(', ') || 'none'}`)
  }
  lines.push('Note: token numbers are a cheap local estimate (ceil(len/4)), not provider metering.')
  return lines.join('\n')
}

/** The model-facing CCR retrieval tool. */
export function buildRetrieveTool(service: HeadroomCompressor): ToolDefinition {
  return {
    name: 'headroom_retrieve',
    description: 'Retrieve the full original content that Headroom compressed. Use the exact hash from a "[... Retrieve more: hash=...]" marker in a compressed tool result.',
    // `parameters` is the RAW wire schema the provider receives — standard
    // JSON Schema only: `required` must be an array at the object level, never
    // a per-property boolean (a boolean here fails provider validation and
    // blocks every request carrying the tool).
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        hash: {
          type: 'string',
          description: 'The exact hash from the compression marker.',
        },
      },
      required: ['hash'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          hash: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['hash', 'content'],
      },
      render: (_args: unknown, value: unknown): ContentBlock[] => {
        const content = (value as { content: string }).content
        return [{ type: 'text', text: content }]
      },
    },
    async execute(args: unknown): Promise<unknown> {
      const hash = (args as { hash: string }).hash
      const content = await service.retrieve(hash)
      return { hash, content }
    },
  }
}

export default HeadroomCompressor
