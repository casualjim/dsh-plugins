/**
 * dsh-mcp-manager — 中间层工具注册（ws_mcp_search / ws_mcp_call /
 * ws_mcp_list / ws_mcp_detail + 策略 guard）。
 *
 * 注册四个中间层工具与策略 guard 层；类型自 middleware-types.ts 取，
 * 连接池类（McpMiddleware）自 middleware.ts import type（防运行值环）。
 * all 模式全局可见性（评审 A）：search/list/detail 合并查询「项目 root 单元 +
 * @global 单元」；call 放行 @global root。off/project 模式行为不变。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { McpMiddleware } from "./middleware.js";
import type { MiddlewareMode, DisabledToolsMap } from "./middleware-types.js";
/**
 * 注册 ws_mcp_search / ws_mcp_call / ws_mcp_list / ws_mcp_detail 四个中间层工具。
 * @param host 中间层宿主。
 * @param mw 中间层实例。
 * @param resolveRoot 路由：exec.agent → 归一化项目根（agent-less → undefined）。
 * @param mode 中间层模式（all 模式合并查询 @global 单元）。
 */
export declare function registerMiddlewareTools(ctx: Context, mw: McpMiddleware, resolveRoot: (agent: unknown) => Promise<string | undefined>, mode?: MiddlewareMode, options?: {
    /** 工具级禁用映射（root → server → Set<tool>）；缺省取 mw.disabledTools。 */
    disabledTools?: DisabledToolsMap;
}): () => void;
