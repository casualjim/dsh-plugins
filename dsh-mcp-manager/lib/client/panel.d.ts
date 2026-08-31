/**
 * dsh-mcp-manager — 客户端模态面板生命周期。
 *
 * 面板的打开/关闭/tab 切换/数据刷新。
 * 跨模块渲染（renderServers / buildQuickAdd / renderPill / renderFloatPanel）
 * 直接 import 用到的模块——本模块是 feature 模块的汇聚点，构成单向依赖图：
 * panel → servers / quick-add / float。
 */
import type { McpState, UiActions } from "./state.js";
/**
 * 刷新服务器列表与浮窗摘要（单飞：in-flight 复用；#111 变更点驱动）。
 * 返回 true=成功；false=失败（调用方按退避重试）。
 */
export declare function refresh(state: McpState, actions: UiActions): Promise<boolean>;
/** 切换面板 tab（servers / quick）。 */
export declare function switchTab(state: McpState, actions: UiActions, tab: any): void;
/** 关闭模态面板。 */
export declare function close(state: McpState): void;
/** 打开模态面板（首次调用时创建 DOM 结构）。 */
export declare function showPanel(state: McpState, actions: UiActions): void;
