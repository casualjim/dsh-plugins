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
import { createHash } from 'node:crypto';
/** Extracted text of one OpenAI wire message. */
export function extractOpenAIText(message) {
    if (message.role === 'assistant')
        return typeof message.content === 'string' ? message.content : '';
    if (message.role === 'tool' || message.role === 'system')
        return message.content;
    if (typeof message.content === 'string')
        return message.content;
    return message.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n');
}
/** Text blocks of DSH content, joined — the tool-result view the model reads. */
export function extractDshText(blocks) {
    return blocks
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
}
function extractUserText(message) {
    return extractDshText(message.content);
}
function extractAssistantText(message) {
    return extractDshText(message.content);
}
function isToolCallBlock(block) {
    return block.type === 'tool-call'
        && typeof block.id === 'string'
        && typeof block.name === 'string'
        && typeof block.arguments === 'string';
}
/**
 * Convert one DSH tool-result message to the OpenAI wire form sent to the
 * proxy. `undefined` when the message has no tool identity or no text.
 */
export function convertToolResultMessage(message) {
    const result = message.content[0];
    if (result === undefined || message.source.kind !== 'tool')
        return undefined;
    const callId = message.source.callId;
    if (!callId)
        return undefined;
    const text = extractDshText(result.content);
    if (text.length === 0)
        return undefined;
    return { role: 'tool', content: text, tool_call_id: callId };
}
/** Convert one DSH user message to the OpenAI wire form. */
export function convertUserMessage(message) {
    const text = extractUserText(message);
    if (text.length === 0)
        return undefined;
    return { role: 'user', content: text };
}
/** Convert one DSH assistant message to the OpenAI wire form. */
export function convertAssistantMessage(message, renameToolCalls) {
    const text = extractAssistantText(message);
    const toolCalls = message.content.filter(isToolCallBlock);
    if (text.length === 0 && toolCalls.length === 0)
        return undefined;
    const converted = { role: 'assistant', content: text.length === 0 ? null : text };
    if (toolCalls.length > 0) {
        converted.tool_calls = toolCalls.map((call) => convertToolCall(call, renameToolCalls));
    }
    return converted;
}
function convertToolCall(call, rename) {
    if (rename) {
        // Headroom protects exact tool names (read, bash, ...) in its
        // DEFAULT_EXCLUDE_TOOLS. Renaming defeats the exclusion so large reads
        // actually get compressed; the original DSH history is never touched.
        return {
            id: call.id,
            type: 'function',
            function: {
                name: 'pi_tool_result',
                arguments: JSON.stringify({ originalToolName: call.name }),
            },
        };
    }
    return {
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: call.arguments },
    };
}
/**
 * Build the proxy payload from DSH surface messages. Only tool-result
 * messages whose text reaches `minMessageChars` become candidates; every
 * other convertible message is compression context.
 */
export function buildCompressionPayload(messages, minMessageChars, renameToolCalls) {
    const mappings = [];
    let candidateCount = 0;
    for (let sourceIndex = 0; sourceIndex < messages.length; sourceIndex++) {
        const source = messages[sourceIndex];
        const converted = convertMessage(source, renameToolCalls);
        if (converted === undefined)
            continue;
        const originalText = extractOpenAIText(converted);
        let applyTo = source.source.kind === 'tool'
            ? 'toolResult'
            : null;
        if (applyTo !== null && originalText.length < minMessageChars)
            applyTo = null;
        if (applyTo !== null)
            candidateCount++;
        mappings.push({ sourceIndex, message: converted, applyTo, originalText });
    }
    return {
        messages: mappings.map((mapping) => mapping.message),
        mappings,
        candidateCount,
    };
}
/** Convert one DSH message to the OpenAI wire form, or `undefined`. */
export function convertMessage(message, renameToolCalls) {
    if (message.role === 'assistant')
        return convertAssistantMessage(message, renameToolCalls);
    if (message.source.kind === 'tool')
        return convertToolResultMessage(message);
    if (message.source.kind === 'user')
        return convertUserMessage(message);
    return undefined;
}
function validateAlignedMessage(original, compressed) {
    if (original.role !== compressed.role) {
        return { ok: false, reason: `role-changed:${original.role}->${compressed.role}` };
    }
    if (original.role === 'tool' && compressed.role === 'tool') {
        if (original.tool_call_id !== compressed.tool_call_id)
            return { ok: false, reason: 'tool-call-id-changed' };
    }
    if (original.role === 'assistant' && compressed.role === 'assistant') {
        const originalIds = (original.tool_calls ?? []).map((call) => call.id).join('\n');
        const compressedIds = (compressed.tool_calls ?? []).map((call) => call.id).join('\n');
        if (originalIds !== compressedIds)
            return { ok: false, reason: 'assistant-tool-calls-changed' };
    }
    return { ok: true };
}
/**
 * Apply the compressed result against the payload mappings. Returns the
 * validated per-mapping text replacements; only `applyTo` mappings are
 * considered, everything else is ignored no matter what the proxy returned.
 */
