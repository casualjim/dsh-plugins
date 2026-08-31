/**
 * dsh-mcp-manager — L1 能力目录与目录缓存（独立模块）。
 *
 * 能力目录：向模型宣告已配置 MCP 服务器（数据源不依赖实时连接状态，
 * digest 只含服务器集合，history-based 去重防重复注入）。
 * 目录缓存：连接成功时把工具描述摘要持久化于磁盘，作为 digest 的稳定数据源。
 * 由 lib/index.js 组合根 re-export。
 */
import type { ServerConfig } from "./types.js";
/** 目录条目。 */
export interface CatalogEntry {
    name: string;
    text?: string;
    /** 服务器归属（global/project）；用于区分调用引导（#228 双轨迁移）。 */
    scope?: string;
}
/** supervisor 最小面（manager.supervisors 的条目）。 */
export interface SupervisorLite {
    server: ServerConfig;
    /** 服务器归属（global/project）；目录条目携带用于调用引导（#228）。 */
    scope?: string;
}
/** 目录缓存（连接成功时持久化的工具描述摘要）。 */
export type CatalogCache = Map<string, {
    summary: string;
}>;
/** 会话消息最小面（pre-step decision.messages / session.events）。 */
export interface CatalogMessage {
    id?: unknown;
    role?: string;
    content?: Array<{
        type?: string;
        text?: string;
    }>;
    source?: {
        kind?: string;
        form?: unknown;
        entries?: unknown;
    };
}
/** pre-step 决策最小面。 */
export interface CatalogDecision {
    kind: string;
    messages: CatalogMessage[];
}
/** 目录历史查询结果。 */
export interface CatalogHistoryResult {
    visibleDigest?: string;
    published: boolean;
}
/** agent 最小面（session.events 倒序找目录消息）。 */
export interface CatalogAgent {
    session?: {
        surface?: {
            nodes?: unknown[];
        };
        events?: Array<{
            type?: string;
            seq?: unknown;
            data?: {
                source?: {
                    kind?: string;
                    entries?: unknown;
                };
            };
        }>;
    };
}
/** 能力目录默认开启。 */
export declare const DEFAULT_ANNOUNCE_CATALOG = true;
/** 能力目录最大条目数（防上下文膨胀）。 */
export declare const DEFAULT_CATALOG_MAX_ENTRIES = 6;
/** 目录缓存文件（连接成功时把工具描述摘要持久化于此；目录 digest 的稳定数据源）。 */
export declare function catalogCacheFile(): string;
/**
 * 从工具描述集合计算目录摘要（排序后取第一个非空，**完整返回不截断**）：
 * 排序保证工具列表顺序变化时摘要稳定（重连不触发缓存更新 → digest 不变）。
 */
export declare function summarizeToolDescriptions(toolMeta: Map<string, {
    description?: unknown;
}>): string | undefined;
/**
 * 生成能力目录条目（**数据源不依赖用户配置、不依赖实时连接状态**）：
 * ① 服务器自定义 description（用户可选补充，优先）→
 * ② 目录缓存摘要（连接成功时自动持久化的工具描述摘要，磁盘数据，与连接状态解耦）
 * ③ 都没有 → 只显示服务器名。
 * 连接/断开/重连不改变缓存内容 → digest 稳定 → 不触发重复注入。
 * @param supervisors manager.supervisors（name → supervisor）。
 * @param maxEntries 最大条目数。
 * @param cache 目录缓存（manager.catalogCache）。
 * @returns 目录条目。
 */
export declare function composeCatalogEntries(supervisors: Map<string, SupervisorLite>, maxEntries?: number, cache?: CatalogCache): CatalogEntry[];
/**
 * 目录条目 digest（sha256）——**只含服务器集合（name），不含描述文本**。
 *
 * 为什么：MCP 服务器的工具描述集合不稳定（按需注册/动态描述，实测 code-graph
 * 等服务器不同时刻的摘要都不同）。若 digest 含描述文本，缓存摘要一更新就触发
 * 替换注入——永远追不上抖动。digest 只含 name 后：
 * - 服务器增删 → digest 变 → 原位替换（合理）
 * - 描述/缓存更新 → digest 不变 → 本会话目录保持快照（静态能力地图语义，
 *   与消息声明"仅描述能力、不代表当前连接状态"一致），跨会话才反映新缓存
 */
