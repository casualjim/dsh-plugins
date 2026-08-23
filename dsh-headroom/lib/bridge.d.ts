/**
 * Host-agnostic compression bridge, ported from noheadroom's `bridge.ts`
 * (https://github.com/raquezha/nothing/tree/main/packages/noheadroom),
 * re-typed against the DeepSeek Harness message vocabulary.
 *
 * Policy (identical to noheadroom):
 * - Only `toolResult` messages are compression candidates; user and assistant
 *   messages are sent as context and their returned changes are ignored.
 * - The compressed result must echo the payload one message at a time with
 *   matching roles, tool_call ids, and assistant tool-call ids.
 * - Headroom's CCR markers are naturalized so the model uses the
 *   `headroom_retrieve` tool instead of hallucinating a retrieve command.
 */
import type { OpenAIMessage } from 'headroom-ai';
import type { AssistantMessage, ContentBlock, Message, ToolResultMessage, UserMessage } from '@deepseek-ai/dsh-llm';
import type { ApplyResult, CompressionMapping, CompressionPayload } from './types.js';
/** Extracted text of one OpenAI wire message. */
export declare function extractOpenAIText(message: OpenAIMessage): string;
/** Text blocks of DSH content, joined — the tool-result view the model reads. */
export declare function extractDshText(blocks: readonly ContentBlock[]): string;
/**
 * Convert one DSH tool-result message to the OpenAI wire form sent to the
 * proxy. `undefined` when the message has no tool identity or no text.
 */
export declare function convertToolResultMessage(message: ToolResultMessage): OpenAIMessage | undefined;
/** Convert one DSH user message to the OpenAI wire form. */
export declare function convertUserMessage(message: UserMessage): OpenAIMessage | undefined;
/** Convert one DSH assistant message to the OpenAI wire form. */
export declare function convertAssistantMessage(message: AssistantMessage, renameToolCalls: boolean): OpenAIMessage | undefined;
/**
 * Build the proxy payload from DSH surface messages. Only tool-result
 * messages whose text reaches `minMessageChars` become candidates; every
 * other convertible message is compression context.
 */
export declare function buildCompressionPayload(messages: readonly Message[], minMessageChars: number, renameToolCalls: boolean): CompressionPayload;
/** Convert one DSH message to the OpenAI wire form, or `undefined`. */
export declare function convertMessage(message: Message, renameToolCalls: boolean): OpenAIMessage | undefined;
/**
 * Apply the compressed result against the payload mappings. Returns the
 * validated per-mapping text replacements; only `applyTo` mappings are
 * considered, everything else is ignored no matter what the proxy returned.
 */
export declare function applyCompressionResult(mappings: CompressionMapping[], compressedMessages: OpenAIMessage[]): ApplyResult;
/**
 * Rewrite Headroom's CCR markers (`[... Retrieve more: hash=...]`) into a
 * hint that names the `headroom_retrieve` tool, so the model retrieves the
 * original instead of hallucinating a retrieve command or re-reading files.
 */
export declare function naturalizeHeadroomMarkers(text: string): string;
/** Cheap local token estimate — footer/stat numbers only. */
export declare function estimateTokens(text: string): number;
export declare function stableHash(value: string): string;
/** Fingerprint of the outgoing converted payload (loop prevention). */
export declare function generateFingerprint(messages: OpenAIMessage[]): string;
/** Fingerprint of the candidate set only — stable across conversation drift. */
export declare function generateCandidateFingerprint(payload: CompressionPayload): string;
/**
 * Bounded FIFO of seen candidate-content hashes. Both the pre- and post-
 * compression hashes of an applied candidate are recorded, so re-reading an
 * identical file under a new tool call does not re-trigger compression.
 */
export declare class SeenContentCache {
    private readonly capacity;
    private readonly fingerprints;
    private readonly order;
    constructor(capacity: number);
    get size(): number;
    has(hash: string): boolean;
    hasAll(hashes: readonly string[]): boolean;
    add(hash: string): void;
    /** Drop `applyTo` for candidates whose original text was already seen. */
    ignoreSeen(payload: CompressionPayload): void;
    /** Record original + applied hashes for every applied mapping. */
    recordApplied(payload: CompressionPayload, changes: readonly {
        sourceIndex: number;
        nextText: string;
    }[]): void;
}
