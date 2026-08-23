/**
 * Shared vocabulary for the dsh-headroom port.
 *
 * The bridge vocabulary is a direct port of noheadroom's `types.ts`
 * (https://github.com/raquezha/nothing/tree/main/packages/noheadroom):
 * OpenAI wire messages, the compression payload with `applyTo` mappings, and
 * the applied-result contract. Only `toolResult` mappings are ever applied
 * back to the DSH session; user/assistant messages are sent as compression
 * context and their returned changes are ignored.
 */

export type { CompressResult } from 'headroom-ai'
import type { OpenAIMessage } from 'headroom-ai'

export type HeadroomMode = 'normal' | 'quiet' | 'silent'

/** Raw plugin configuration accepted by the cordis row / constructor. */
export interface HeadroomConfig {
  /** Compression enabled at boot. Toggle live with `/headroom on|off`. */
  enabled?: boolean
  /**
   * Headroom proxy URL. `null` (default) means "no proxy configured":
   * compression degrades to a no-op with a warning. Environment fallback:
   * `DSH_HEADROOM_URL` → `HEADROOM_URL` → `HEADROOM_BASE_URL`.
   */
  baseUrl?: string | null
  /** Output verbosity. */
  mode?: HeadroomMode
  /** Skip automatic passes while the session surface is below this token estimate. */
  minContextTokens?: number
  /** Per-tool-result character floor: shorter results are not compression candidates. */
  minMessageChars?: number
  /** HTTP timeout per proxy call, ms. */
  timeoutMs?: number
  /** Minimum gap between automatic passes, ms. */
  throttleMs?: number
  /**
   * Remote proxy URLs are refused unless this is true. The proxy receives
   * full tool-result content; only allow a URL you trust.
   */
  allowRemote?: boolean
  /**
   * Rename every assistant tool-call to the opaque `pi_tool_result` in the
   * compression payload so Headroom's protected-tool exclusions
   * (DEFAULT_EXCLUDE_TOOLS: read, bash, ...) do not skip large reads.
   */
  renameToolCalls?: boolean
  /** Cap of the seen-content fingerprint FIFO (original + applied hashes). */
  maxSeenFingerprints?: number
}

/** Resolved immutable configuration. */
export interface ResolvedHeadroomConfig {
  readonly enabled: boolean
  readonly baseUrl: string | null
  readonly mode: HeadroomMode
  readonly minContextTokens: number
  readonly minMessageChars: number
  readonly timeoutMs: number
  readonly throttleMs: number
  readonly allowRemote: boolean
  readonly renameToolCalls: boolean
  readonly maxSeenFingerprints: number
}

/** One compressible message inside the compression payload. */
export interface CompressionMapping {
  /** Index into the payload messages array. */
  readonly sourceIndex: number
  /** OpenAI wire form sent to the proxy. */
  readonly message: OpenAIMessage
  /**
   * `'toolResult'` when this message is a compression candidate whose
   * compressed form may be applied back; `null` when it is context only.
   */
  applyTo: 'toolResult' | null
  /** Extracted text of the converted message (before compression). */
  readonly originalText: string
}

/** The proxy request: converted messages plus per-message application metadata. */
export interface CompressionPayload {
  readonly messages: OpenAIMessage[]
  readonly mappings: CompressionMapping[]
  /** Number of mappings with `applyTo` set and text at/above the char floor. */
  readonly candidateCount: number
}

/** One applied change: a source index plus its validated replacement text. */
export interface AppliedChange {
  readonly sourceIndex: number
  readonly originalText: string
  readonly nextText: string
}

export type ApplyResult =
  | { ok: true; changes: AppliedChange[] }
  | { ok: false; reason: string }

/** Per-session runtime counters, surfaced by `/headroom status`. */
export interface HeadroomStats {
  attempts: number
  applied: number
  guardSkips: number
  tokensSaved: number
  charsRemoved: number
  nodesReplaced: number
  lastSkipReason?: string
  lastError?: string
  last?: {
    tokensBefore: number
    tokensAfter: number
    tokensSaved: number
    compressionRatio: number
    transformsApplied: string[]
    appliedMessages: number
    timestamp: number
  }
}

/** Result of one compression pass over a DSH session surface. */
export interface HeadroomPassResult {
  /** Landed replacements: original seq → replacement seq. */
  replacements: Array<{ originalSeq: number; replacementSeq: number; callId: string }>
  appliedMessages: number
  tokensSaved: number
  charsRemoved: number
  transformsApplied: string[]
}
