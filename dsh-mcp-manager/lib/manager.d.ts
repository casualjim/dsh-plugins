/**
 * dsh-mcp-manager — MCP 服务器管理器（单一事实源）。
 *
 * McpManager 持有全局存储 + 当前会话项目的项目级存储、每个服务器的监督器
 * 与状态通知。全局服务器常连；项目级服务器（<项目根>/.dsh/mcp.json）只在
 * 当前会话 cwd 属于该项目时连接（跟随会话切换）。
 *
 * 类型自 types.ts 取；manager.ts 不 import apply.ts / index.ts（防循环引用）。
 */
import type { ServerResponse } from "node:http";
import type { Context, LoggerService } from "@deepseek-ai/cordis";
import type { ServerConfig, ClientUiConfig } from "./types.js";
import type { CatalogCache } from "./catalog.js";
import { McpStore } from "./store.js";
import { ConnectionSupervisor } from "./supervisor.js";
import { McpMiddleware } from "./middleware.js";
import type { MiddlewareMode, ProjectUnit, DisabledToolsMap } from "./middleware.js";
/** 中间层 all 模式的全局虚拟 root（全局服务器经中间层访问时的路由 key）。 */
export declare const MIDDLEWARE_GLOBAL_ROOT = "@global";
/**
 * 管理器：持有全局存储 + 当前会话项目的项目级存储、每个服务器的监督器
 * 与状态通知。全局服务器常连；项目级服务器（<项目根>/.dsh/mcp.json）只在
 * 当前会话 cwd 属于该项目时连接（跟随会话切换）。
 */
