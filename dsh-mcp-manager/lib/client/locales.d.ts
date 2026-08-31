/**
 * dsh-mcp-manager — 客户端文案字典（issue #348：复用官方 dsh-client-locale）。
 *
 * 双语平衡：`zh` 为 key 源；`en` 必须覆盖全部 key（编译期锁平衡）。
 * 动态数据用 `{name}` 占位模板，渲染期由 t 插值。
 * 不进字典：console 日志、placeholder 示例值（context7/npx/URL/JSON 样例）、
 * 服务器名等动态数据（官方原则：数据不翻译）。
 */
/** 简体中文字典（key 源）。 */
export declare const zh: {
    readonly stConnected: "运行中";
    readonly stConnecting: "连接中";
    readonly stReconnecting: "重连中";
    readonly stStopped: "未连接";
    readonly stDisabled: "已停用";
    readonly stFailed: "失败";
    readonly connect: "连接";
    readonly disconnect: "断开";
    readonly reconnect: "重连";
    readonly enable: "启用";
    readonly enableAndConnect: "启用并连接";
    readonly disable: "禁用";
    readonly edit: "编辑";
    readonly delete: "删除";
    readonly save: "保存";
    readonly cancel: "取消";
    readonly refresh: "刷新";
    readonly close: "关闭";
    readonly cancelEdit: "取消编辑";
    readonly saveFail: "保存失败：{msg}";
    readonly actionFail: "操作失败：{msg}";
    readonly loadFail: "加载失败：{msg}";
    readonly floatAriaLabel: "MCP 管理器";
    readonly floatTitle: "MCP 管理器（点击展开）";
    readonly floatManage: "管理";
    readonly floatEmpty: "没有 MCP 服务器，点「管理」添加";
    readonly floatGlobalSession: "全局会话";
    readonly groupProject: "项目级";
    readonly groupGlobal: "全局";
    readonly badgeScopeProject: "项目";
    readonly badgeScopeGlobal: "全局";
    readonly globalToolHint: "全局工具开关需在 all 模式（中间层全量接管）下管理——切 all 模式可管理全局工具";
    readonly serverMeta: "{status} · {tools} 工具";
    readonly toolsCount: "工具（{n}）";
    readonly toolsCountPlain: "{n} 工具";
    readonly statusGroupCount: "{status}（{n}）";
    readonly panelTitle: "MCP 管理器";
    readonly tabServers: "服务器";
    readonly tabQuickAdd: "快速接入";
    readonly countsConnected: "运行中 {n}";
    readonly countsConnecting: "连接中 {n}";
    readonly countsFailed: "失败 {n}";
    readonly countsSummary: "共 {n} 台 · {parts}";
    readonly countsSummaryOnly: "共 {n} 台";
    readonly addServer: "添加服务器";
    readonly editServer: "编辑服务器：{name}";
    readonly nameLabel: "服务器名称（唯一，作为 mcp__<name>__ 前缀）";
    readonly ownershipLabel: "归属";
    readonly transportLabel: "传输类型";
    readonly commandLabel: "命令（stdio）";
    readonly argsLabel: "参数（逗号分隔）";
    readonly envLabel: "环境变量（每行 KEY=VALUE，支持 ${ENV} 引用，值为空则继承父环境）";
    readonly cwdLabel: "工作目录（可选）";
    readonly urlLabel: "URL（streamable-http）";
    readonly headersLabel: "请求头（每行 KEY: VALUE，支持 ${ENV} 引用）";
    readonly enabledLabel: "启用（保存后立即连接）";
    readonly scopeProjectOpt: "项目级（<项目>/.dsh/mcp.json，随会话切换）";
    readonly scopeGlobalOpt: "全局（~/.dsh/dsh-mcp.json）";
    readonly transportStdioOpt: "stdio（本地子进程）";
    readonly transportHttpOpt: "streamable-http（远程）";
    readonly envPlaceholder: "每行 KEY=VALUE，如\nCONTEXT7_API_KEY=${CONTEXT7_API_KEY}";
    readonly headersPlaceholder: "每行 KEY: VALUE，支持 ${ENV} 引用，如\nAuthorization: Bearer ${CONTEXT7_API_KEY}";
    readonly cwdPlaceholder: "可选工作目录";
    readonly pasteTitle: "粘贴 mcpServers JSON 导入";
    readonly importJson: "导入 JSON";
    readonly importedOk: "已导入：{names}";
    readonly importedNone: "（无）";
    readonly importSkipped: "跳过（已存在）：{names}";
    readonly importFail: "导入失败：{msg}";
    readonly serversEmpty: "还没有配置 MCP 服务器。切到「快速接入」页添加，或粘贴 mcpServers JSON 导入。";
    readonly confirmDelete: "删除 MCP 服务器「{name}」？";
    readonly settingsLoading: "MCP 管理器：加载中…";
    readonly settingsName: "MCP 管理器（dsh-mcp-manager）";
    readonly settingsDescription: "浮窗位置 / 水平·垂直·空白偏移";
    readonly anchorLabel: "锚点";
    readonly posTopRight: "右上（top-right）";
    readonly posTopLeft: "左上（top-left）";
    readonly posBottomRight: "右下（bottom-right）";
    readonly posBottomLeft: "左下（bottom-left）";
    readonly modeLabel: "中间层模式";
    readonly modeProject: "project（项目级走中间层，推荐）";
    readonly modeAll: "all（全局也走中间层）";
    readonly modeOff: "off（全部直呼 mcp__ 工具）";
    readonly offsetX: "水平偏移";
    readonly offsetY: "垂直偏移";
    readonly blankY: "空白偏移";
    readonly zIndexBase: "层级基准";
    readonly settingsHint: "保存即热更新：浮窗位置即时生效；中间层模式切换即时生效并持久化（无需重启 dsh web）。";
    readonly savingNow: "保存中…";
    readonly settingsSavedOk: "已保存——浮窗位置与中间层模式即时生效（无需重启）";
};
/** 字典 key 并集（LocaleNamespaceMap 声明合并用）。 */
export type McpLocaleKey = keyof typeof zh;
/** 英文词典：必须与 zh key 完整对齐。 */
export declare const en: Record<McpLocaleKey, string>;
