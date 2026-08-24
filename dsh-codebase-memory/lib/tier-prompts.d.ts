/**
 * Canonical codebase-memory tier personas.
 *
 * Ported from upstream `cbm_render_graph_prompt(tier, access)`
 * (src/cli/agent_profiles.c) — the same source every client dialect renders
 * from. DIRECT = the child calls graph MCP tools itself; HANDOFF = the child
 * gets no MCP tools and cross-checks parent-supplied evidence against source.
 */
export declare const MCP_TOOL_NAMESPACE = "mcp__codebase-memory-mcp__";
/** Read-only graph tools for the Scout tier (upstream scout allow-list). */
export declare const SCOUT_MCP_TOOLS: readonly ["search_graph", "trace_path", "get_code_snippet", "get_architecture", "list_projects", "index_status", "check_index_coverage"];
/** Full read-only set for Verify/Auditor tiers. */
export declare const FULL_MCP_TOOLS: readonly ["search_graph", "trace_path", "get_code_snippet", "get_architecture", "list_projects", "index_status", "check_index_coverage", "query_graph", "search_code", "get_graph_schema", "detect_changes"];
/** DSH baseline tools every tier child keeps. */
export declare const BASE_TOOLS: readonly ["read", "grep", "glob"];
export type GraphTier = 'scout' | 'verify' | 'auditor';
export type GraphAccess = 'direct' | 'handoff';
export declare function tierPersona(tier: GraphTier, access: GraphAccess): string;
/** Model-facing delegation tool names, one per tier. */
export declare function tierToolName(tier: GraphTier): string;
export declare function tierToolFilter(tier: GraphTier, access: GraphAccess): {
    readonly allow: string[];
};
