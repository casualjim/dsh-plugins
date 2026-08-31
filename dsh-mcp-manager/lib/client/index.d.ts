/**
 * dsh-mcp-manager — 浏览器端客户端入口（装配层）。
 *
 * 仅含装配逻辑，不含业务实现。业务实现在 constants/dom/servers/quick-add/
 * panel/float/session/settings-card 各模块中。
 *
 * 挂载浏览器端：注入样式 + 右上角浮窗（会话跟随）+ 管理面板 + 设置页插件卡。
 * 失败策略：只 warn 不抛，绝不让 GUI 启动失败。
 *
 * 客户端干净模块：只导出 apply/inject，契约外壳（IIFE/load/Symbol.toStringTag 装配）
 * 由 scripts/build/build-client.ts 统一生成——源码不写任何 loader 痕迹。
 * 样式：独立 style.css（见同目录），build-client 的 .css text-loader 构建期内联为字符串。
 *
 * React 由 dsh web 的 factory require("react") 注入（build-client externals 路径）；
 * 设置页 `settings.plugin.item` 卡由宿主 React 渲染，故客户端必须提供 React 组件。
 */
import { type McpLocaleKey } from "./locales.js";
declare module "@deepseek-ai/dsh-client-ui-slots" {
    interface LocaleNamespaceMap {
        /** dsh-mcp-manager 浮窗/面板/表单/设置卡文案。 */
        "mcpManager": McpLocaleKey;
    }
}
export declare function apply(ctx: any): void;
export declare const inject: string[];
