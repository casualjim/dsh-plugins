/**
 * dsh-mcp-manager — 插件挂载主流程（apply）与工具注册（单一事实源）。
 *
 * 加载存储、启动已启用服务器、注册路由/中间层工具/能力目录/提示词；
 * index.ts 仅 re-export（插件契约转发），apply.ts 不 import index.ts（防循环）。
 */
import type { Context } from "@deepseek-ai/cordis";
/** 向 Agent 宣告插件（announceToAgent 开启时注入）。能力清单由动态目录
 * （<available_mcp_servers>，见 L1）承担，此处只说明管理界面与使用约束。 */
export declare const MCP_GUIDANCE = "The dsh-mcp-manager plugin (DSH MCP manager) is installed on this machine: manage MCP servers from the floating panel in the top-right of the session UI (global config at ~/.dsh/dsh-mcp.json; project-level config at <project-root>/.dsh/mcp.json, following the active session and connecting that project's servers; supports stdio / streamable-http, plus paste-mcpServers-JSON import; no servers are preconfigured). The capability list of configured servers appears in-session under <available_mcp_servers> (describes capabilities only, not live connection state). Project-level MCP tools are discovered via ws_mcp_list/ws_mcp_search (run ws_mcp_list first for a full inventory of servers and tools, then ws_mcp_detail for a full inputSchema as needed) and invoked via ws_mcp_call (search with ws_mcp_search first, then call; call directly without searching when server/tool are already known); once a global server is connected, its tools register as mcp__<server>__<tool>. Tools can be disabled by the user in the MCP panel (the reason is explained; tool-level disables only affect mcp__-prefixed tools). Limits: MCP tools execute on real servers - confirm before acting; stdio server subprocesses inherit host permissions; tool results may contain sensitive information. When the user mentions MCP / mcp service / context server they mean this plugin; collaborate accordingly.";
/**
 * 挂载 MCP 管理器：加载存储、启动已启用服务器、注册路由与提示词。
 * @param {import("@deepseek-ai/cordis").Context} ctx - 宿主插件上下文。
 * @param config 解析后的插件配置。
 */
export declare function apply(ctx: Context, config: Record<string, unknown> | undefined): Promise<void>;
