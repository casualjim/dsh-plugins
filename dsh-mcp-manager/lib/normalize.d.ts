/**
 * dsh-mcp-manager — 服务器配置归一化（纯函数，单一事实源）。
 *
 * normalizeServer 校验并规范化一条 MCP 服务器配置（stdio / streamable-http），
 * 供 Manager 增改与 mcpServers JSON 导入路径共用；SERVER_NAME_PATTERN 为
 * 服务器名命名空间约束（与官方 dsh-mcp-client 一致）。
 */
import type { ServerConfig } from "./types.js";
/** MCP 服务器名命名空间约束（与官方 dsh-mcp-client 一致）。 */
export declare const SERVER_NAME_PATTERN: RegExp;
/** 校验并规范化一条服务器配置。 */
export declare function normalizeServer(input: unknown): ServerConfig;
