/**
 * dsh-mcp-manager — 连接监督器与工具定义（依赖 transport / protocol）。
 *
 * ConnectionSupervisor 管理单个服务器的 client/transport 代际、连接成功
 * 后的工具同步与断开后的有界指数退避重连；同文件承载工具定义构建链
 * （命名 / 文本投影 / 截断 / 输出 schema 校验 / buildToolDefinition），
 * 它们只被监督器的 syncTools 使用。
 * 由 lib/index.js 组合根 re-export。
 */
import type { StdioTransport, HttpTransport } from "./transport.js";
import { MCPClient } from "./protocol.js";
import type { ServerConfig } from "./types.js";
import type { Context, LoggerService } from "@deepseek-ai/cordis";
import type { ToolDefinition } from "@deepseek-ai/dsh-tools";
/** 重连策略（解析后）。 */
export interface ReconnectPolicy {
    enabled: boolean;
    initialDelayMs: number;
    maxDelayMs: number;
    maxAttempts: number;
}
/** McpManager 最小面（supervisor 使用；避免 index↔supervisor 循环 import）。
 * tools 面取官方 Context，register 入参为官方 ToolDefinition。 */
export interface ManagerLite {
    ctx: Pick<Context, "tools">;
    logger: LoggerService;
    enhancement: {
        enhanceEmptyDescriptions?: boolean;
        resultTruncateBytes?: number;
    };
    emitStatus(): void;
    recordCatalogTools(serverName: string, toolMeta: Map<string, {
        description?: unknown;
    }>): Promise<void>;
}
/** 默认单次工具调用超时（毫秒）。下探自 60s：死工具（服务器已断线但工具未注销）
 * 会让模型阻塞一整轮；15s 内快速失败并携带"服务器不可用"说明更划算。 */
export declare const DEFAULT_TOOL_CALL_TIMEOUT_MS = 15000;
/** 重连默认策略（与官方 dsh-mcp-client 一致）。 */
export declare const RECONNECT_DEFAULTS: Readonly<{
    enabled: true;
    initialDelayMs: 500;
    maxDelayMs: 30000;
    maxAttempts: 10;
}>;
/** 工具结果渲染截断上限（字节）。extractText 现状不截断，超长 JSON 全量进上下文。 */
export declare const DEFAULT_RESULT_TRUNCATE_BYTES = 8192;
/** 从 (serverName, rawName) 派生模型可见的公开工具名。 */
export declare function publicToolName(serverName: string, rawName: string): string;
/**
 * 按字节截断文本（L3，防超长 JSON 全量进上下文）。
 * 尾部标注截断提示，防模型基于截断内容产生幻觉。
 * @param text 原始文本。
 * @param maxBytes 截断上限（字节，UTF-8）。
 * @returns 截断后的文本（含标注）。
 */
export declare function truncateText(text: unknown, maxBytes: number): unknown;
/**
 * 严格校验输出 schema 是否完全落在 dsh 支持子集内；支持则原样返回，
 * 否则返回 undefined（调用方回退为自由 JsonValue）。
 */
export declare function assertSupportedOutputSchema(schema: unknown): unknown;
/** 构建 dsh 工具定义（契约与官方 dsh-mcp-client 一致）。
 * @param opts 感知增强选项：{enhanceEmptyDescriptions, resultTruncateBytes}。
 */
export declare function buildToolDefinition(client: MCPClient, tool: Record<string, unknown>, server: ServerConfig, opts?: {
    enhanceEmptyDescriptions?: boolean;
    resultTruncateBytes?: number;
}): ToolDefinition;
/**
 * 一个服务器的连接监督器：管理 client/transport 代际，连接成功后把工具
 * 同步进 ctx.tools，断开后按有界指数退避重连，预算耗尽则注销工具并停止。
 */
export declare class ConnectionSupervisor {
    manager: ManagerLite;
    server: ServerConfig;
    scope: string;
    client: MCPClient | undefined;
    transport: StdioTransport | HttpTransport | undefined;
    toolDisposers: Map<string, () => void>;
    reconnectTimer: NodeJS.Timeout | undefined;
    failedAttempts: number;
    connectedAt: number | undefined;
    disposed: boolean;
    status: string;
    error: unknown;
    tools: string[];
    toolMeta: Map<string, {
        description?: unknown;
    }>;
    syncChain: Promise<unknown>;
    reconnectPolicy: ReconnectPolicy;
    constructor(manager: ManagerLite, server: ServerConfig, scope?: string);
    setStatus(status: string, error?: unknown): void;
    enqueueSync<T>(doSync: () => Promise<T> | T): Promise<T>;
    connect(opts?: {
        startup?: boolean;
    }): Promise<void>;
    /** 当前代际断开：清空引用并安排重连。 */
    teardownGeneration(error: unknown, schedule?: boolean): void;
    scheduleReconnect(error: unknown): void;
    /**
     * 拉取工具列表并整体替换注册（代际安全：先取后换）。
     * 封装定义路径（registerServer.toolDefinitions）：服务器配置带 toolDefinitions
     * 时**全部用调用方封装定义注册**——execute 来自调用方（先 sync → 内部转发底层
     * 实现），跳过远端 schema 投影与通用 callTool；模型可见名仍按 publicToolName
     * （mcp__ 前缀），禁用/可见性/能力目录按服务器+工具名判定照常生效（#362）。
     * 无 toolDefinitions：现状不变（远端 schema + 通用 callTool）。
     */
    syncTools(client: MCPClient, startup: boolean): Promise<void>;
    disconnect(): Promise<void>;
}
/** 解析重连策略（含默认值）。 */
export declare function resolveReconnect(config: Record<string, unknown> | undefined): ReconnectPolicy;
