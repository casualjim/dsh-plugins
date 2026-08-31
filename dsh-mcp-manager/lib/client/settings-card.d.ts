/**
 * dsh-mcp-manager — 设置页插件卡（SettingsCard）。
 *
 * 浮窗位置 / 偏移编辑区，React 组件（经 build-client externals 注入）。
 * 读/写走 /api/dsh-mcp/config（GET 读 / POST 写），保存后经 SSE 热更新。
 * 注册面：slots.inject("settings.plugin.item")，由 index.ts 装配。
 */
/**
 * 设置页插件卡（settings.plugin.item）：浮窗位置 / 偏移编辑区。
 * 与 provider-usage「胶囊位置」编辑区同构友好度（锚点下拉 + 水平/垂直偏移 +
 * 空白偏移 + 保存），读/写走 /api/dsh-mcp/config（GET 读 / POST 写），
 * 保存后经 SSE 热更新。
 */
export declare function SettingsCard(): any;
