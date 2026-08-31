/**
 * dsh-mcp-manager — 客户端「服务器列表页」渲染。
 *
 * 按状态分级展示服务器卡片（端点 / 错误 / 工具列表 / 操作按钮）。
 * 跨模块动作（refresh / resetForm / beginEdit）经 actions 注入，不直接引用
 * panel/quick-add 模块，避免循环依赖。
 */
import type { McpState, UiActions } from "./state.js";
/** 服务器端点摘要：streamable-http 显示 URL，stdio 显示 command + args。 */
export declare function endpointOf(server: any): string;
/** 操作按钮（统一失败提示）。 */
export declare function actionButton(label: any, onClick: any, primary?: boolean, danger?: boolean): any;
/** 渲染单台服务器卡片。 */
export declare function renderServer(server: any, state: McpState, actions: UiActions, opts?: {
    tools: boolean;
}): any;
/** 渲染服务器列表页（#362 交互拍板 1a：项目级 / 全局级两大分组，各自内部再按状态）。
 * project 模式：全局组显示服务器但无工具 checkbox（提示切 all 模式可管理全局工具）。 */
export declare function renderServers(state: McpState, actions: UiActions): void;