export function applyCompressionResult(mappings, compressedMessages) {
    if (compressedMessages.length !== mappings.length) {
        return { ok: false, reason: 'message-count-changed' };
    }
    const changes = [];
    for (let index = 0; index < mappings.length; index++) {
        const mapping = mappings[index];
        if (mapping.applyTo === null)
            continue;
        const compressed = compressedMessages[index];
        const validation = validateAlignedMessage(mapping.message, compressed);
        if (!validation.ok)
            return validation;
        const nextText = naturalizeHeadroomMarkers(extractOpenAIText(compressed));
        if (nextText === mapping.originalText)
            continue;
        changes.push({
            sourceIndex: mapping.sourceIndex,
            originalText: mapping.originalText,
            nextText,
        });
    }
    if (changes.length === 0)
        return { ok: false, reason: 'no-applicable-message-changed' };
    return { ok: true, changes };
}
/**
 * Rewrite Headroom's CCR markers (`[... Retrieve more: hash=...]`) into a
 * hint that names the `headroom_retrieve` tool, so the model retrieves the
 * original instead of hallucinating a retrieve command or re-reading files.
 */
export function naturalizeHeadroomMarkers(text) {
    return text.replace(/\[(.*?(?:compressed|omitted).*?)\.?\s*Retrieve more: hash=([a-f0-9]+)\]/gi, '[$1. Retrieve the full original with the `headroom_retrieve` tool using hash=$2.]');
}
/** Cheap local token estimate — footer/stat numbers only. */
export function estimateTokens(text) {
    return text.length === 0 ? 0 : Math.max(1, Math.ceil(text.length / 4));
}
export function stableHash(value) {
    return createHash('sha256').update(value).digest('hex');
}
/** Fingerprint of the outgoing converted payload (loop prevention). */
export function generateFingerprint(messages) {
    return messages
        .map((message) => {
        const text = extractOpenAIText(message);
        return `${message.role}:${text.length}:${stableHash(text)}`;
    })
        .join(',');
}
/** Fingerprint of the candidate set only — stable across conversation drift. */
export function generateCandidateFingerprint(payload) {
    const units = payload.mappings
        .filter((mapping) => mapping.applyTo !== null)
        .map((mapping) => ({
        applyTo: mapping.applyTo,
        sourceIndex: mapping.sourceIndex,
        role: mapping.message.role,
        toolCallId: mapping.message.role === 'tool' ? mapping.message.tool_call_id : null,
        textLength: mapping.originalText.length,
        textHash: stableHash(mapping.originalText),
    }));
    return stableHash(JSON.stringify(units));
}
/**
 * Bounded FIFO of seen candidate-content hashes. Both the pre- and post-
 * compression hashes of an applied candidate are recorded, so re-reading an
 * identical file under a new tool call does not re-trigger compression.
 */
export class SeenContentCache {
    capacity;
    fingerprints = new Set();
    order = [];
    constructor(capacity) {
        this.capacity = capacity;
    }
    get size() {
        return this.fingerprints.size;
    }
    has(hash) {
        return this.fingerprints.has(hash);
    }
    hasAll(hashes) {
        return hashes.length > 0 && hashes.every((hash) => this.fingerprints.has(hash));
    }
    add(hash) {
        if (this.fingerprints.has(hash))
            return;
        this.fingerprints.add(hash);
        this.order.push(hash);
        while (this.order.length > this.capacity) {
            const oldest = this.order.shift();
            if (oldest !== undefined)
                this.fingerprints.delete(oldest);
        }
    }
    /** Drop `applyTo` for candidates whose original text was already seen. */
    ignoreSeen(payload) {
        if (this.fingerprints.size === 0)
            return;
        for (const mapping of payload.mappings) {
            if (mapping.applyTo !== null && this.fingerprints.has(stableHash(mapping.originalText))) {
                mapping.applyTo = null;
            }
        }
    }
    /** Record original + applied hashes for every applied mapping. */
    recordApplied(payload, changes) {
        const appliedSources = new Map(changes.map((change) => [change.sourceIndex, change.nextText]));
        for (const mapping of payload.mappings) {
            if (mapping.applyTo === null)
                continue;
            this.add(stableHash(mapping.originalText));
            const nextText = appliedSources.get(mapping.sourceIndex);
            if (nextText !== undefined)
                this.add(stableHash(nextText));
        }
    }
}
