/** DSH raw-discovery tools the gate watches (lowercase DSH names). */
export declare const RAW_DISCOVERY_TOOLS: Set<string>;
/**
 * Session reminder injected at session start and into spawned subagents.
 * Tool names use the dsh mcp-client surface (`mcp__<server>__<tool>`).
 */
export declare const SESSION_REMINDER: string;
/** Gate guidance attached once after the first raw discovery call. */
export declare const DISCOVERY_GATE_NOTICE: string;
/**
 * Longest identifier-like token in a raw discovery argument, min 4 chars.
 * Ported from the pi extension's extractSearchToken.
 */
export declare function extractSearchToken(value: unknown): string | undefined;
/** Pull the token the gate augments on, from one tool call's arguments. */
export declare function gateToken(toolName: string, args: unknown): string | undefined;
interface SearchGraphResult {
    results?: Array<{
        qualified_name?: unknown;
        name?: unknown;
        file_path?: unknown;
        label?: unknown;
    }>;
}
export declare function formatAugmentation(token: string, results: NonNullable<SearchGraphResult['results']>): string;
/**
 * Project candidates to try for one augmentation: the workspace dir name and a
 * bounded walk-up, mirroring the pi extension.
 */
export declare function projectCandidates(cwd: string): string[];
/**
 * Run one bounded `cli search_graph` augmentation across candidate projects.
 * Returns undefined (silently) when the binary is missing, nothing matches,
 * or the budget expires.
 */
export declare function buildGraphAugmentation(bin: string, cwd: string, token: string, budgetMs: number, signal: AbortSignal | undefined): Promise<string | undefined>;
export {};
