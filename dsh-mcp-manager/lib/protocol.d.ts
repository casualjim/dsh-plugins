/**
 * dsh-mcp-manager — MCP 协议客户端（独立模块）。
 *
 * 协议能力面（initialize 版本协商、notifications/initialized、请求超时与
 * 取消、JSON-RPC 帧构造）由官方 @modelcontextprotocol/sdk 的 Client 承担
 * （issue #11，决策 #47 approved；devDependency，构建期内联进产物）。
 * 本类仅做薄适配，保持 supervisor 的既有调用面不变：
 *   new MCPClient(transport) → initialize() → listTools(cursor) / callTool(...)。
 * 由 lib/index.js 组合根 re-export。
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { StdioTransport, HttpTransport } from "./transport.js";
/**
 * MCP 客户端适配器：包装官方 SDK Client。
 *
 * schema 选择（契约不漂移，PoC 关键决策）：
 *  - listTools 走 Protocol.request + 官方 ListToolsResultSchema：享受协议层
 *    响应校验；刻意**绕过** Client.listTools()——后者会缓存工具 outputSchema
 *    校验器并在 callTool 时强校验 structuredContent（缺失即抛错），会改变
 *    自写版"结果原样投影给 dsh 工具系统（未知 content 类型降级占位符）"
 *    的行为语义；
 *  - callTool 显式传宽松 ResultSchema：结果 JSON 原样透传（isError /
 *    structuredContent 判定由 supervisor.buildToolDefinition 承担，与自写版一致）。
 */
export declare class MCPClient {
    transport: StdioTransport | HttpTransport;
    client: Client | undefined;
    constructor(transport: StdioTransport | HttpTransport);
    /**
     * 建立 MCP 会话：SDK Client.connect 完成 initialize 版本协商 +
     * notifications/initialized（替代自写版的硬编码 protocolVersion 2025-03-26）。
     */
    initialize(): Promise<unknown>;
    /** tools/list（分页游标透传）。 */
    listTools(cursor?: string): Promise<{
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
            "io.modelcontextprotocol/related-task"?: {
                taskId: string;
            } | undefined;
        } | undefined;
        nextCursor?: string | undefined;
        tools: {
            description?: string | undefined;
            inputSchema: {
                [x: string]: unknown;
                type: "object";
                properties?: Record<string, object> | undefined;
                required?: string[] | undefined;
            };
            outputSchema?: {
                [x: string]: unknown;
                type: "object";
                properties?: Record<string, object> | undefined;
                required?: string[] | undefined;
            } | undefined;
            annotations?: {
                title?: string | undefined;
                readOnlyHint?: boolean | undefined;
                destructiveHint?: boolean | undefined;
                idempotentHint?: boolean | undefined;
                openWorldHint?: boolean | undefined;
            } | undefined;
            execution?: {
                taskSupport?: "forbidden" | "optional" | "required" | undefined;
            } | undefined;
            _meta?: Record<string, unknown> | undefined;
            icons?: {
                src: string;
                mimeType?: string | undefined;
                sizes?: string[] | undefined;
                theme?: "dark" | "light" | undefined;
            }[] | undefined;
            name: string;
            title?: string | undefined;
        }[];
    }>;
    /** tools/call（signal/timeoutMs 透传为 SDK RequestOptions）。
     * 走 Protocol.request + 宽松 ResultSchema：结果 JSON 原样透传给调用方
     * （isError / structuredContent 判定由 supervisor.buildToolDefinition 承担，
     * 与自写版一致；不用 Client.callTool 以避开其 outputSchema 运行时强校验
     * 与 task-required 门禁带来的行为漂移）。 */
    callTool(rawName: string, args?: unknown, opts?: {
        signal?: AbortSignal;
        timeoutMs?: number;
    }): Promise<{
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
            "io.modelcontextprotocol/related-task"?: {
                taskId: string;
            } | undefined;
        } | undefined;
    }>;
    requireClient(): Client;
}