export declare function digestCatalogEntries(entries: CatalogEntry[]): string;
/** 渲染能力目录消息（source 标记供定位替换）。
 * 按条目 scope 区分调用引导（#228 双轨迁移）：
 * - 含 project 条目 → 引导经 ws_mcp_list/ws_mcp_search/ws_mcp_detail/ws_mcp_call
 *   （项目级走中间层；完整盘点用 ws_mcp_list，查完整 schema 用 ws_mcp_detail）；
 * - 仅 global 条目 → 默认保持 mcp__ 直呼引导（全局服务器不经中间层检索）；
 *   all 模式（mode === "all"）下全局也走中间层 → 同样引导经中间层工具访问。
 * 口径统一（#362 评审修正）：project 模式全局服务器仍以 mcp__ 直呼注册可用，
 * 目录引导区分「经中间层访问」与「mcp__ 直呼」两类服务器，不混用。
 */
export declare function renderMcpCatalogMessage(entries: CatalogEntry[], mode?: string): CatalogMessage;
/** 转义远程来源文本（防提示注入/标签逃逸；与 skill catalog 的 escapeText 同思路）。
 * 只做安全转义，**不做长度截断**（完整返回描述）。 */
export declare function escapeCatalogText(value: unknown): string;
/** 从消息列表里定位既有的能力目录消息（source.kind 匹配）。 */
export declare function findCatalogMessage(messages: CatalogMessage[]): CatalogMessage | undefined;
/**
 * 防御性读取目录 source 里的 entries（坏数据返回 undefined——按"不是本插件的目录"
 * 处理，绝不在 step 监听器里抛错，否则每轮都会失败）。
 */
export declare function readCatalogEntries(source: {
    entries?: unknown;
} | undefined): CatalogEntry[] | undefined;
/**
 * 从会话持久化日志（agent.session.events）倒序找最后一条**可见**的 mcp-catalog 消息。
 * **这是去重的权威来源**（与官方 dsh-tool-skill catalogHistory 同构）：
 * - decision.messages 只含本轮新消息，历史目录消息不在其中——用它定位会导致每轮重复注入；
 * - 可见性（surface.nodes）过滤：compaction/resume 后旧目录不可见 → visibleDigest 为空 → 重新注入。
 */
export declare function catalogHistory(agent: CatalogAgent | undefined): CatalogHistoryResult;
/** 渲染"目录更新"消息（历史旧目录无法删除，新消息声明作废——与 tool-skill 同语义）。 */
export declare function renderMcpCatalogUpdate(entries: CatalogEntry[], mode?: string): CatalogMessage;
/**
 * 目录注入决策（纯函数，pre-step 监听器薄调用，便于单测）。
 * 完全复刻官方 dsh-tool-skill 的 catalog 语义（根治重复注入）：
 * 1. 历史（session.events）digest 相同 → 本轮不注入（撤销本轮已注入的）——**去重源是历史而非本轮消息**；
 * 2. 历史 digest 不同 → 注入"更新"消息（声明替换旧目录）；
 * 3. 从未发布且无服务器 → 不注入；
 * 4. compaction/resume 后旧目录不可见 → 重新注入（events-based 重建）。
 * @param decision next() 的决策。
 * @param messages 本轮输入消息（签名兼容）。
 * @param supervisors manager.supervisors。
 * @param maxEntries 目录条目上限。
 * @param cache 目录缓存。
 * @param agent pre-step 的 agent（session.events 来源）。
 * @returns 新决策。
 */
export declare function resolveCatalogInjection(decision: CatalogDecision, messages: CatalogMessage[], supervisors: Map<string, SupervisorLite>, maxEntries?: number, cache?: CatalogCache, agent?: CatalogAgent, mode?: string): CatalogDecision;
