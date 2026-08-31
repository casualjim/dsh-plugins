/**
 * dsh-mcp-manager — HTTP 路由（依赖 import 模块与仓库共享层）。
 *
 * /api/dsh-mcp/* 路由（loopback-only）供 web GUI 分级展示、快速接入、
 * 导入 mcpServers JSON；events 为 SSE 状态推送通道。
 * 例外：/api/dsh-mcp/config 是只读 UI 配置接口，允许非 loopback 访问，
 * 便于远程页面读取 position/offset 等非敏感展示配置。
 * 由 lib/index.js 组合根 re-export（ROUTES / makeRoutes）。
 */
import type { ServerConfig } from "./types.js";
import type { ClientUiConfig } from "./index.js";
import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
import type { ServerResponse } from "node:http";
import type { McpStore } from "./store.js";
/** routes 使用的 McpManager 最小面（避免 index↔routes 循环 import）。 */
export interface RoutesManager {
    setSession(cwd: string | undefined): Promise<void>;
    refreshFromDisk(): Promise<void>;
    uiConfig(): ClientUiConfig;
    updateUiConfig(raw: unknown): Promise<ClientUiConfig>;
    summary(): Record<string, unknown>;
    add(server: Record<string, unknown>, scope?: string): Promise<ServerConfig>;
    update(name: string, patch: Record<string, unknown>, scope?: string): Promise<ServerConfig>;
    remove(name: string, scope?: string): Promise<void>;
    connect(name: string, scope?: string): Promise<void>;
    disconnect(name: string): Promise<void>;
    reconnect(name: string, scope?: string): Promise<void>;
    /** 设置/解除单个工具禁用（工具级，独立于服务器级 enabled）。 */
    setToolDisabled?(root: string, server: string, tool: string, disabled: boolean): Promise<void>;
    /** 中间层模式热切换（apply 注入；缺省不可用）。 */
    setMiddlewareMode?(mode: string): Promise<void>;
    projectStoreOrThrow(): Promise<McpStore>;
    store: McpStore;
    /** 当前会话项目根（tool-disable 路由一致性校验用）。 */
    projectRoot?: string;
    /** 设置命名空间写入 sink（apply 注入；config 写路由落盘用）。 */
    uiUpdate?: (patch: Record<string, unknown>) => Promise<unknown>;
    sseConnections?: Set<ServerResponse>;
    /**
     * SSE 心跳定时器的逐连接清理函数（makeEventsRoute 注册；close 时自删）。
     * 插件卸载时由 apply 的路由 disposer 统一执行，防 interval 泄漏（#268）。
     */
    sseHeartbeatCleanups?: Set<() => void>;
    supervisors: Map<string, {
        status: string;
        tools: string[];
    }>;
    catalogCache: Map<string, unknown>;
    /** 中间层模式（off/project/all；health 计数展示用，缺省 off）。 */
    middlewareMode?: string;
    /** 中间层连接池（health 补中间层计数；结构面与 McpMiddleware.units 兼容）。 */
    middleware?: {
        units: Map<string, {
            connections: Map<string, {
                status: string;
            }>;
        }>;
    } | undefined;
}
/** 路由路径清单（与客户端一致）。 */
export declare const ROUTES: {
    servers: string;
    config: string;
    session: string;
    connect: string;
    disconnect: string;
    reconnect: string;
    importJson: string;
    events: string;
    health: string;
    toolDisable: string;
};
/** 组装 /api/dsh-mcp/* 路由。cwd 参数仅用于兼容旧调用（不再被路由使用）。 */
export declare function makeRoutes(manager: RoutesManager, cwd?: string): WebRoute[];
/** 序列化一帧 SSE data 行。 */
export declare function sseData(payload: unknown): string;
/** 配置变更 SSE 帧：客户端收到后重新 GET /api/dsh-mcp/config 就地更新浮窗位置。 */
export declare function uiConfigChangedFrame(): string;
/**
 * SSE 心跳间隔：30s data ping（对齐 dsh-notifier HEARTBEAT_MS 形态，#268）。
 * 必须用 data 而非注释帧——注释帧既不触发客户端 onmessage 也不触发 onerror，
 * 半开连接（移动端切后台系统冻结 JS 并静默掐断 TCP）时客户端零事件无法自愈；
 * data 帧喂客户端 60s watchdog 使其能检测失活并关旧建新。
 */
export declare const SSE_HEARTBEAT_MS = 30000;
/** 心跳 ping 帧（内容固定，模块级缓存避免逐次序列化）。 */
export declare const SSE_PING_FRAME: string;
/** 向全部 SSE 连接写出一帧（逐连接 try/catch，掉线忽略）。 */
export declare function broadcastFrame(connections: Set<ServerResponse> | undefined, frame: string): void;
/**
 * 状态变化推送通道（SSE）：浏览器端 EventSource 订阅，宿主状态变化时
 * 广播 `{ type: "summary" }` 帧（内容不随帧传输，浏览器收到后自行拉取）。
 * 连接集合挂在 manager.sseConnections 上（惰性创建），插件卸载时由
 * apply 的清理函数统一 destroy。
 *
 * 半开连接防护（#268，对齐 dsh-notifier）：写完初始帧后每 30s 向本连接写一条
 * data ping 心跳——移动端切后台系统冻结 JS 并静默掐断 TCP，两端均收不到
 * FIN/RST，无心跳则客户端 watchdog 无失活信号可依；close 时清定时器防泄漏，
 * 清理函数同时登记 manager.sseHeartbeatCleanups 供插件卸载 disposer 兜底。
 */
export declare function makeEventsRoute(manager: RoutesManager, options?: {
    heartbeatMs?: number;
}): WebRoute;
/** 健康检查：插件是否加载、服务器/连接/工具状态（诊断"插件没生效"的标准入口）。 */
export declare function makeHealthRoute(manager: RoutesManager): WebRoute;
