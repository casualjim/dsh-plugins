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
import { Context, Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ToolResultMessage } from '@deepseek-ai/dsh-llm';
import type { Session } from '@deepseek-ai/dsh-session';
import type { CommandDefinition } from '@deepseek-ai/dsh-commands';
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { HeadroomTransport } from './transport.js';
import type { HeadroomConfig, HeadroomMode, HeadroomPassResult, HeadroomStats, ResolvedHeadroomConfig } from './types.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        headroom: HeadroomCompressor;
    }
}
/** Replace the text blocks of one DSH tool-result message with compressed text. */
export declare function withCompressedContent(message: ToolResultMessage, text: string): ToolResultMessage;
export declare class HeadroomCompressor extends Service {
    static inject: string[];
    static Config: z<Schemastery.ObjectS<{
        enabled: z<boolean, boolean>;
        baseUrl: z<string | null, string | null>;
        mode: z<"normal" | "quiet" | "silent", "normal" | "quiet" | "silent">;
        minContextTokens: z<number, number>;
        minMessageChars: z<number, number>;
        timeoutMs: z<number, number>;
        throttleMs: z<number, number>;
        allowRemote: z<boolean, boolean>;
        renameToolCalls: z<boolean, boolean>;
        maxSeenFingerprints: z<number, number>;
    }>, Schemastery.ObjectT<{
        enabled: z<boolean, boolean>;
        baseUrl: z<string | null, string | null>;
        mode: z<"normal" | "quiet" | "silent", "normal" | "quiet" | "silent">;
        minContextTokens: z<number, number>;
        minMessageChars: z<number, number>;
        timeoutMs: z<number, number>;
        throttleMs: z<number, number>;
        allowRemote: z<boolean, boolean>;
        renameToolCalls: z<boolean, boolean>;
        maxSeenFingerprints: z<number, number>;
    }>>;
    /** Current effective configuration (row config, then live settings writes). */
    get config(): ResolvedHeadroomConfig;
    /** Per-process cumulative counters. */
    readonly stats: HeadroomStats;
    private runtime;
    private _transport;
    private readonly seen;
    private enabled;
    private mode;
    private processing;
    private lastCompressionTime;
    private lastInputFingerprint;
    private lastOutputFingerprint;
    private lastGuardSkipCandidateFingerprint;
    private degradedWarningShown;
    constructor(ctx: Context, config?: HeadroomConfig);
    /** The configured proxy transport, or `null` when degraded. */
    get transport(): HeadroomTransport | null;
    /** Live enabled state (mutated by `/headroom on|off`). */
    isEnabled(): boolean;
    /** Live output mode (mutated by `/headroom mode`). */
    getMode(): HeadroomMode;
    /** Whether a proxy transport is configured and usable. */
    get ready(): boolean;
    /**
     * Register the `headroom` settings namespace so configuration UIs can read
     * and write it (persisted by the settings-file provider). Row config is the
     * composition `base`; user settings layer on top; live writes are applied
     * to the running service through {@link applySettings}.
     */
    private installSettingsSection;
    /** Re-resolve and live-apply a new configuration (settings write or attach). */
    applySettings(next: ResolvedHeadroomConfig): void;
    /**
     * Run one compression pass over the current session surface when the gates
     * allow it. Returns `null` when no pass was needed or possible.
     */
    considerPass(session: Session, signal: AbortSignal): Promise<HeadroomPassResult | null>;
    /** Estimate the token count of the current surface messages. */
    estimateSurfaceTokens(session: Session): number;
    /**
     * Compress the current tool-result surface nodes. Snapshots the surface,
     * sends the converted payload to the configured proxy, and lands validated
     * tool-result replacements with the shared shadow-price protocol.
     */
    compressSession(session: Session, signal: AbortSignal): Promise<HeadroomPassResult | null>;
    /** Fetch one CCR original from the configured proxy. */
    retrieve(hash: string): Promise<string>;
    toggle(enabled: boolean): void;
    setMode(mode: HeadroomMode): void;
    private recordSkip;
    private warnDegraded;
    private announceApplied;
}
/** The `/headroom` command. Exported for registration tests. */
export declare function buildHeadroomCommand(service: HeadroomCompressor): CommandDefinition;
/** The model-facing CCR retrieval tool. */
export declare function buildRetrieveTool(service: HeadroomCompressor): ToolDefinition;
export default HeadroomCompressor;
