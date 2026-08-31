/**
 * dsh-mcp-manager — mcpServers JSON 导入（独立模块）。
 *
 * 把 mcpServers JSON 条目（{ serverName: config }，业界通用格式）映射为
 * 插件服务器配置：解析粘贴的 JSON 文本，供 /api/dsh-mcp/import/json
 * 使用。仅支持 JSON 文本导入（不扫描任何应用的配置文件）。
 * 由 lib/index.js 组合根 re-export。
 */
import type { ServerConfig } from "./types.js";
/** 把一条 mcpServers JSON 条目映射为服务器配置。 */
export declare function fromClaudeEntry(name: string, entry: Record<string, unknown>): ServerConfig;
/** 解析一段 mcpServers JSON 文本为配置列表。 */
export declare function parseClaudeJson(text: string): ServerConfig[];
