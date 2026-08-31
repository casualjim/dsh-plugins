/**
 * dsh-mcp-manager — 客户端常量与状态映射。
 *
 * 状态排序、状态点颜色、API 路径等纯常量，不依赖任何状态。
 * i18n（issue #348）：状态文案存字典 key（title/STATUS_TEXT），渲染期经 t 求值
 * （模块加载时 t 尚未装配，不能固化文案字符串）。
 */
import type { McpLocaleKey } from "./locales.js";
/** 与宿主端 ROUTES 一致的路径。 */
export declare const API: {
    servers: string;
    connect: string;
    disconnect: string;
    reconnect: string;
    importJson: string;
    session: string;
    config: string;
    events: string;
    health: string;
    toolDisable: string;
};
/** 状态分组排序（按优先级降序；titleKey 为字典 key，渲染期 t(titleKey)）。 */
export declare const STATUS_ORDER: {
    key: string;
    titleKey: McpLocaleKey;
    dot: string;
}[];
/** 状态 → 字典 key 映射（渲染期 t(STATUS_TEXT[status])；未知状态回落原始 key 显示）。 */
export declare const STATUS_TEXT: Record<string, McpLocaleKey>;
/** 状态点颜色（与 STATUS_ORDER 一致）。 */
export declare function statusDot(status: string): string;
