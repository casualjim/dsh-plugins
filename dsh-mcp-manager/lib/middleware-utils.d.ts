/**
 * dsh-mcp-manager — 中间层纯函数（命名 / 容错 / 脱敏 / 策略 / 目录检索）。
 *
 * 全部为无副作用纯函数（withTimeout 亦不依赖连接池），类型自 middleware-types.
 * ts 取；被连接池类、工具注册与 manager 共享。
 */
import type { CatalogTool, ListCatalogResult, MiddlewarePolicy, ProjectUnit, SearchHit, ToolDetail, DisabledToolsMap } from "./middleware-types.js";
import type { ServerConfig } from "./types.js";
/** server 全局唯一名：@<root>/<server>。 */
export declare function fullServerName(root: string, server: string): string;
/** 中间层全局虚拟 root（全局服务器经中间层访问时的路由 key；与 manager 常量同值）。 */
export declare const MIDDLEWARE_GLOBAL_ROOT = "@global";
/** 从持久化载荷解析 disabledTools 三层结构（损坏/缺失 → 空；容错不抛）。 */
export declare function parseDisabledTools(raw: unknown): DisabledToolsMap;
/** 解析 @<root>/<server> 全名 → { root, server }；非法返回 undefined。
 * root 是绝对路径（以 / 开头），故从最后一个 `/` 分割（server 名不含 `/`）。
 * 特殊形态兼容：`@global/<server>`（单 @，人类/文档/A2 指引形态）归一化为
 * root=`@global`（MIDDLEWARE_GLOBAL_ROOT）；`@@global/<server>`（双 @，内部
 * fullServerName 产物）同样归一化为 `@global`——两种输入等价，杜绝「单 @ 被
 * 路由拒绝、双 @ 放行」的语义分裂（隔离验证 P0 发现，smoke 双 @ 掩盖单 @ 被拒）。 */
export declare function parseFullServerName(name: string): {
    root: string;
    server: string;
} | undefined;
/** 归一化中间层工具的 tool 参数（模型可能传 mcp__<server>__<tool> 全名）。
 * @param caller 调用方工具名（错误文案前缀；ws_mcp_call / ws_mcp_detail 复用）。 */
export declare function normalizeToolName(serverName: string, toolName: string, caller?: string): string;
/** 归一化 ws_mcp_call 的 arguments 参数（模型可能把参数字典填成 JSON 字符串）。 */
export declare function normalizeArguments(raw: unknown): unknown;
/** 统一错误提取（Error/string/object 三态）。 */
export declare function msgOf(error: unknown): string;
/** 凭据脱敏器：从服务器配置收集 secret 值，替换错误消息中的出现。 */
export declare function createRedactor(servers: readonly ServerConfig[]): (error: unknown) => string;
/** 工具名匹配 glob（* 通配）。 */
export declare function globMatch(pattern: string, name: string): boolean;
/** 策略裁决：deny 优先。serverKey 支持全名（@root/server）或裸名——全名优先匹配（工作空间隔离），未命中回落裸名。返回 true = 允许。 */
export declare function policyAllows(policy: MiddlewarePolicy | undefined, serverKey: string, tool: string): boolean;
/** 提取裸名（@root/server → server；无前缀原样返回）。 */
export declare function bareServerName(name: string): string;
/**
 * 单一裁决：工具是否被用户禁用（工具级禁用，独立于服务器级 enabled）。
 *
 * 三入口统一调用（P0-1）：ws_mcp_call（callTool，先查禁用再查策略）、
 * pre-execute guard（mcp__ 前缀工具）、纪律裸名（dsh-codegraph 侧声明语义）。
 *
 * 语义（P0-2 方案 A，零耦合）：禁用**只作用于 mcp-manager 管辖的 mcp__ 前缀
 * 工具**；纪律裸名（如 codegraph_explore）不受影响，由 dsh-codegraph 侧（#363）
 * 自行声明。禁用原因文案与浮窗 UI 均需同步声明该语义。
 *
 * 判定（P1 三层结构 + P2 超长名）：
 * 1. 目标 root 直接命中 → 查该 root 记录（project 模式按会话 root 隔离）；
 * 2. 未命中且目标 root 非 @global → 回落 @global 共享记录（全局工具跨工作空间
 *    key=@global；对项目 root 的查询是「该 root 无记录」的探测，永不误禁）；
 * 3. 哈希后缀名（>64 字符或含非法字符）不可逆 → 按「未知 server」处理：
 *    不禁用、不误禁（publicToolName 无法反解出 (server, tool)）。
 *
 * @param disabledTools 禁用映射（root → server → Set<tool>）。
 * @param policy 中间层策略（allowTools/denyTools；工具级禁用之外的第二道闸，
 *    仅 ws_mcp_call 路径检查，与既有语义一致）。
 * @param serverKey @<root>/<server> 全名或裸名（策略键；与 policyAllows 同形态）。
 * @param tool 远端工具裸名。
 * @returns true = 拒绝执行（被禁用或策略 deny）。
 */
