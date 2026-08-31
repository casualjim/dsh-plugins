/**
 * dsh-mcp-manager — 客户端右上角浮窗。
 *
 * 浮窗胶囊（状态点 + 摘要计数）挂在会话滚动容器右上角，点击展开下拉面板
 * 展示项目/全局 MCP 服务器列表 + 快捷操作（连接/断开/禁用）。
 * 跨模块动作（showPanel / refresh）经 actions 注入，不直接引用 panel 模块。
 */
import type { McpState, UiActions } from "./state.js";
/** 渲染浮窗胶囊（状态点 + 摘要计数）。 */
export declare function renderPill(state: McpState): void;
/** 渲染浮窗下拉面板（#362 交互拍板 1a：项目级 / 全局级两大分组，各自内部再按状态）。
 * project 模式：显示全局服务器但不显示工具开关，提示「切 all 模式可管理全局工具」。 */
export declare function renderFloatPanel(state: McpState, actions: UiActions): void;
/** 切换浮窗展开/收起。 */
export declare function toggleFloat(state: McpState, actions: UiActions, force?: boolean): void;
/** 下拉面板定位（fixed 跟随胶囊，避免被滚动容器裁剪；四角感知 + 视口终 clamp）。 */
export declare function placePanel(state: McpState): void;
/** 会话滚动容器：聊天消息实际滚动的区域（shell 的 data-conversation-scroll）。 */
export declare function conversationHost(): any;
/** 全局 overlay 层：下拉面板挂这里（fixed 定位，避免被滚动容器裁剪）。 */
export declare function panelHost(): any;
/** 从 settings.yaml 读取的配置决定新/老会话垂直偏移。 */
export declare function floatTopOffset(ctx: any, state: McpState): number;
/**
 * 挂载浮窗：胶囊继续挂在会话滚动容器（scrollBody）内并钉住右上角，下拉面板
 * fixed 跟随。返回 disposer 函数。
 */
export declare function mountFloat(ctx: any, state: McpState, actions: UiActions): () => void;
