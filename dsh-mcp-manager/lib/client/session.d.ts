/**
 * dsh-mcp-manager — 客户端会话跟随。
 *
 * 监听当前会话变化（cwd），通知宿主切换项目级 MCP 并刷新 UI。
 * 跨模块动作（refresh）经 actions 注入，不直接引用 panel 模块。
 */
import type { McpState, UiActions } from "./state.js";
/** 跟随当前会话：cwd 变化 → 通知宿主切换项目级 MCP + 刷新浮窗。 */
export declare function bindSession(ctx: any, state: McpState, actions: UiActions): () => void;
