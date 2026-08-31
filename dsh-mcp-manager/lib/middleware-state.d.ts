/**
 * dsh-mcp-manager — 中间层用户状态与目录缓存持久化（单一事实源）。
 */
import type { ProjectUnit, DisabledToolsMap } from "./middleware-types.js";
/** userDisabled 持久化文件路径。 */
export declare function userStateFile(): string;
/** 加载 userDisabled（损坏/缺失 → 空）。 */
export declare function loadUserState(file: string): Promise<Map<string, Set<string>>>;
/** 持久化 userDisabled（合并式：先读现有文件，内存 units 覆盖，保留已淘汰
 * root 的记录——防 LRU 淘汰/卸载后禁用记录被静默抹掉，P1 修复）。 */
export declare function saveUserState(file: string, units: Map<string, ProjectUnit>): Promise<void>;
/** 目录缓存文件路径（每工作空间一份；root 哈希防路径注入）。 */
export declare function catalogCacheFileFor(root: string): string;
/** 加载工具级禁用（disabledTools 三段：root → server → tool[]；损坏/缺失 → 空）。 */
export declare function loadDisabledTools(file: string): Promise<DisabledToolsMap>;
/**
 * 持久化工具级禁用。内存映射是进程内完整视图（启动时 loadDisabledTools 全量
 * 加载 + setToolDisabled 增量变更），直接整图写盘即满足「多工作空间互不抹掉」
 * （同一进程内所有空间共用同一映射）；跨进程并发写属读-改-写竞态，与
 * 服务器级 userDisabled（saveUserState）现状一致。
 */
export declare function saveDisabledTools(file: string, disabledTools: DisabledToolsMap): Promise<void>;