export declare function isToolDenied(disabledTools: DisabledToolsMap | undefined, policy: MiddlewarePolicy | undefined, serverKey: string, tool: string): boolean;
/** 策略拒绝原因（供 denialReason 提示）。 */
export declare function policyDenialReason(policy: MiddlewarePolicy | undefined, serverKey: string, tool: string): string | undefined;
/** 工具级禁用的拒绝原因文案（三入口统一；P0-2 语义声明）。 */
export declare function toolDisabledReason(serverKey: string, tool: string): string;
/** 跨字段打分：query 词命中 server 名 / 工具名 / description / 参数名。
 * 中文（无空格分词）：query 连续中文串在原始描述中 substring 匹配即可命中
 * （修复：原实现把连续中文当单个 token，中文召回率接近零）。 */
export declare function scoreTool(query: string, server: string, toolName: string, tool: CatalogTool): {
    score: number;
    matchedTerms: string[];
};
/** 检索目录：query 为空 → 能力摘要表（每服务器前 N 个工具）。
 * 单 root 实现（searchCatalogMulti 循环调用；兼容既有测试）。 */
export declare function searchCatalog(units: Map<string, ProjectUnit>, root: string, query: string, limit: number): {
    results: SearchHit[];
    unavailable: Array<{
        server: string;
        reason: string;
    }>;
};
/** 多单元合并检索（all 模式：项目 root 单元 + @global 单元合并查询）。
 * 与 searchCatalog 同语义，仅数据源扩展为多个 root；off/project 模式行为不变。
 * 单 root 直接委托 searchCatalog（保持原顺序，不引入跨单元排序变化）；
 * 多 root 合并后统一排序并按全局 limit 截断。 */
export declare function searchCatalogMulti(units: Map<string, ProjectUnit>, roots: readonly string[], query: string, limit: number): {
    results: SearchHit[];
    unavailable: Array<{
        server: string;
        reason: string;
    }>;
};
/**
 * 完整盘点：列出当前工作空间全部服务器 + 每台完整工具清单（不受关键词/limit
 * 截断服务器，工具数受 perServerLimit 保护）。
 * @param units 连接池单元集合。
 * @param roots 参与盘点的 root 列表（all 模式含 @global）。
 * @param serverFilter 可选：@<root>/<server> 全名或裸名过滤。
 * @param toolLimit 每服务器工具条数上限（>0；超过置 toolsTruncated）。
 * @param emptyHint 空返回时的 message（按模式区分场景）。
 * @param disabledTools 用户工具级禁用映射（root → server → Set<tool>）；
 *    命中条目在工具行标注禁用（供模型感知）。
 * @throws 全名 root 不属于当前 roots → 路由一致性错误（与 ws_mcp_call 口径一致）。
 */
export declare function listCatalog(units: Map<string, ProjectUnit>, roots: readonly string[], serverFilter: string | undefined, toolLimit: number, mode: string, emptyHint: string, disabledTools?: DisabledToolsMap): ListCatalogResult;
/**
 * 单工具详情：按 @<root>/<server> + tool 裸名精确命中，返回完整 inputSchema。
 * 错误三分：
 * 1. server 发现失败（catalog.unavailable）→ 附原因；
 * 2. 单元/服务器未发现 → 「server 未连接或未发现」；
 * 3. 工具不存在 → 「tool 不存在」。
 * @param units 连接池单元集合。
 * @param root 目标 root（all 模式可为 @global）。
 * @param server @<root>/<server> 全名。
 * @param tool 远端工具裸名（兼容 mcp__ 前缀，复用 normalizeToolName）。
 */
export declare function findToolDetail(units: Map<string, ProjectUnit>, root: string, server: string, tool: string): ToolDetail;
/** 等待带超时（race 兜底）。 */
export declare function withTimeout<T>(promise: Promise<T>, ms: number, message: string, signal?: AbortSignal): Promise<T>;
