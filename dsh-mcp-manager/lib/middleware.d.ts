/**
 * dsh-mcp-manager — 中间层（工作空间 MCP 路由）。
 *
 * 模型面恒定两个工具（ws_mcp_search / ws_mcp_call），执行时按调用方会话
 * 当前 cwd（agent.session.header.cwd，实证已闭合）路由到对应工作空间的
 * MCP 连接池，实现「不同工作空间注入不同 MCP、无命名冲突」：
 * - 连接池：每工作空间一套常驻连接（惰性连接 + 超时 + LRU 淘汰）；
 * - 目录：每工作空间 ToolCatalog（惰性发现 + last-good 磁盘缓存 + 检索）；
 * - 策略：server/tool 两级 glob（deny 优先），按 @root/server 全名配置；
 * - 容错：normalizeToolName / normalizeArguments / msgOf / createRedactor。
 *
 * 双轨迁移：middleware 配置为 "off"（默认直呼）/ "project"（项目级走中间层，
 * 全局 mcp__ 直呼）/ "all"（全部走中间层）。
 *
 * 职责拆分（#286 附加）：本文件保留连接池核心（McpMiddleware 类）并汇聚
 * 转发全部公共符号——常量（middleware-const）、纯函数与目录检索
 * （middleware-utils）、状态持久化（middleware-state）、工具注册
 * （middleware-register）、类型（middleware-types）；index.ts / manager.ts
 * 的 import 与 re-export 面保持不变。
 */
import type { MiddlewareHost, ProjectUnit, MiddlewarePolicy, DisabledToolsMap } from "./middleware-types.js";
/**
 * 中间层：工作空间 MCP 连接池 + 目录 + 路由执行。
 * 一个实例服务所有工作空间（projectUnits: Map<root, ProjectUnit>）。
 */
export declare class McpMiddleware {
    host: MiddlewareHost;
    /** root（realpath 归一化）→ 工作空间单元。 */
    units: Map<string, ProjectUnit>;
    /** 策略（按 @root/server 全名配置）。 */
    policy: MiddlewarePolicy;
    /** 用户禁用映射（root → Set<server>），单元创建时合并。 */
    disabledByRoot: Map<string, Set<string>>;
    /** 工具级禁用（root → server → Set<tool>；root=@global 跨工作空间共享）。 */
    disabledTools: DisabledToolsMap;
    constructor(host: MiddlewareHost, policy?: MiddlewarePolicy);
    /** 读取/创建 root 的单元（root 无项目标记 → undefined）。 */
    projectUnitFor(root: string | undefined): Promise<ProjectUnit | undefined>;
    /** 连接一个服务器（in-flight 去重；失败后台重连）。 */
    ensureConnected(root: string, serverName: string): Promise<void>;
    private connectInternal;
    /** 后台重连（有界指数退避：500ms 起、30s 上限、10 次后停止后台重试；
     * 用户手动 connect 或 ws_mcp_call 触发时重新尝试——常驻语义）。 */
    private scheduleReconnect;
    /**
     * 防双进程探测命中后的一次性有界重试（#382 F5）。定时器复用 entry.reconnectTimer
     * 槽位（teardownUnit/disconnect 路径统一清理）；重试经 ensureConnected——它
     * 查 userDisabled + in-flight 去重，不会复活用户已断开的服务器、不与手动重连
     * 并发冲突。每代 entry 只重试一次（probeRetried 标记；连接成功复位），官方
     * dsh-mcp-client 真接管时不会反复空转。
     */
    private scheduleProbeRetry;
    /** 发现工具并写入目录（per-root in-flight 去重）。 */
    discover(root: string, serverName: string): Promise<void>;
    /** 凭据脱敏（连接/发现/调用错误路径统一使用；P1 修复）。 */
    private redact;
    private listToolsAll;
    /** 目录 last-good 持久化（空采集不写盘；public 供测试与外部触发）。 */
    persistCatalog(root: string): Promise<void>;
    /** 加载 root 的 last-good 目录缓存（缺失/损坏 → 空）。 */
    loadCatalogCache(root: string): Promise<void>;
    /** 执行 ws_mcp_call：路由 + 一致性校验 + 策略 + 调用。 */
    callTool(fullName: string, toolRaw: string, rawArgs: unknown, signal: AbortSignal | undefined): Promise<unknown>;
    private hostRedact;
    private allServers;
    /** LRU 淘汰：无活动引用（lastTouchedAt 最旧）且超过上限时淘汰最旧单元。
     * @global 单元豁免（#382 F3）：全局服务器常连语义不随多项目切换被淘汰
     * （supervisor 时代全局永不淘汰，池接管后需显式豁免保持等价语义）。 */
    evictIfNeeded(maxUnits?: number): void;
    /** 拆毁一个单元（断开全部连接，保留目录缓存）。 */
    teardownUnit(root: string): void;
    /** 全部拆毁（插件卸载）。 */
    dispose(): Promise<void>;
}
export { CONNECT_TIMEOUT_MS, DISCOVERY_TIMEOUT_MS, CALL_TIMEOUT_MS, CATALOG_TTL_MS, CATALOG_LRU_MAX, MAX_TOOLS_PER_SERVER, MAX_BYTES_PER_TOOL, MAX_TOTAL_CATALOG_BYTES, LIST_DEFAULT_TOOLS_PER_SERVER, LIST_MAX_TOOLS_PER_SERVER, normalizeMiddlewareMode, } from "./middleware-const.js";
export { withTimeout, fullServerName, parseFullServerName, normalizeToolName, normalizeArguments, msgOf, createRedactor, globMatch, policyAllows, bareServerName, policyDenialReason, isToolDenied, toolDisabledReason, parseDisabledTools, scoreTool, searchCatalog, searchCatalogMulti, listCatalog, findToolDetail, MIDDLEWARE_GLOBAL_ROOT, } from "./middleware-utils.js";
export { userStateFile, loadUserState, saveUserState, catalogCacheFileFor, loadDisabledTools, saveDisabledTools } from "./middleware-state.js";
export { registerMiddlewareTools } from "./middleware-register.js";
export type { MiddlewareMode, MiddlewarePolicy, ProjectUnit, ConnectionEntry, CatalogServer, CatalogTool, SearchHit, ListToolEntry, ListServerEntry, ListCatalogResult, ToolDetail, MiddlewareHost, DisabledToolsMap, } from "./middleware-types.js";
