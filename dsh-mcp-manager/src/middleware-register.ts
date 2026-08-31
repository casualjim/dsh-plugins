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
import type { ToolDefinition, PreToolDecision } from "@deepseek-ai/dsh-tools";
import type { McpMiddleware } from "./middleware.ts";
import {
  CONNECT_TIMEOUT_MS,
  DISCOVERY_TIMEOUT_MS,
  CALL_TIMEOUT_MS,
  LIST_DEFAULT_TOOLS_PER_SERVER,
  LIST_MAX_TOOLS_PER_SERVER,
} from "./middleware-const.ts";
import {
  withTimeout,
  searchCatalog,
  searchCatalogMulti,
  listCatalog,
  findToolDetail,
  parseFullServerName,
  fullServerName,
  policyAllows,
  policyDenialReason,
  isToolDenied,
  toolDisabledReason,
  MIDDLEWARE_GLOBAL_ROOT,
} from "./middleware-utils.ts";
import type { MiddlewareMode, DisabledToolsMap } from "./middleware-types.ts";

/** 空 query 搜索无命中时的可归因提示（纯 render 文案，C 项）。 */
const SEARCH_EMPTY_HINT =
  "(no matching MCP tools in the current workspace; run ws_mcp_list for a full inventory of servers and tools, confirm the server/tool names, then search again)";

/** 项目级可见服务器名列表（A1 归因文案用；排序去重）。 */
function visibleProjectServers(mw: McpMiddleware, root: string): string[] {
  const names: string[] = [];
  for (const unit of mw.units.values()) {
    if (unit.root === root) {
      for (const serverName of unit.catalog.keys()) names.push(serverName);
    }
  }
  return [...new Set(names)].sort();
}

/** 等待 in-flight 连接/发现（8s 预算，与 search 对齐；超时不阻塞返回已有目录）。 */
async function waitForDiscovery(unit: NonNullable<Awaited<ReturnType<McpMiddleware["projectUnitFor"]>>>): Promise<void> {
  const inflight = [...unit.inFlight.values()];
  if (inflight.length === 0) return;
  try {
    await withTimeout(Promise.allSettled(inflight), 8000, "timed out waiting for connect/discovery");
  } catch {
    // 超时不阻塞（返回已有目录）
  }
}

/**
 * 注册 ws_mcp_search / ws_mcp_call / ws_mcp_list / ws_mcp_detail 四个中间层工具。
 * @param host 中间层宿主。
 * @param mw 中间层实例。
 * @param resolveRoot 路由：exec.agent → 归一化项目根（agent-less → undefined）。
 * @param mode 中间层模式（all 模式合并查询 @global 单元）。
 */
