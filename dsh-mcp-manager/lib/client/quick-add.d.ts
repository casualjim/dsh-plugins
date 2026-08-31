/**
 * dsh-mcp-manager — 客户端「快速接入」页：表单与 mcpServers JSON 导入。
 *
 * 表单构建、读写、编辑、保存、重置；跨模块动作（refresh / switchTab）经
 * actions 注入，不直接引用 panel 模块，避免循环依赖。
 */
import type { McpState, UiActions } from "./state.js";
/** 解析 "KEY: VALUE" / "KEY=VALUE" 多行文本为对象。 */
export declare function parseKV(text: any): Record<string, string>;
/** 当前表单选择的归属（project/global）。 */
export declare function formScopeValue(state: McpState): string;
/** 当前会话 cwd（POST body 携带，宿主据此切换项目级 MCP）。 */
export declare function currentCwdBody(state: McpState): Record<string, string>;
/** 表单数据 → 服务器配置对象（scope 由 formScope 决定）。 */
export declare function readForm(state: McpState): any;
/** 重置表单为默认值。 */
export declare function resetForm(state: McpState): void;
/** 用服务器数据填充表单（编辑模式）。 */
export declare function fillForm(state: McpState, fill: any): void;
/** 保存表单（新增或更新）。 */
export declare function saveForm(state: McpState, actions: UiActions): Promise<void>;
/** 进入编辑模式：填充表单，切换到快速接入 tab。 */
export declare function beginEdit(state: McpState, actions: UiActions, server: any): void;
/** 构建「快速接入」页面（表单 + JSON 导入）。 */
export declare function buildQuickAdd(state: McpState, actions: UiActions): any;
