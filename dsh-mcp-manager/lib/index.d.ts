/**
 * dsh-mcp-manager — 主机端（组合根）。
 *
 * 管理本机的 MCP（Model Context Protocol）服务器并桥接到 DSH：
 *  - 服务器配置持久化在 `~/.dsh/dsh-mcp.json`（版本化，原子写入）；
 *  - 每个服务器一个连接监督器（supervisor）：stdio / streamable-http 两种
 *    传输，指数退避重连，断开后按预算放弃；
 *  - 已连接服务器的工具以 `mcp__<serverName>__<rawName>` 注册进
 *    `ctx.tools`，模型可直接调用（与官方 dsh-mcp-client 同名契约）；
 *  - `/api/dsh-mcp/*` 路由（loopback-only）供 web GUI 分级展示、快速
 *    接入、粘贴 mcpServers JSON 导入；
 *  - 零运行时依赖：MCP 协议客户端（JSON-RPC over stdio / streamable-http）
 *    直接基于 node:child_process 与全局 fetch 实现。
 *
 * 激活：安装进 profile（见 cordis.patch.yml 注释），重启一次 dsh web 后，
 * 侧边栏出现「MCP」入口。
 *
 * 结构：职责按模块拆分（store / transport / protocol / supervisor /
 * routes / catalog / import / normalize / config-schema / manager / apply），
 * 本文件保留插件契约转发（apply）与全部公共符号 re-export（导出面不变）。
 */
/** 稳定的 cordis 插件名。 */
export declare const name = "mcp-manager";
/** 需要已初始化的工具注册表、web 服务器与提示词组装器。 */
export declare const inject: string[];
export { DEFAULT_Z_INDEX_BASE, Z_INDEX_BASE_MIN, Z_INDEX_BASE_MAX, Z_INDEX_PANEL_DELTA, BREAKPOINT_NARROW_MAX, BREAKPOINT_TABLET_MAX, clampZIndexBase, panelZIndexFor, breakpointForWidth, clampPointToViewport, composerDockedAtBottom, bottomAnchorEdge, } from "./placement-math.js";
export type { FloatBreakpoint, ViewportPoint, RectLike } from "./placement-math.js";
export { panelAnchorForPosition } from "./placement-math.js";
export { apply, MCP_GUIDANCE } from "./apply.js";
export { SERVER_NAME_PATTERN, normalizeServer } from "./normalize.js";
export { DEFAULT_UI_CONFIG, DEFAULT_ENHANCE_EMPTY_DESCRIPTIONS, normalizeUiConfig, buildConfigUiPatch, panelTopForAnchor, Config, } from "./config-schema.js";
export type { UiPlacementConfig, ClientUiConfig } from "./types.js";
export { McpManager, MIDDLEWARE_GLOBAL_ROOT } from "./manager.js";
export type { McpManagerServerInput, McpManagerService } from "./service.js";
export { defaultStorePath, McpStore } from "./store.js";
export { expandEnv, HttpTransport, parseSsePayload, StdioTransport, createTransport } from "./transport.js";
export { MCPClient } from "./protocol.js";
export { DEFAULT_TOOL_CALL_TIMEOUT_MS, RECONNECT_DEFAULTS, DEFAULT_RESULT_TRUNCATE_BYTES, publicToolName, truncateText, assertSupportedOutputSchema, buildToolDefinition, ConnectionSupervisor, resolveReconnect, } from "./supervisor.js";
export { DEFAULT_ANNOUNCE_CATALOG, DEFAULT_CATALOG_MAX_ENTRIES, catalogCacheFile, summarizeToolDescriptions, composeCatalogEntries, digestCatalogEntries, renderMcpCatalogMessage, escapeCatalogText, findCatalogMessage, readCatalogEntries, catalogHistory, renderMcpCatalogUpdate, resolveCatalogInjection, } from "./catalog.js";
export { fromClaudeEntry, parseClaudeJson } from "./import.js";
export { McpMiddleware, normalizeMiddlewareMode, registerMiddlewareTools, fullServerName, parseFullServerName, normalizeToolName, normalizeArguments, msgOf, createRedactor, globMatch, policyAllows, policyDenialReason, isToolDenied, toolDisabledReason, parseDisabledTools, scoreTool, searchCatalog, searchCatalogMulti, listCatalog, findToolDetail, withTimeout, userStateFile, loadUserState, saveUserState, loadDisabledTools, saveDisabledTools, catalogCacheFileFor, CONNECT_TIMEOUT_MS, DISCOVERY_TIMEOUT_MS, CALL_TIMEOUT_MS, CATALOG_TTL_MS, CATALOG_LRU_MAX, MAX_TOOLS_PER_SERVER, MAX_BYTES_PER_TOOL, MAX_TOTAL_CATALOG_BYTES, LIST_DEFAULT_TOOLS_PER_SERVER, LIST_MAX_TOOLS_PER_SERVER, } from "./middleware.js";
export type { MiddlewareMode, MiddlewarePolicy, ProjectUnit, SearchHit, ListToolEntry, ListServerEntry, ListCatalogResult, ToolDetail, DisabledToolsMap, } from "./middleware.js";
export { ROUTES, makeRoutes, makeEventsRoute, makeHealthRoute, sseData, uiConfigChangedFrame, broadcastFrame, SSE_HEARTBEAT_MS, SSE_PING_FRAME } from "./routes.js";
export { SCOPE_GLOBAL, SCOPE_PROJECT, normalizeScope } from "./scope.js";
export { isLoopbackRequest } from "../shared/loopback.js";
export { writeJson, readJsonBody } from "../shared/host-utils.js";