export function registerMiddlewareTools(
  ctx: Context,
  mw: McpMiddleware,
  resolveRoot: (agent: unknown) => Promise<string | undefined>,
  mode: MiddlewareMode = "project",
  options: {
    /** 工具级禁用映射（root → server → Set<tool>）；缺省取 mw.disabledTools。 */
    disabledTools?: DisabledToolsMap;
  } = {},
): () => void {
  const disposers: Array<() => void> = [];
  // 单一事实源：options 显式传入时同步到 mw（guard 与 callTool 同源，防漂移）。
  const disabledTools = options.disabledTools ?? mw.disabledTools;
  if (options.disabledTools !== undefined) mw.disabledTools = disabledTools;

  /**
   * 路由一致性校验（detail/call 共用；A2）：目标 root 必须等于当前 root，
   * 或 all 模式下的 @global（全局配置跨工作空间共享，语义成立）。
   * project 模式传全局级服务器 → 引导改用 mcp__ 直呼（全局 mcp__ 工具在该
   * 模式下仍注册可用）；非 global 的其他 root / 未知 @global 服务器一律硬拒绝
   * （防跨空间串台与 project 模式经 @global 路由绕过）。
   * @returns 校验通过的 root；抛错则拒绝。
   */
  const checkRoot = async (caller: string, server: string, root: string): Promise<string | undefined> => {
    const parsed = parseFullServerName(server);
    if (parsed === undefined) {
      throw new Error(`${caller}: server argument is malformed; expected @<root>/<server>`);
    }
    if (parsed.root !== root && parsed.root !== MIDDLEWARE_GLOBAL_ROOT) {
      throw new Error(
        `${caller}: server ${JSON.stringify(server)} is not in the current workspace ${JSON.stringify(root)}; routing-consistency check failed (prevents cross-workspace bleed)`,
      );
    }
    if (parsed.root === MIDDLEWARE_GLOBAL_ROOT && mode !== "all") {
      const bare = parsed.server;
      const known = mw.host.isGlobalServer(bare) || mw.units.get(MIDDLEWARE_GLOBAL_ROOT)?.catalog.has(bare) === true;
      if (known) {
        throw new Error(
          `${caller}: server ${JSON.stringify(server)} is a global-scope server; middleware only covers project-level servers - call its mcp__${bare}__<tool> prefixed tools directly (in project mode, global tools are still registered for direct calls)`,
        );
      }
      throw new Error(
        `${caller}: server ${JSON.stringify(server)} is not in the current workspace ${JSON.stringify(root)}; routing-consistency check failed (prevents cross-workspace bleed)`,
      );
    }
    return parsed.root;
  };

  /** all 模式可见单元集合：项目 root + @global（评审 A 全局可见性修复）。
   * root 本身为 @global 时去重（防 all 模式无项目 cwd 下服务器翻倍）。 */
  const visibleRoots = (root: string | undefined): string[] => {
    if (root === undefined) return [];
    return mode === "all" ? (root === "@global" ? ["@global"] : [root, "@global"]) : [root];
  };

  const search: ToolDefinition = {
    name: "ws_mcp_search",
    description:
      "Search the workspace MCP tool catalog (keywords match server names/tool names/descriptions/parameter names; matching entries returned). Search with this tool first, then invoke via ws_mcp_call; use ws_mcp_list for a full inventory (this tool is keyword search only). Empty query returns the capability summary table.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Intent/keywords; empty lists the capability summary" },
        server: { type: "string", description: "Optional: filter by @<root>/<server> full name" },
        limit: { type: "number", description: "Max entries returned (default 5, cap 10)" },
      },
    },
    output: {
      schema: {
        type: "object",
        properties: {
          results: { type: "array", items: {} },
          unavailable: { type: "array", items: {} },
          truncated: { type: "boolean", description: "Whether results were truncated by limit (true when results reached the limit, hinting the list may be incomplete)" },
        },
        required: ["results", "unavailable", "truncated"],
        additionalProperties: false,
      },
      render(_args, value: unknown) {
        const v = (value ?? {}) as { results?: Array<Record<string, unknown>>; unavailable?: Array<Record<string, unknown>>; truncated?: unknown };
        const lines = (v.results ?? []).map((hit) => {
          const server = String(hit.server ?? "");
          const tool = String(hit.tool ?? "");
          const description = String(hit.description ?? "");
          return `${server}/${tool}: ${description}`;
        });
        let body = lines.length > 0 ? lines.join("\n") : SEARCH_EMPTY_HINT;
        if (v.truncated === true) body += "\n(results hit the limit and may be incomplete - raise limit or use ws_mcp_list for a full inventory)";
        const unavailable = (v.unavailable ?? []).map((entry) => `${String(entry.server ?? "")}: ${String(entry.reason ?? "")}`);
        return [{ type: "text", text: unavailable.length > 0 ? `${body}\n\nUnavailable servers:\n${unavailable.join("\n")}` : body }];
      },
    },
    isConcurrencySafe: () => true,
    async execute(args: unknown, exec: { signal?: AbortSignal; agent?: unknown }) {
      const root = await resolveRoot(exec.agent);
      if (root === undefined) throw new Error("ws_mcp_search: cannot determine workspace; select a workspace first");
      const params = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
      const query = typeof params.query === "string" ? params.query : "";
      const serverFilter = typeof params.server === "string" ? params.server : undefined;
      const requested = typeof params.limit === "number" ? Math.floor(params.limit) : 5;
      const limit = Math.max(1, Math.min(requested, 10));
      const roots = visibleRoots(root);
      const unit = await mw.projectUnitFor(root);
      if (unit === undefined) {
        return { results: [], unavailable: [], truncated: false };
      }
      // 等待 in-flight 连接/发现（预算内），再搜索。all 模式对可见全部单元
      // （含 @global 首次触达）都等待——否则全局目录首次为空（P1-3 修复）。
      for (const visible of roots) {
        const visibleUnit = visible === root ? unit : await mw.projectUnitFor(visible);
        if (visibleUnit !== undefined) await waitForDiscovery(visibleUnit);
      }
      const { results, unavailable } = searchCatalogMulti(mw.units, roots, query, limit);
      // truncated 基于过滤前结果判定（serverFilter 过滤后误报的修正，P2-3）：
      // 过滤前已达 limit 上限即提示可能未列全。
      const truncated = results.length >= limit;
      const filtered = serverFilter === undefined ? results : results.filter((hit) => hit.server === serverFilter);
      return { results: filtered, unavailable, truncated };
    },
  };

  const call: ToolDefinition = {
    name: "ws_mcp_call",
    description:
      "Invoke one MCP tool in the current workspace (executes on a real server - confirm before acting). server/tool come from ws_mcp_search or ws_mcp_list; look up the parameter schema with ws_mcp_detail (call directly without searching when already known).",
    parameters: {
      type: "object",
      properties: {
        server: { type: "string", description: "Required: @<root>/<server> full name (from ws_mcp_search / ws_mcp_list)" },
        tool: { type: "string", description: "Required: bare remote tool name (from ws_mcp_search / ws_mcp_list)" },
        arguments: {
          type: "object",
          additionalProperties: true,
          description: "Parameters matching the inputSchema returned by ws_mcp_detail (properties/required/enum/description); verify with ws_mcp_detail first when unsure",
        },
      },
      required: ["server", "tool"],
    },
    output: {
      schema: {
        type: "object",
        properties: {
          content: { type: "array", items: {} },
          structuredContent: {},
        },
        required: ["content"],
        additionalProperties: false,
      },
      render(_args, value: unknown) {
        const v = (value ?? {}) as { content?: unknown };
        const content = Array.isArray(v.content) ? v.content : [];
        const parts: string[] = [];
        for (const block of content) {
          if (typeof block !== "object" || block === null) {
            parts.push("[unsupported MCP content]");
            continue;
          }
          const rec = block as Record<string, unknown>;
          if (rec.type === "text" && typeof rec.text === "string") {
            parts.push(rec.text);
            continue;
          }
          if (rec.type === "resource" || rec.type === "resource_link") {
            parts.push("[resource: content discarded]");
            continue;
          }
          parts.push(`[${String(rec.type ?? "unknown")} content]`);
        }
        return [{ type: "text", text: parts.length > 0 ? parts.join("\n") : "(MCP tool returned no content)" }];
      },
    },
    isConcurrencySafe: () => true,
    timeoutMs: CONNECT_TIMEOUT_MS + DISCOVERY_TIMEOUT_MS + CALL_TIMEOUT_MS + 5000,
    async execute(args: unknown, exec: { signal?: AbortSignal; agent?: unknown }) {
      const root = await resolveRoot(exec.agent);
      if (root === undefined) throw new Error("ws_mcp_call: cannot determine workspace; select a workspace first");
      const params = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
      const server = typeof params.server === "string" ? params.server : "";
      const tool = typeof params.tool === "string" ? params.tool : "";
      if (server === "" || tool === "") throw new Error("ws_mcp_call: both server and tool are required");
      const parsed = parseFullServerName(server);
      if (parsed === undefined) throw new Error("ws_mcp_call: server argument is malformed; expected @<root>/<server>");
      const targetRoot = await checkRoot("ws_mcp_call", server, root);
      if (targetRoot === undefined) {
        throw new Error(`ws_mcp_call: server ${JSON.stringify(server)} is not in the current workspace ${JSON.stringify(root)}; routing-consistency check failed (prevents cross-workspace bleed)`);
      }
      const unit = await mw.projectUnitFor(targetRoot);
      if (unit === undefined) throw new Error(`ws_mcp_call: workspace ${JSON.stringify(targetRoot)} has no project-level MCP config`);
      await mw.ensureConnected(targetRoot, parsed.server);
      return mw.callTool(server, tool, params.arguments, exec.signal);
    },
  };

  const list: ToolDefinition = {
    name: "ws_mcp_list",
    description:
      "List all MCP servers in the current workspace with each server's full tool list (not truncated by search limits). Returns server full names, tool names and descriptions for inventory and later ws_mcp_detail / ws_mcp_call use. Does not return inputSchema - use ws_mcp_detail for a single tool's complete schema. In all mode, global servers are included.",
    parameters: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: `Optional: filter by @<root>/<server> full name or bare name to list only that server's tools (a full-name root outside the current workspace throws a routing-consistency error)`,
        },
        perServerLimit: {
          type: "number",
          description: `Optional: per-server tool list cap (default ${LIST_DEFAULT_TOOLS_PER_SERVER}, max ${LIST_MAX_TOOLS_PER_SERVER}; beyond it toolsTruncated=true, the model may raise it as needed)`,
        },
      },
    },
    output: {
      schema: {
        type: "object",
        properties: {
          workspace: { type: "string" },
          mode: { type: "string" },
          servers: { type: "array", items: {} },
          totalServers: { type: "number" },
          totalTools: { type: "number" },
          toolsTruncated: { type: "boolean" },
          message: { type: "string" },
        },
        required: ["workspace", "mode", "servers", "totalServers", "totalTools", "toolsTruncated"],
        additionalProperties: false,
      },
      render(_args, value: unknown) {
        const v = (value ?? {}) as {
          workspace?: unknown;
          mode?: unknown;
          servers?: Array<Record<string, unknown>>;
          totalServers?: unknown;
          totalTools?: unknown;
          toolsTruncated?: unknown;
          message?: unknown;
        };
        const servers = v.servers ?? [];
        const lines = servers.map((entry) => {
          const server = String(entry.server ?? "");
          const tools = Array.isArray(entry.tools) ? (entry.tools as Array<Record<string, unknown>>) : [];
          const head = tools.length > 0 ? `${server} (${tools.length} tools):\n${tools.map((t) => `  - ${String(t.tool ?? "")}: ${String(t.description ?? "")}`).join("\n")}` : `${server} (0 tools)`;
          const disabled = entry.disabled === true ? " [disabled]" : "";
          const unavailable = typeof entry.unavailable === "string" && entry.unavailable !== "" ? ` [unavailable: ${entry.unavailable}]` : "";
          const truncated = entry.toolsTruncated === true ? " [toolsTruncated: tool count hit the limit; raise perServerLimit and retry]" : "";
          return `${head}${disabled}${unavailable}${truncated}`;
        });
        const prefix = `Workspace ${String(v.workspace ?? "")} (mode=${String(v.mode ?? "")}): ${String(v.totalServers ?? 0)} servers / ${String(v.totalTools ?? 0)} tools`;
        const body = lines.length > 0 ? lines.join("\n\n") : String(v.message ?? "(no MCP servers in the current workspace)");
        const truncated = v.toolsTruncated === true ? "\n(some servers' tool lists were truncated; raise perServerLimit as needed)" : "";
        return [{ type: "text", text: `${prefix}\n\n${body}${truncated}` }];
      },
    },
    isConcurrencySafe: () => true,
    async execute(args: unknown, exec: { signal?: AbortSignal; agent?: unknown }) {
      const root = await resolveRoot(exec.agent);
      if (root === undefined) throw new Error("ws_mcp_list: cannot determine workspace; select a workspace first");
      const params = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
      const serverFilter = typeof params.server === "string" && params.server !== "" ? params.server : undefined;
      const requested = typeof params.perServerLimit === "number" ? Math.floor(params.perServerLimit) : LIST_DEFAULT_TOOLS_PER_SERVER;
      const toolLimit = Math.max(1, Math.min(requested, LIST_MAX_TOOLS_PER_SERVER));
      const roots = visibleRoots(root);
      const unit = await mw.projectUnitFor(root);
      if (unit === undefined) {
        // project 模式无项目配置 → 空返回提示；all 模式回退只盘点 @global 单元。
        if (mode !== "all") {
          return {
            workspace: root,
            mode,
            servers: [],
            totalServers: 0,
            totalTools: 0,
            toolsTruncated: false,
            message: "No project-level MCP config in the current workspace (add servers in <project-root>/.dsh/mcp.json, or switch workspaces)",
          };
        }
        const globalUnit = await mw.projectUnitFor("@global");
        if (globalUnit !== undefined) await waitForDiscovery(globalUnit);
        return listCatalog(mw.units, ["@global"], serverFilter, toolLimit, mode, "No available MCP servers in the current workspace (neither project-level nor global found; if you just added config, retry shortly)", disabledTools);
      }
      // 等待 in-flight 连接/发现（预算内），再搜索。all 模式对可见全部单元
      // （含 @global 首次触达）都等待——否则全局目录首次为空（P1-3 修复）。
      for (const visible of roots) {
        const visibleUnit = visible === root ? unit : await mw.projectUnitFor(visible);
        if (visibleUnit !== undefined) await waitForDiscovery(visibleUnit);
      }
      const result = listCatalog(mw.units, roots, serverFilter, toolLimit, mode, "", disabledTools);
      // A1：带 serverFilter 过滤后 0 命中 → message 可归因（不谎报「未配置」）。
      if (result.servers.length === 0 && serverFilter !== undefined) {
        const visible = visibleProjectServers(mw, root);
        const visibleText = visible.length > 0 ? `Visible project-level servers: ${visible.join(" / ")}; ` : "No discovered project-level servers in the current workspace; ";
        result.message =
          `No project-level servers match server=${JSON.stringify(serverFilter)}.${visibleText}Global-scope servers are not listed here - access them via mcp__<server>__<tool> prefixed tools`;
      } else if (result.servers.length === 0) {
        result.message =
          mode === "all"
            ? "No available MCP servers in the current workspace (neither project-level nor global found; if you just added config, retry shortly)"
            : "No available MCP servers in the current workspace (no project-level servers configured; if you just added config, retry shortly)";
      }
      return result;
    },
  };

  const detail: ToolDefinition = {
    name: "ws_mcp_detail",
    description:
      "Look up the full parameter schema (inputSchema: properties/required/enum/description) of a single MCP tool by exact @<root>/<server> full name + bare tool name. Use to verify parameters before ws_mcp_call. No keyword search - use ws_mcp_list or ws_mcp_search to find tools.",
    parameters: {
      type: "object",
      properties: {
        server: { type: "string", description: "Required: @<root>/<server> full name (from ws_mcp_list / ws_mcp_search)" },
        tool: { type: "string", description: "Required: bare remote tool name (from ws_mcp_list / ws_mcp_search; mcp__<server>__<tool> prefix accepted)" },
      },
      required: ["server", "tool"],
    },
    output: {
      schema: {
        type: "object",
        properties: {
          server: { type: "string" },
          tool: { type: "string" },
          description: { type: "string" },
          inputSchema: {},
          fresh: { type: "boolean" },
          disabled: { type: "boolean" },
        },
        required: ["server", "tool", "description", "inputSchema", "fresh"],
        additionalProperties: false,
      },
      render(_args, value: unknown) {
        const v = (value ?? {}) as { server?: unknown; tool?: unknown; description?: unknown; inputSchema?: unknown; fresh?: unknown; disabled?: unknown };
        const server = String(v.server ?? "");
        const tool = String(v.tool ?? "");
        const description = typeof v.description === "string" && v.description !== "" ? v.description : "(no description)";
        const schema = v.inputSchema === undefined ? "{}" : JSON.stringify(v.inputSchema, null, 2);
        const fresh = v.fresh === true ? "fresh" : "stale";
        const disabled = v.disabled === true ? " [disabled]" : "";
        return [{ type: "text", text: `${server}/${tool}（${fresh}${disabled}）：${description}\n\ninputSchema:\n${schema}` }];
      },
    },
    isConcurrencySafe: () => true,
    async execute(args: unknown, exec: { signal?: AbortSignal; agent?: unknown }) {
      const root = await resolveRoot(exec.agent);
      if (root === undefined) throw new Error("ws_mcp_detail: cannot determine workspace; select a workspace first");
      const params = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
      const server = typeof params.server === "string" ? params.server : "";
      const tool = typeof params.tool === "string" ? params.tool : "";
      if (server === "" || tool === "") throw new Error("ws_mcp_detail: both server and tool are required");
      const targetRoot = await checkRoot("ws_mcp_detail", server, root);
      if (targetRoot === undefined) {
        throw new Error(
          `ws_mcp_detail: server ${JSON.stringify(server)} is not in the current workspace ${JSON.stringify(root)}; routing-consistency check failed (prevents cross-workspace bleed)`,
        );
      }
      const unit = await mw.projectUnitFor(targetRoot);
      if (unit !== undefined) await waitForDiscovery(unit);
      return findToolDetail(mw.units, targetRoot, server, tool);
    },
  };

  disposers.push(ctx.tools.register(search));
  disposers.push(ctx.tools.register(call));
  disposers.push(ctx.tools.register(list));
  disposers.push(ctx.tools.register(detail));

  // 策略 + 工具级禁用 guard 层（P0-1 三入口之二）：tools/pre-execute 全局唯一
  // 执行点，防其他插件/入口绕行 ws_mcp_call 直接调用远端工具。
  // 覆盖两类工具名：
  //   - ws_mcp_call：统一过「禁用表 + 策略」（deny 优先），与 callTool 内裁决一致；
  //   - mcp__<server>__<tool> 直呼前缀工具：从注册名反解 (root, server, tool)
  //     后过禁用表（策略不适用于直呼路径——中间层策略只约束 ws_mcp_call）。
  // 其他工具放行（ws_mcp_list / ws_mcp_detail / ws_mcp_search 纯读本地目录不触达）。
  // 路由 root 解析（P0-3）：exec.agent?.session?.header?.cwd → 归一化项目根；
  // exec.agent 缺失/无法解析 → 按最宽可见范围放行（只查 @global 记录，保持
  // 既有降级行为；project 模式无法禁用的全局工具在浮窗 global 组有提示）。
  if (typeof ctx.on === "function") {
    const guardDispose = ctx.on(
      "tools/pre-execute",
      async (
        exec: { name?: string; arguments?: unknown; agent?: unknown },
        next: () => Promise<PreToolDecision>,
      ): Promise<PreToolDecision> => {
        const name = exec?.name;
        if (typeof name !== "string" || name === "") return next();
        // 路径一：ws_mcp_call 显式参数（与 execute 同源校验）。
        if (name === "ws_mcp_call") {
          const params = (typeof exec.arguments === "object" && exec.arguments !== null ? exec.arguments : {}) as Record<string, unknown>;
          const server = typeof params.server === "string" ? params.server : "";
          const tool = typeof params.tool === "string" ? params.tool : "";
          const parsed = parseFullServerName(server);
          if (parsed === undefined || parsed.server === "") return next();
          const policyKey = fullServerName(parsed.root, parsed.server);
          if (isToolDenied(disabledTools, mw.policy, policyKey, tool)) {
            if (!policyAllows(mw.policy, policyKey, tool)) {
              return { kind: "deny", reason: policyDenialReason(mw.policy, policyKey, tool) ?? "ws_mcp_call: tool denied by policy" };
            }
            return { kind: "deny", reason: toolDisabledReason(policyKey, tool) };
          }
          return next();
        }
        // 路径二：mcp__ 前缀直呼工具（registered 名 = mcp__<server>__<tool>；
        // 超长哈希后缀名不可逆 → 按未知 server 处理，不禁用/不误禁，P2）。
        if (name.startsWith("mcp__")) {
          const rest = name.slice("mcp__".length);
          const separator = rest.indexOf("__");
          if (separator <= 0) return next();
          const server = rest.slice(0, separator);
          const tool = rest.slice(separator + 2);
          if (tool === "") return next();
          const root = await resolveRoot(exec.agent);
          if (root === undefined) {
            // 无法解析会话 root：按最宽可见范围放行（仅 @global 共享记录生效）。
            if (disabledTools?.get(MIDDLEWARE_GLOBAL_ROOT)?.get(server)?.has(tool) === true) {
              return { kind: "deny", reason: toolDisabledReason(`@${MIDDLEWARE_GLOBAL_ROOT}/${server}`, tool) };
            }
            return next();
          }
          const serverKey = fullServerName(root, server);
          if (isToolDenied(disabledTools, undefined, serverKey, tool)) {
            return { kind: "deny", reason: toolDisabledReason(serverKey, tool) };
          }
          return next();
        }
        return next();
      },
    );
    disposers.push(guardDispose);
  }

  return () => {
    for (const dispose of disposers) dispose();
  };
}
