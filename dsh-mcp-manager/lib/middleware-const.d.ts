/**
 * dsh-mcp-manager — 中间层常量与模式归一化（单一事实源）。
 */
import type { MiddlewareMode } from "./middleware-types.js";
/** 连接超时（ms）。 */
export declare const CONNECT_TIMEOUT_MS = 10000;
/** 工具发现（tools/list 全量）超时（ms）。 */
export declare const DISCOVERY_TIMEOUT_MS = 10000;
/** 单次远端工具调用超时（ms）。 */
export declare const CALL_TIMEOUT_MS = 30000;
/** 目录 TTL（ms）：24h。 */
export declare const CATALOG_TTL_MS: number;
/** 每工作空间目录 LRU 上限。 */
export declare const CATALOG_LRU_MAX = 16;
/** 目录安全边界：单服务器工具数上限。 */
export declare const MAX_TOOLS_PER_SERVER = 512;
/** 目录安全边界：单工具描述字节上限。 */
export declare const MAX_BYTES_PER_TOOL = 4096;
/** 目录安全边界：目录总字节上限。 */
export declare const MAX_TOTAL_CATALOG_BYTES: number;
/** ws_mcp_list 每服务器工具条数默认上限。 */
export declare const LIST_DEFAULT_TOOLS_PER_SERVER = 50;
/** ws_mcp_list 每服务器工具条数硬上限（目录采集边界内）。 */
export declare const LIST_MAX_TOOLS_PER_SERVER = 500;
/** 归一化中间层模式（非法值回落 off）。 */
export declare function normalizeMiddlewareMode(value: unknown): MiddlewareMode;
