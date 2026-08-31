/** 全局作用域。 */
export declare const SCOPE_GLOBAL = "global";
/** 项目级作用域。 */
export declare const SCOPE_PROJECT = "project";
/** 归一化 scope（非法值回落 global）。 */
export declare function normalizeScope(value: string): "global" | "project";
