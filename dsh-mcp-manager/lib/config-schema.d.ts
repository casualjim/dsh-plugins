/**
 * dsh-mcp-manager — 插件 Config schema 与配置归一化（纯函数，单一事实源）。
 *
 * 插件自身 Config（cordis 配置注入入口）与浮窗 UI 配置的校验/归一化/默认值；
 * 类型自 types.ts 取（防循环引用），placement-math 提供层级 clamp 与默认层级。
 */
import z from "schemastery";
import type { ClientUiConfig, UiPlacementConfig } from "./types.js";
/** 空 description 工具的条件拼接默认开启。 */
export declare const DEFAULT_ENHANCE_EMPTY_DESCRIPTIONS = true;
/** 默认浮窗 UI 配置（与升级前一致，无回归；层级基准引用 placement-math 单一事实源，
 *  DEFAULT_Z_INDEX_BASE=10 对应 CSS 默认 z-index:10）。 */
export declare const DEFAULT_UI_CONFIG: UiPlacementConfig;
/**
 * 归一化浮窗 UI 配置（纯函数，可单测）。
 * 兼容三种形态：新 `Config.ui` 嵌套、旧隐藏命名空间的扁平 `position/offset`、
 * 客户端扁平 `position/offsetX/offsetY/blankY`。非法或缺失 → 安全回退默认，不抛。
 */
export declare function normalizeUiConfig(raw: unknown): ClientUiConfig;
/**
 * 把客户端扁平形态（{position, offsetX, offsetY, blankY}）归一化为写入 `Config.ui`
 * 的嵌套补丁（{position, offset:{x,y,blankY}}）。走 normalizeUiConfig 的净化为唯一
 * 入口：非法值安全回退默认，负数 clamp 到 0，四舍五入。
 */
export declare function buildConfigUiPatch(raw: unknown): UiPlacementConfig;
/** 面板垂直定位纯函数（供 smoke 断言翻转分支；clamp 到视口内，不溢出）。 */
export declare function panelTopForAnchor(anchor: "top" | "bottom", pillTop: number, pillBottom: number, panelHeight: number, gap: number): number;
/**
 * 插件 Config schema（标准 cordis 配置注入入口；含 `ui` 子对象）。
 * 迁移后 position/offset 走插件自身 Config 而非隐藏命名空间，设置页插件卡可编辑。
 */
export declare const Config: z<{
    enabled: boolean;
    announceToAgent: boolean;
    storePath: string;
    announceCatalog: boolean;
    catalogMaxEntries: number;
    enhanceEmptyDescriptions: boolean;
    resultTruncateBytes: number;
    middleware: "off" | "project" | "all";
    middlewarePolicy: Record<string, unknown>;
    ui: UiPlacementConfig;
}>;
