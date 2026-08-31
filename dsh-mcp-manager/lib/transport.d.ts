/**
 * dsh-mcp-manager — MCP 传输层（独立模块）。
 *
 * stdio / streamable-http 两种传输：子进程生命周期、换行 JSON-RPC 帧解析、
 * SSE 响应解析、Mcp-Session-Id 会话保持等能力面由官方
 * @modelcontextprotocol/sdk 的 StdioClientTransport / StreamableHTTPClientTransport
 * 承担（issue #11，决策 #47 approved；devDependency，构建期经 bundle-host
 * 内联进产物）。本模块保留：
 *  - env 安全过滤与 ${ENV} 展开（凭据形状环境变量不透传给 MCP 子进程）；
 *  - supervisor 依赖的适配面：connect / close / onClose / `sdk` 实例暴露；
 *  - parseSsePayload 兼容导出（smoke 契约；内部传输已交 SDK 解析）。
 * 由 lib/index.js 组合根 re-export。
 */
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ServerConfig } from "./types.js";
/** 展开字符串中的 ${ENV_NAME} 引用（未设置 → 空字符串），用于 header/env 值。 */
export declare function expandEnv(value: unknown): string;
/**
 * streamable-http 传输：薄适配官方 StreamableHTTPClientTransport——
 * POST JSON-RPC、SSE 流式响应、`Mcp-Session-Id` 会话保持、断线重连均由 SDK 承担；
 * headers 支持 ${ENV} 展开（凭据不落盘明文）。
 */
export declare class HttpTransport {
    url: string;
    headers: Record<string, string>;
    /** 官方 SDK 传输实例（MCPClient.initialize 经 SDK Client.connect 挂入）。 */
    readonly sdk: StreamableHTTPClientTransport;
    constructor(url: string, headers?: Record<string, string>);
    /** streamable-http 无连接态（SDK start 仅初始化内部状态）：真正的建连由
     * MCPClient.initialize() 经 SDK Client.connect 驱动。supervisor 统一调用。 */
    connect(): Promise<void>;
    onClose(handler: (error: Error) => void): void;
    close(): Promise<void>;
}
/** 从 SSE 文本中提取 id 匹配的 JSON 载荷（兼容导出：smoke 契约断言用；
 * 内部 SSE 解析已交由 SDK StreamableHTTPClientTransport）。 */
export declare function parseSsePayload(text: string, id: unknown): unknown;
/**
 * stdio 传输：薄适配官方 StdioClientTransport——spawn、stdin 写入背压、
 * stdout 换行 JSON 帧解析、退出清理（TERM→KILL 兜底）均由 SDK 承担。
 * 本类保留自写版的两项宿主语义：
 *  - 子进程环境安全过滤（buildChildEnv：剔除凭据形状 / DSH_* 名 + ${ENV} 展开）；
 *  - stderr 尾部留存（stderrTail）用于启动失败诊断。
 */
export declare class StdioTransport {
    command: string;
    args: string[];
    env: Record<string, unknown>;
    cwd: string | undefined;
    /** 官方 SDK 传输实例（MCPClient.initialize 经 SDK Client.connect 挂入）。 */
    readonly sdk: StdioClientTransport;
    /** 子进程 stderr 尾部（最多 4000 字节），连接失败时附入错误消息辅助诊断。 */
    stderrTail: string;
    /** 断开原因（onerror 记录最近错误；未出错即退出时为通用退出消息）。 */
    closeReason: Error;
    constructor(config: {
        command: string;
        args?: string[];
        env?: Record<string, unknown>;
        cwd?: string;
    });
    /** 连接由 MCPClient.initialize() 经 SDK Client.connect 统一驱动
     * （spawn + initialize 版本协商 + notifications/initialized）；此处保持
     * supervisor 调用面不变、无独立动作（避免双重 start）。 */
    connect(): Promise<void>;
    onClose(handler: (error: Error) => void): void;
    close(): Promise<void>;
}
/** 按传输类型创建传输实例。 */
export declare function createTransport(server: ServerConfig): StdioTransport | HttpTransport;