export declare class McpManager {
    ctx: Context;
    store: McpStore;
    supervisors: Map<string, ConnectionSupervisor>;
    listeners: Set<() => void>;
    logger: LoggerService;
    projectRoot: string | undefined;
    projectStore: McpStore | undefined;
    reconcileBusy: boolean;
    projectStores: Map<string, McpStore>;
    enhancement: {
        enhanceEmptyDescriptions?: boolean;
        resultTruncateBytes?: number;
    };
    catalogCache: CatalogCache;
    catalogCachePath: string;
    uiConfigSource: () => any;
    /** 设置命名空间写入 sink（apply 时经 ctx.inject(["settings"]) 注入；注入不到则写不可用）。 */
    uiUpdate?: (patch: Record<string, unknown>) => Promise<unknown>;
    sseConnections?: Set<ServerResponse>;
    /** SSE 心跳定时器清理函数（makeEventsRoute 注册；卸载 disposer 统一执行，#268）。 */
    sseHeartbeatCleanups?: Set<() => void>;
    /** 中间层模式（Config.middleware 归一化）。 */
    middlewareMode: MiddlewareMode;
    /** 中间层实例（连接池 + 目录 + 路由；惰性创建）。 */
    middleware: McpMiddleware | undefined;
    /** userDisabled 持久化路径。 */
    userStatePath: string;
    /** 运行时注册表（内存态，不落盘）：供其他插件经 ctx.mcpManager 注入服务器。
     * 双轨 reconcile：store.data.servers（持久化）+ runtimeRegistry（运行时）。
     * 同名冲突策略：runtime 优先（运行时注入是「当前会话」语义）。 */
    runtimeRegistry: Map<string, ServerConfig>;
    /** registerServer 串行队列（防 reconcileBusy 吞注册；多插件并发注册排队）。 */
    private registerQueue;
    constructor(ctx: Context, store: McpStore);
    /** 读取 settings 命名空间中的 MCP UI 配置（供 /api/dsh-mcp/config 返回）。 */
    uiConfig(): ClientUiConfig;
    /**
     * 写入浮窗 UI 配置（/api/dsh-mcp/config POST）。
     * 把客户端扁平形态归一化为 `Config.ui` 嵌套补丁，经设置命名空间持久化
     * （settings.update 落盘 → scope.watch → onChange → SSE 广播一帧），随后返回
     * 归一化后的最新配置。settings 服务不可用时抛错（写不可用）。
     */
    updateUiConfig(raw: unknown): Promise<ClientUiConfig>;
    /** 从磁盘加载目录缓存（损坏/缺失 → 空缓存，不崩溃）。 */
    loadCatalogCache(): Promise<void>;
    /**
     * 连接成功后记录工具描述摘要到目录缓存（**只在摘要实质变化时落盘**——
     * 保证重连拿到相同描述不触发 digest 变化、不重复注入）。
     * 缓存是持久数据（磁盘），与实时连接状态解耦：断开/重连不清空 → 目录稳定。
     */
    recordCatalogTools(serverName: string, toolMeta: Map<string, {
        description?: unknown;
    }>): Promise<void>;
    onStatus(handler: () => void): () => void;
    /** coalesce 定时器（同一 tick 内多次状态变化合并为一次广播）。 */
    private statusTimer;
    /** 状态变化广播（coalesce：同 tick 多次 emitStatus 只广播一次，防 SSE 风暴）。 */
    emitStatus(): void;
    /** 项目根发现：从 cwd 向上找 .git / .dsh / .mcp.json 标记，找不到用 cwd 本身。
     *  .dsh 标记须排除 DSH 全局家目录（默认 ~/.dsh，尊重 DSH_HOME）——否则 home
     *  下任何无标记目录（如 ~/dev/leetcode）向上都会命中 ~/.dsh，把 home 误判为
     *  项目根并加载 ~/.dsh/mcp.json，导致别的会话串入不属于它的项目级 MCP。 */
    findProjectRoot(cwd: string | undefined): Promise<string>;
    /** 当前会话的项目级存储（无活动项目时抛错）。 */
    projectStoreOrThrow(): Promise<McpStore>;
    /** 归一化项目根（realpath；失败回退 resolve）。中间层路由使用。 */
    normalizedProjectRoot(cwd: string | undefined): Promise<string | undefined>;
    /** 中间层宿主：按 root 读取服务器配置。all 模式的虚拟 root "@global" 返回全局配置。 */
    projectServersFor(root: string): Promise<ServerConfig[] | undefined>;
    /** 中间层宿主：该 server 是否全局级（双源：store + runtimeRegistry）。
     * codegraph 等 runtime 注册的服务器不落 store，单源会误判「非全局」——P1 修正。 */
    isGlobalServer(name: string): boolean;
    /** 中间层宿主：全局服务器配置（all 模式使用）。 */
    globalServers(): ServerConfig[];
    /** 中间层宿主：持久化 userDisabled。 */
    saveUserState(units: Map<string, ProjectUnit>): Promise<void>;
    /** 中间层宿主：root 的目录缓存文件路径。 */
    catalogCachePathFor(root: string): string;
    /** 初始化中间层（apply 时按模式调用；幂等）。 */
    initMiddleware(mode: MiddlewareMode, policy: Record<string, unknown>): Promise<McpMiddleware>;
    /** userDisabled 映射（root → Set<server>），中间层单元创建时合并。 */
    disabledByRoot: Map<string, Set<string>>;
    /** 工具级禁用（root → server → Set<tool>）；root=@global 跨工作空间共享。 */
    disabledTools: DisabledToolsMap;
    /** 中间层模式热切换（apply 注入；设置页「中间层模式」下拉调用）。 */
    setMiddlewareMode?: (mode: MiddlewareMode) => Promise<void>;
    /**
     * 设置/解除单个工具禁用（宿主 API PATCH /api/dsh-mcp/tool-disable 调用）。
     * 合并式写盘（先读现有文件再覆盖本 root 段，绝不整表覆盖）——
     * 防多工作空间互相抹掉禁用记录。
     * @param root 目标 root（全局服务器用 MIDDLEWARE_GLOBAL_ROOT）。
     * @param server 服务器裸名。
     * @param tool 远端工具裸名。
     * @param disabled true=禁用 / false=解除。
     * 工具级禁用独立于服务器级 enabled：服务器级复活不清工具级状态。
     */
    setToolDisabled(root: string, server: string, tool: string, disabled: boolean): Promise<void>;
    /** 读取/复用某项目根的 store（工作区缓存命中直接返回，不重复读盘）。 */
    projectStoreFor(root: string | undefined): Promise<McpStore | undefined>;
    /**
     * 会话目录数据源：全局服务器 + 该 cwd 所属项目的项目级服务器（**配置层面**，
     * 与 host 当前 setSession 状态解耦）。此前直接用 manager.supervisors（实时
     * 连接状态、跟随"当前工作区"）——切换工作区会断开/连接项目级服务器，导致
     * 别的会话的目录集合抖动、每次抖动注入一条目录更新消息。按 cwd 计算后：
     * 工作区 MCP 没变化 → digest 不变 → 不重新注入。
     *
     * 运行时注入（registerServer 的 runtimeRegistry，内存态）同样并入目录数据源
     * （#359）：dsh-codegraph 等插件经运行时注入注册的服务器，连接成功、工具可用，
     * 但此前不在目录里——模型看不到能力，只能自己翻 CLI。同名 runtime 优先
     * （与 reconcile 双轨一致）。
     */
    catalogServersFor(cwd: string | undefined): Promise<Map<string, {
        server: ServerConfig;
        scope: string;
    }>>;
    /**
     * 会话切换：只切 currentRoot + fire-and-forget 惰性启动（不 await 任何连接）。
     * 变更点驱动（#111/#228）：POST /api/dsh-mcp/session 永不挂起——连接/发现
     * 由中间层惰性驱动（per-root in-flight 去重），此处零连接副作用。
     * 兼容语义：middleware=off（旧行为）时切走仍断开旧项目 supervisor；
     * middleware=project/all 时项目级连接由中间层池常驻，切走不断开。
     */
    setSession(cwd: string | undefined): Promise<void>;
    /**
     * 重读磁盘配置（全局 + 当前项目）并同步连接集合。
     * 供「浮窗刷新」等读取路径调用：外部修改 mcp.json 后无需重启宿主。
     * 仅在配置或连接集合实际变化时广播，避免空转 SSE → 客户端 refresh 循环。
     * 变更点驱动（#111）：读取路径不再调用本方法（GET /servers 纯读）；本方法
     * 仅由 fs.watch 变更点与用户操作 API 调用。
     */
    refreshFromDisk(): Promise<void>;
    /**
     * 按当前配置同步 supervisor：配置中移除/禁用的断开，新增/恢复的启动。
     * 同步方法（start/stop 均为同步登记 + 异步连接）；防重入（读取路径可并发）。
     * @returns {boolean} 是否有连接集合变化
     */
    reconcileServers(): boolean;
    startAll(): Promise<void>;
    /**
     * 启动服务器监督器。
     * @param name 服务器名
     * @param scope 作用域（全局/项目）
     * @param directConfig 运行时 config 直传（registerServer 注入路径；缺省读 store）。
     *   修 P0（评审③）：同名 runtime 优先生效——store 已有同名时，直传 config 优先于 store 版本。
     */
    start(name: string, scope?: string, directConfig?: ServerConfig): void;
    /**
     * 中间层接管判定（start / reconcileServers 单一口径）：中间层模式的项目级，
     * 或 all 模式下非 runtime 注入的全局级。runtime 条目豁免（始终走 supervisor
     * 路径，注册 mcp__ 工具）。
     */
    private middlewareTakes;
    /**
     * 触达 @global 单元并确保该全局服务器连接（all 模式 start 接管路径）。
     * projectUnitFor 首次触达会连带惰性连接全部全局服务器，等价 startAll 语义；
     * userDisabled 命中不连（与浮窗断开语义一致）。
     */
    private touchGlobalUnit;
    /**
     * 拆除中间层池中该 server 的连接（update/remove 配置变更后强制重建；
     * 不写 userDisabled——与 disconnect 的禁用语义区分）。此前 update/remove 仅
     * 处理项目单元，all 模式全局池连接与目录残留导致「已删服务器仍可调用」。
     */
    private dropMiddlewareConnection;
    stop(name: string): void;
    /**
     * 运行时注册服务器（内存态，不落盘）。
     * 供其他插件经 ctx.mcpManager 注入（官方 storageDomain service 模式）。
     * - 同名已存在（store 或 runtime）：返回 { name, existing: true }，不抛错；
     * - 注册即连接（走 start 的 config 直传分支，同名 runtime 优先）；
     * - 串行队列防 reconcileBusy 吞注册；多插件并发注册排队。
     * @param options 注册入参；`toolDefinitions` 可选——提供时该服务器工具
     *   全部用调用方封装定义注册（supervisor 跳过远端 schema 投影，execute
     *   来自调用方；命名仍按 publicToolName 的 mcp__ 前缀规则）。
     */
    registerServer(options: Record<string, unknown>): Promise<{
        name: string;
        existing: boolean;
    }>;
    /**
     * 运行时注销（不影响 store 持久化条目；同名 store 条目回落）。
     * - 销毁 supervisor（stop，不碰 store）；
     * - 移除 runtimeRegistry 条目 → 下次 reconcile 回落 store 配置。
     */
    unregisterServer(name: string): Promise<void>;
    add(server: Record<string, unknown>, scope?: string): Promise<ServerConfig>;
    update(name: string, patch: Record<string, unknown>, scope?: string): Promise<ServerConfig>;
    remove(name: string, scope?: string): Promise<void>;
    /** 中间层辅助：拆毁当前 root 单元（配置变更后强制惰性重建）。 */
    private touchMiddlewareUnit;
    connect(name: string, scope?: string, directConfig?: ServerConfig): Promise<void>;
    disconnect(name: string): Promise<void>;
    reconnect(name: string, scope?: string): Promise<void>;
    /** 面板数据：配置 + 实时状态 + 工具列表 + 项目信息。 */
    summary(): Record<string, unknown>;
    /**
     * 中间层投影单元：该 server 在当前模式下由中间层接管时返回其所在单元，
     * 否则 undefined（supervisor 路径照旧）。project 模式仅项目级走池；
     * all 模式全局也经虚拟 root @global 走池（与 reconcileServers 的
     * middlewareTakes 判定同口径）。
     */
    private middlewareUnitFor;
    summarize(server: ServerConfig, scope: string): Record<string, unknown>;
    dispose(): Promise<void>;
}
