"use strict";
// 契约外壳（scripts/build-client.ts 生成）：external 依赖（React 等）经 factory 注入的 require 解析
window.__ModuleLoader__.load({
  id: "dsh-mcp-manager",
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    "use strict";
    "use strict";
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    // src/client/index.ts
    var index_exports = {};
    __export(index_exports, {
      apply: () => apply,
      inject: () => inject
    });
    module.exports = __toCommonJS(index_exports);

    // src/client/style.css
    var style_default = '/* dsh-mcp-manager — 客户端样式（独立 .css 文件）。\n *\n * 由 build-client 的 .css text-loader 构建期内联进 client.js（产物仍自包含单文件、\n * 零运行时依赖、无独立请求）。前缀 dm-（防与 shell / 其他插件样式冲突）；颜色一律\n * 走 --dsw-alias-* 主题变量 + 浅色回退，明暗自适应。 */\n\n[data-conversation-scroll]{position:relative}\n[data-pane="conversation"]{position:relative}\n\n.dm-float{position:absolute;top:44px;right:14px;z-index:10;display:flex;align-items:center;gap:6px;padding:5px 11px;border:1px solid var(--dsw-alias-border-l1,#d7dae0);border-radius:99px;background:var(--dsw-alias-bg-base,#fdfdfd);color:var(--dsw-alias-label-primary,#1c1e26);font-size:12px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.10);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}\n/* 触控热区（#128，WCAG 2.2 AA ≥24px 底线）：伪元素外扩不占布局；narrow 档下方加大外扩至 ≈44px 主操作目标 */\n.dm-float::after{content:"";position:absolute;inset:-5px;border-radius:99px}\n.dm-float .dm-dot{width:7px;height:7px;border-radius:50%;display:inline-block}\n.dm-float-panel{position:fixed;top:44px;right:14px;width:min(400px,calc(100vw - 36px));max-height:min(70vh,560px);max-height:min(70dvh,560px);overflow:auto;background:var(--dsw-alias-bg-base,#fdfdfd);color:var(--dsw-alias-label-primary,#1c1e26);border:1px solid var(--dsw-alias-border-l1,#e2e4ea);border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.18);z-index:10;padding:10px 12px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:12px}\n/* #128 移动端档位样式：由客户端按 conversationHost rect 宽度判定并写 data-dm-bp\n * （JS 判定，非 @media——防桌面窄窗 / iPad Slide Over 误触发）；阈值见 src/placement-math.ts。\n * dvh 级联回退：先声明 vh 兜底，再以 dvh 覆写（软键盘弹出时随 visualViewport 收缩）。 */\n.dm-float-panel[data-dm-bp="narrow"]{width:calc(100vw - 16px);max-height:calc(85vh - 88px);max-height:calc(85dvh - 88px);padding:10px}\n.dm-float-panel[data-dm-bp="tablet"]{width:min(400px,calc(100vw - 24px))}\n/* 窄屏卡片重排：服务器行允许换行，元信息折到操作按钮下方整行显示 */\n.dm-float-panel[data-dm-bp="narrow"] .dm-float-row{flex-wrap:wrap;row-gap:2px}\n.dm-float-panel[data-dm-bp="narrow"] .dm-float-row .dm-float-meta{flex-basis:100%;white-space:normal}\n.dm-float-panel[data-dm-bp="narrow"] .dm-float-actions{flex:1;justify-content:flex-end}\n/* 触控目标分层（#128）：narrow 档主操作 min-height 36px + 伪元素外扩 4px 命中区 ≈44px；\n   tablet 档 30px 过渡；wide 档维持现状。 */\n.dm-float-action{position:relative}\n.dm-float-panel[data-dm-bp="narrow"] .dm-float-action{min-height:36px;padding:6px 14px;font-size:12.5px}\n.dm-float-panel[data-dm-bp="narrow"] .dm-float-action::before{content:"";position:absolute;inset:-4px}\n.dm-float-panel[data-dm-bp="tablet"] .dm-float-action{min-height:30px;padding:4px 11px}\n.dm-float-panel[data-dm-bp="narrow"] .dm-float-head button{min-height:36px;padding:5px 12px;font-size:12.5px}\n.dm-float-panel[hidden]{display:none !important}\n.dm-float-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}\n.dm-float-title{flex:1;font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.dm-float-head button{border:1px solid var(--dsw-alias-border-l1,#d7dae0);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#3a3f4b);border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer}\n.dm-float-group{margin-bottom:8px}\n.dm-float-group-title{font-size:10px;color:var(--dsw-alias-label-secondary,#8a8f9c);font-weight:600;margin:6px 0 4px}\n.dm-float-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1,#eef0f3);border-radius:8px;margin-bottom:6px;background:var(--dsw-alias-bg-layer-1,#fafbfc)}\n.dm-float-row .dm-float-name{font-weight:600;font-family:ui-monospace,Consolas,monospace;font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.dm-float-row .dm-float-meta{flex:1;font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f9c);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.dm-float-actions{flex:none;display:flex;gap:4px}\n.dm-float-action{border:1px solid var(--dsw-alias-border-l1,#d7dae0);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#3a3f4b);border-radius:6px;padding:2px 8px;font-size:11px;cursor:pointer}\n\n.dm-overlay{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-2,rgba(8,10,16,.45));display:flex;align-items:center;justify-content:center;z-index:9999;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}\n.dm-overlay[hidden]{display:none !important}\n.dm-card{width:min(860px,94vw);max-height:86vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#fdfdfd);color:var(--dsw-alias-label-primary,#1c1e26);border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.35);overflow:hidden}\n.dm-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#f7f8fa)}\n.dm-head h2{margin:0;font-size:15px;font-weight:600}\n.dm-head .dm-counts{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f9c);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.dm-head button{border:1px solid var(--dsw-alias-border-l1,#d7dae0);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#3a3f4b);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}\n.dm-tabs{display:flex;gap:2px;padding:0 12px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#f7f8fa)}\n.dm-tab{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#6b7280);padding:9px 14px;font-size:13px;cursor:pointer;border-bottom:2px solid transparent}\n.dm-tab[data-active]{color:var(--dsw-alias-label-primary,#1c1e26);font-weight:600;border-bottom-color:var(--dsw-alias-brand-primary,#4f6ef7)}\n.dm-body{padding:14px 16px;overflow:auto;min-height:200px}\n.dm-status{padding:26px;color:var(--dsw-alias-label-secondary,#6b7280);font-size:13px;text-align:center}\n\n.dm-group{margin-bottom:18px}\n.dm-group>h3{margin:0 0 2px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#2f3542);display:flex;align-items:center;gap:8px}\n.dm-dot{width:8px;height:8px;border-radius:50%;display:inline-block}\n.dm-group>.dm-hint{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f9c);margin:0 0 8px}\n.dm-count{font-weight:400;color:var(--dsw-alias-label-secondary,#8a8f9c);margin-left:2px;font-size:11px}\n.dm-server{border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:8px;padding:10px 12px;margin-bottom:8px;background:var(--dsw-alias-bg-base,#fff)}\n.dm-server header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}\n.dm-server .dm-name{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#111827);font-family:ui-monospace,Consolas,monospace}\n.dm-badge{font-size:10px;padding:1px 7px;border-radius:99px;background:var(--dsw-alias-bg-layer-2,#f1f2f5);color:var(--dsw-alias-label-secondary,#525866);border:1px solid var(--dsw-alias-border-l2,#e2e4ea)}\n.dm-badge.dm-http{background:var(--dsw-alias-state-business-secondary,#eef2ff);color:var(--dsw-alias-state-business-primary,#4353a3);border-color:var(--dsw-alias-state-business-tertiary,#dde3f8)}\n.dm-badge.dm-stdio{background:var(--dsw-alias-bg-layer-2,#f5f0ff);color:var(--dsw-alias-label-secondary,#6d4bb8);border-color:var(--dsw-alias-border-l2,#e6dcf8)}\n.dm-badge.dm-st-connected{background:var(--dsw-alias-state-success-secondary,#ecfdf5);color:var(--dsw-alias-state-success-primary,#0f7a50);border-color:var(--dsw-alias-state-success-tertiary,#c9f0dd)}\n.dm-badge.dm-st-connecting,.dm-badge.dm-st-reconnecting{background:var(--dsw-alias-state-business-secondary,#eff6ff);color:var(--dsw-alias-state-business-primary,#1d66b8);border-color:var(--dsw-alias-state-business-tertiary,#d3e5fb)}\n.dm-badge.dm-st-failed{background:var(--dsw-alias-state-error-secondary,#fef2f2);color:var(--dsw-alias-state-error-primary,#b42318);border-color:var(--dsw-alias-state-error-tertiary,#f8d3d0)}\n.dm-badge.dm-st-disabled,.dm-badge.dm-st-stopped{background:var(--dsw-alias-bg-layer-2,#f1f2f5);color:var(--dsw-alias-label-secondary,#6b7280);border-color:var(--dsw-alias-border-l2,#e2e4ea)}\n.dm-server .dm-endpoint{margin:5px 0 0;font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f9c);font-family:ui-monospace,Consolas,monospace;word-break:break-all}\n.dm-server .dm-err{margin:5px 0 0;font-size:11px;color:var(--dsw-alias-state-error-primary,#b42318)}\n.dm-server .dm-tools{margin:6px 0 0}\n.dm-server .dm-tools summary{font-size:11px;color:var(--dsw-alias-label-secondary,#525866);cursor:pointer;user-select:none}\n.dm-server .dm-tools ul{margin:4px 0 0;padding-left:16px;font-size:11px;color:var(--dsw-alias-label-primary,#3a3f4b);font-family:ui-monospace,Consolas,monospace}\n.dm-actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}\n.dm-actions button{border:1px solid var(--dsw-alias-border-l1,#d7dae0);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#3a3f4b);border-radius:6px;padding:3px 9px;font-size:11px;cursor:pointer}\n.dm-actions button.dm-danger{color:var(--dsw-alias-state-error-primary,#b42318);border-color:var(--dsw-alias-state-error-tertiary,#f0c4c1)}\n.dm-actions button.dm-primary{color:var(--dsw-alias-brand-primary,#1d4ed8);border-color:var(--dsw-alias-state-business-tertiary,#bcd1fb);background:var(--dsw-alias-state-business-secondary,#f5f8ff)}\n.dm-actions button:disabled{opacity:.5;cursor:not-allowed}\n\n.dm-section{margin-bottom:18px}\n.dm-section>h3{margin:0 0 8px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#2f3542)}\n.dm-form{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;max-width:640px}\n.dm-form .dm-full{grid-column:1/-1}\n.dm-field{display:flex;flex-direction:column;gap:4px}\n.dm-field label{font-size:11px;color:var(--dsw-alias-label-secondary,#525866);font-weight:600}\n.dm-field input,.dm-field select,.dm-field textarea{border:1px solid var(--dsw-alias-border-l1,#d7dae0);border-radius:6px;padding:6px 8px;font-size:12px;color:var(--dsw-alias-label-primary,#1c1e26);background:var(--dsw-alias-bg-layer-1,#fff);font-family:ui-monospace,Consolas,monospace}\n.dm-field textarea{min-height:64px;resize:vertical}\n.dm-field input[type=checkbox]{width:auto}\n.dm-check{flex-direction:row;align-items:center;gap:8px}\n.dm-check label{margin:0}\n.dm-form-actions{grid-column:1/-1;display:flex;gap:8px}\n.dm-form-actions button{border:1px solid var(--dsw-alias-border-l1,#d7dae0);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#3a3f4b);border-radius:6px;padding:6px 14px;font-size:12px;cursor:pointer}\n.dm-form-actions button.dm-primary{background:var(--dsw-alias-button-primary-fill,#4f6ef7);color:var(--dsw-alias-label-primary-foreground,#fff);border-color:var(--dsw-alias-button-primary-fill,#4f6ef7)}\n.dm-hint{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8f9c)}\n.dm-paste-box{border:1px solid var(--dsw-alias-border-l1,#e5e7eb);border-radius:8px;padding:12px;background:var(--dsw-alias-bg-layer-1,#fafbfc);max-width:640px}\n.dm-result{font-size:12px;color:var(--dsw-alias-state-success-primary,#0f7a50);margin-top:8px;line-height:1.6}\n.dm-result .dm-skip{color:var(--dsw-alias-state-warn-primary,#b45309)}\n\n/* 设置页插件卡（settings.plugin.item）——浮窗位置 / 偏移编辑区。\n * 前缀 dm-，颜色走 --dsw-alias-* 主题变量 + 浅色回退，明暗自适应。 */\n.dm-set-card{list-style:none;margin:0;padding:0;border:1px solid var(--dsw-alias-border-l2,#e2e5ea);border-radius:12px;background:var(--dsw-alias-bg-layer-3,#fbfbfc);overflow:hidden;transition:border-color .16s,background .16s}\n.dm-set-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:transparent;border:none;cursor:pointer;text-align:left;color:var(--dsw-alias-label-primary,#1f2329)}\n.dm-set-headText{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}\n.dm-set-name{display:block;font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary,#1f2329)}\n.dm-set-description{display:block;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#8a919c)}\n.dm-set-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#5f6672);transition:transform .16s ease}\n.dm-set-chevronOpen{transform:rotate(180deg)}\n.dm-set-body{padding:4px 14px 14px;border-top:1px solid var(--dsw-alias-border-l1,#e2e5ea);display:flex;flex-direction:column;gap:9px}\n.dm-set-row{display:flex;align-items:center;gap:12px;margin:0;flex-wrap:wrap}\n.dm-set-row>label{font-size:12.5px;color:var(--dsw-alias-label-secondary,#5f6672);font-weight:600;white-space:nowrap}\n.dm-set-field{display:inline-flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#5f6672);font-weight:600}\n.dm-set-input{min-width:88px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l1,#e2e5ea);border-radius:6px;font-size:12.5px;color:var(--dsw-alias-label-primary,#1f2329);background:var(--dsw-alias-bg-layer-1,#fff);box-sizing:border-box}\n.dm-set-input:focus{outline:none;border-color:var(--dsw-alias-state-info-primary,#3b82f6)}\n.dm-set-hint{margin-top:0;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a919c);line-height:1.5}\n.dm-set-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:10px}\n.dm-set-foot .dm-set-saved{font-size:12px;color:var(--dsw-alias-state-success-primary,#16a34a)}\n.dm-set-foot .dm-set-error{font-size:12px;color:var(--dsw-alias-state-danger-primary,#dc2626)}\n.dm-set-save{border:1px solid var(--dsw-alias-border-l1,#e2e5ea);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#3a3f4b);border-radius:6px;padding:5px 14px;font-size:12px;cursor:pointer}\n.dm-set-save:disabled{opacity:.5;cursor:not-allowed}\n\n/* #128 悬停态统一包裹 @media(hover:hover)：触屏设备不吸附悬停背景（规格第 7 条）。 */\n@media (hover: hover) {\n.dm-float:hover{background:var(--dsw-alias-interactive-bg-hover,#f2f4f8)}\n.dm-float-head button:hover{background:var(--dsw-alias-interactive-bg-hover,#eef1f5)}\n.dm-float-action:hover{background:var(--dsw-alias-interactive-bg-hover,#eef1f5)}\n.dm-head button:hover{background:var(--dsw-alias-interactive-bg-hover,#eef1f5)}\n.dm-actions button:hover{background:var(--dsw-alias-interactive-bg-hover,#eef1f5)}\n.dm-form-actions button:hover{background:var(--dsw-alias-interactive-bg-hover,#eef1f5)}\n.dm-set-card:hover{border-color:var(--dsw-alias-label-dimmed,#9ba1a6)}\n.dm-set-head:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}\n.dm-set-save:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}\n}\n\n/* #362 工具级禁用：折叠式 details + checkbox 列表（浮窗与管理面板共用视觉）。 */\n.dm-float-tools{margin:4px 0 0 16px}\n.dm-float-tools summary{font-size:11px;color:var(--dsw-alias-label-secondary,#525866);cursor:pointer;user-select:none}\n.dm-float-tool-list{display:flex;flex-direction:column;gap:2px;margin:4px 0 0;max-height:140px;overflow:auto}\n.dm-float-tool,.dm-tool{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-primary,#3a3f4b);font-family:ui-monospace,Consolas,monospace;cursor:pointer;line-height:1.6}\n.dm-float-tool input,.dm-tool input{width:13px;height:13px;margin:0;accent-color:var(--dsw-alias-state-info-primary,#3b82f6);flex:none}\n.dm-float-hint{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8a919c);line-height:1.5;padding:4px 8px 2px}\n.dm-subgroup{margin:6px 0 10px}\n.dm-subgroup-title{margin:0 0 4px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#525866)}\n.dm-group>h3 .dm-count{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a919c);font-weight:600}\n';

    // src/client/index.ts
    var React2 = __toESM(require("react"), 1);

    // src/client/constants.ts
    var API = {
      servers: "/api/dsh-mcp/servers",
      connect: "/api/dsh-mcp/servers/connect",
      disconnect: "/api/dsh-mcp/servers/disconnect",
      reconnect: "/api/dsh-mcp/servers/reconnect",
      importJson: "/api/dsh-mcp/import/json",
      session: "/api/dsh-mcp/session",
      config: "/api/dsh-mcp/config",
      events: "/api/dsh-mcp/events",
      health: "/api/dsh-mcp/health",
      toolDisable: "/api/dsh-mcp/tool-disable"
    };
    var STATUS_ORDER = [
      { key: "connected", titleKey: "stConnected", dot: "var(--dsw-alias-state-success-primary,#0f9d6e)" },
      { key: "connecting", titleKey: "stConnecting", dot: "var(--dsw-alias-state-business-primary,#2f7bf6)" },
      { key: "reconnecting", titleKey: "stReconnecting", dot: "var(--dsw-alias-state-warn-primary,#e08b1e)" },
      { key: "stopped", titleKey: "stStopped", dot: "var(--dsw-alias-label-tertiary,#9aa1ad)" },
      { key: "disabled", titleKey: "stDisabled", dot: "var(--dsw-alias-label-tertiary,#9aa1ad)" },
      { key: "failed", titleKey: "stFailed", dot: "var(--dsw-alias-state-error-primary,#e0483e)" }
    ];
    var STATUS_TEXT = {
      connected: "stConnected",
      connecting: "stConnecting",
      reconnecting: "stReconnecting",
      stopped: "stStopped",
      disabled: "stDisabled",
      failed: "stFailed"
    };
    function statusDot(status) {
      const group = STATUS_ORDER.find((entry) => entry.key === status);
      return group !== void 0 ? group.dot : "var(--dsw-alias-label-tertiary,#9aa1ad)";
    }

    // src/placement-math.ts
    var Z_INDEX_BASE_MIN = 1;
    var Z_INDEX_BASE_MAX = 9e3;
    var DEFAULT_Z_INDEX_BASE = 10;
    function clampZIndexBase(value, dflt) {
      if (typeof value !== "number" || !Number.isFinite(value)) return dflt;
      return Math.min(Z_INDEX_BASE_MAX, Math.max(Z_INDEX_BASE_MIN, Math.round(value)));
    }
    function panelAnchorForPosition(position) {
      return position === "bottom-right" || position === "bottom-left" ? "bottom" : "top";
    }
    var BREAKPOINT_NARROW_MAX = 480;
    var BREAKPOINT_TABLET_MAX = 834;
    function breakpointForWidth(width) {
      const w = Number.isFinite(width) ? width : Number.POSITIVE_INFINITY;
      if (w <= BREAKPOINT_NARROW_MAX) return "narrow";
      if (w <= BREAKPOINT_TABLET_MAX) return "tablet";
      return "wide";
    }
    function clampPointToViewport(x, y, width, height, viewportW, viewportH, safeInset = 0) {
      const ins = Number.isFinite(safeInset) ? Math.max(0, safeInset) : 0;
      const hiX = Math.max(ins, viewportW - width - ins);
      const hiY = Math.max(ins, viewportH - height - ins);
      return {
        x: Math.min(Math.max(x, ins), hiX),
        y: Math.min(Math.max(y, ins), hiY)
      };
    }
    function composerDockedAtBottom(seatRect, containerRect) {
      if (seatRect == null || containerRect == null) return false;
      return Math.abs(seatRect.bottom - containerRect.bottom) <= 0.5;
    }
    function bottomAnchorEdge(containerBottom, seatTop, docked) {
      if (docked && typeof seatTop === "number" && Number.isFinite(seatTop)) return seatTop;
      return containerBottom;
    }

    // src/client/state.ts
    function createState() {
      return {
        overlay: void 0,
        card: void 0,
        bodyEl: void 0,
        open: false,
        activeTab: "servers",
        servers: [],
        middlewareMode: "project",
        counts: {},
        editingName: void 0,
        editing: void 0,
        formName: void 0,
        formScope: void 0,
        formTransport: void 0,
        formCommand: void 0,
        formArgs: void 0,
        formEnv: void 0,
        formCwd: void 0,
        formUrl: void 0,
        formHeaders: void 0,
        formEnabled: void 0,
        floatPill: void 0,
        floatPanel: void 0,
        floatOpen: false,
        currentCwd: void 0,
        projectRoot: void 0,
        updateFloatState: void 0,
        mcpUiConfig: { position: "top-right", offsetX: 8, offsetY: 8, blankY: 40, zIndexBase: DEFAULT_Z_INDEX_BASE },
        API: { ...API }
      };
    }

    // src/client/dom.ts
    function el(tag, attrs = {}, children) {
      if (children === void 0) children = attrs.children ?? [];
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = String(value);
        else if (key === "dataset") Object.assign(node.dataset, value);
        else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else if (key === "checked") node.checked = value;
        else if (key === "disabled") node.disabled = value;
        else if (key === "children") continue;
        else node.setAttribute(key, String(value));
      }
      for (const child of children) {
        if (child === void 0 || child === null) continue;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      }
      return node;
    }
    async function api(path, options = {}) {
      const timeoutMs = options.timeoutMs ?? 1e4;
      const hasCallerSignal = options.signal !== void 0;
      const controller = new AbortController();
      const timer = hasCallerSignal ? void 0 : setTimeout(() => controller.abort(new Error(`request timed out (${timeoutMs}ms)`)), timeoutMs);
      const merged = { ...options, signal: options.signal ?? controller.signal };
      try {
        const response = await fetch(path, merged);
        let body;
        try {
          body = await response.json();
        } catch {
          body = void 0;
        }
        if (!response.ok) {
          throw new Error(body?.error ?? `HTTP ${response.status}`);
        }
        return body;
      } finally {
        if (timer !== void 0) clearTimeout(timer);
      }
    }

    // src/client/i18n.ts
    var t = function(key) {
      return key;
    };
    function bindLocale(locale, ns) {
      if (locale && typeof locale.bind === "function") {
        t = locale.bind(ns);
      }
    }

    // src/client/servers.ts
    function endpointOf(server) {
      if (server.transport === "streamable-http") return server.url ?? "";
      const args = Array.isArray(server.args) && server.args.length > 0 ? ` ${server.args.join(" ")}` : "";
      return `${server.command ?? ""}${args}`;
    }
    function actionButton(label, onClick, primary = false, danger = false) {
      return el("button", {
        class: `${primary ? "dm-primary" : ""} ${danger ? "dm-danger" : ""}`.trim(),
        text: label,
        onclick: async () => {
          try {
            await onClick();
          } catch (error) {
            window.alert(t("actionFail", { msg: error instanceof Error ? error.message : String(error) }));
          }
        }
      });
    }
    function toolCheckbox(server, tool, disabled, state, actions) {
      const label = el("label", { class: "dm-tool" });
      const input = el("input", { type: "checkbox", checked: disabled });
      input.addEventListener("change", () => {
        void api(state.API.toolDisable, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            server: `@${server.scope === "global" ? "@global" : state.projectRoot ?? ""}/${server.name}`,
            tool,
            disabled: input.checked
          })
        }).then(() => actions.refresh()).catch((error) => {
          input.checked = !input.checked;
          console.warn("[dsh-mcp-manager] tool-disable failed:", error);
        });
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(tool));
      return label;
    }
    function renderServer(server, state, actions, opts = { tools: true }) {
      const article = el("article", { class: "dm-server" });
      const header = el("header");
      header.appendChild(el("span", { class: "dm-name", text: server.name }));
      header.appendChild(el("span", {
        class: `dm-badge ${server.transport === "streamable-http" ? "dm-http" : "dm-stdio"}`,
        text: server.transport === "streamable-http" ? "HTTP" : "stdio"
      }));
      header.appendChild(el("span", { class: "dm-badge", text: server.scope === "project" ? t("badgeScopeProject") : t("badgeScopeGlobal") }));
      const statusBadge = el("span", { class: `dm-badge dm-st-${server.status}`, text: STATUS_TEXT[server.status] !== void 0 ? t(STATUS_TEXT[server.status]) : server.status });
      header.appendChild(statusBadge);
      const toolCount = Array.isArray(server.tools) ? server.tools.length : 0;
      header.appendChild(el("span", { class: "dm-count", text: t("toolsCountPlain", { n: toolCount }) }));
      article.appendChild(header);
      article.appendChild(el("div", { class: "dm-endpoint", text: endpointOf(server) }));
      if (server.error !== void 0 && server.error !== "") {
        article.appendChild(el("div", { class: "dm-err", text: server.error }));
      }
      if (toolCount > 0 && opts.tools) {
        const details = el("details", { class: "dm-tools" });
        details.appendChild(el("summary", { text: t("toolsCount", { n: toolCount }) }));
        const list = el("ul");
        const disabledSet = new Set(Array.isArray(server.disabledTools) ? server.disabledTools : []);
        for (const tool of server.tools) {
          list.appendChild(el("li", {}, [toolCheckbox(server, tool, disabledSet.has(tool), state, actions)]));
        }
        details.appendChild(list);
        article.appendChild(details);
      } else if (toolCount > 0 && !opts.tools) {
        const details = el("details", { class: "dm-tools" });
        details.appendChild(el("summary", { text: t("toolsCount", { n: toolCount }) }));
        const list = el("ul");
        for (const tool of server.tools) list.appendChild(el("li", { text: tool }));
        details.appendChild(list);
        article.appendChild(details);
      }
      const actionsEl = el("div", { class: "dm-actions" });
      const busy = server.status === "connecting" || server.status === "reconnecting";
      const scopeQuery = `&scope=${server.scope}`;
      if (server.status === "connected") {
        actionsEl.appendChild(actionButton(t("disconnect"), async () => {
          await api(`${state.API.disconnect}?name=${encodeURIComponent(server.name)}${scopeQuery}`, { method: "POST" });
          await actions.refresh();
        }));
        actionsEl.appendChild(actionButton(t("reconnect"), async () => {
          await api(`${state.API.reconnect}?name=${encodeURIComponent(server.name)}${scopeQuery}`, { method: "POST" });
          await actions.refresh();
        }));
      } else if (server.status === "disabled") {
        actionsEl.appendChild(actionButton(t("enableAndConnect"), async () => {
          await api(`${state.API.servers}?name=${encodeURIComponent(server.name)}${scopeQuery}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: true })
          });
          await api(`${state.API.connect}?name=${encodeURIComponent(server.name)}${scopeQuery}`, { method: "POST" });
          await actions.refresh();
        }, true));
      } else {
        actionsEl.appendChild(actionButton(t("connect"), async () => {
          await api(`${state.API.connect}?name=${encodeURIComponent(server.name)}${scopeQuery}`, { method: "POST" });
          await actions.refresh();
        }, true));
      }
      if (server.status !== "disabled") {
        actionsEl.appendChild(actionButton(t("disable"), async () => {
          await api(`${state.API.servers}?name=${encodeURIComponent(server.name)}${scopeQuery}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: false })
          });
          if (state.editingName === server.name) actions.resetForm();
          await actions.refresh();
        }));
      }
      actionsEl.appendChild(actionButton(t("edit"), () => actions.beginEdit(server)));
      actionsEl.appendChild(actionButton(t("delete"), async () => {
        if (!window.confirm(t("confirmDelete", { name: server.name }))) return;
        await api(`${state.API.servers}?name=${encodeURIComponent(server.name)}${scopeQuery}`, { method: "DELETE" });
        if (state.editingName === server.name) actions.resetForm();
        await actions.refresh();
      }, false, true));
      actionsEl.children[actionsEl.children.length - 1].disabled = busy;
      article.appendChild(actionsEl);
      return article;
    }
    function renderServers(state, actions) {
      if (state.bodyEl === void 0) return;
      state.bodyEl.textContent = "";
      if (state.servers.length === 0) {
        state.bodyEl.appendChild(el("div", { class: "dm-status", text: t("serversEmpty") }));
        return;
      }
      const isAll = state.middlewareMode === "all";
      const toolsEnabled = (scope) => scope === "project" || isAll;
      for (const scope of ["project", "global"]) {
        const list = state.servers.filter((server) => server.scope === scope);
        if (list.length === 0) continue;
        const section = el("section", { class: "dm-group" });
        const title = el("h3");
        title.appendChild(document.createTextNode(scope === "project" ? t("groupProject") : t("groupGlobal")));
        title.appendChild(el("span", { class: "dm-count", text: `${list.length}` }));
        section.appendChild(title);
        for (const group of STATUS_ORDER) {
          const grouped = list.filter((server) => server.status === group.key);
          if (grouped.length === 0) continue;
          const sub = el("div", { class: "dm-subgroup" });
          sub.appendChild(el("h4", { class: "dm-subgroup-title", text: t("statusGroupCount", { status: t(group.titleKey), n: grouped.length }) }));
          for (const server of grouped.sort((a, b) => a.name.localeCompare(b.name))) {
            sub.appendChild(renderServer(server, state, actions, { tools: toolsEnabled(scope) }));
          }
          section.appendChild(sub);
        }
        if (scope === "global" && !isAll) {
          section.appendChild(el("div", { class: "dm-status", text: t("globalToolHint") }));
        }
        state.bodyEl.appendChild(section);
      }
    }

    // src/client/quick-add.ts
    function parseKV(text) {
      const out = {};
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line === "") continue;
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(.*)$/);
        if (match === null) continue;
        const value = match[2].trim();
        if (value !== "") out[match[1]] = value;
        else out[match[1]] = "";
      }
      return out;
    }
    function formScopeValue(state) {
      if (state.formScope !== void 0 && (state.formScope.value === "project" || state.formScope.value === "global")) {
        return state.formScope.value;
      }
      return state.projectRoot !== void 0 && state.projectRoot !== "" ? "project" : "global";
    }
    function currentCwdBody(state) {
      return typeof state.currentCwd === "string" && state.currentCwd !== "" ? { cwd: state.currentCwd } : {};
    }
    function readForm(state) {
      const server = {
        name: state.formName?.value.trim() ?? "",
        transport: state.formTransport?.value ?? "stdio",
        enabled: state.formEnabled?.checked ?? true
      };
      if (server.transport === "stdio") {
        server.command = state.formCommand?.value.trim() ?? "";
        const args = (state.formArgs?.value ?? "").split(",").map((part) => part.trim()).filter(Boolean);
        if (args.length > 0) server.args = args;
        const env = parseKV(state.formEnv?.value ?? "");
        if (Object.keys(env).length > 0) server.env = env;
        if ((state.formCwd?.value ?? "").trim() !== "") server.cwd = state.formCwd?.value.trim();
      } else {
        server.url = state.formUrl?.value.trim() ?? "";
        const headers = parseKV(state.formHeaders?.value ?? "");
        if (Object.keys(headers).length > 0) server.headers = headers;
      }
      return server;
    }
    function resetForm(state) {
      state.editingName = void 0;
      state.editing = void 0;
      if (state.formName === void 0) return;
      state.formName.value = "";
      state.formScope.value = state.projectRoot !== void 0 && state.projectRoot !== "" ? "project" : "global";
      state.formTransport.value = "stdio";
      state.formCommand.value = "";
      state.formArgs.value = "";
      state.formEnv.value = "";
      state.formCwd.value = "";
      state.formUrl.value = "";
      state.formHeaders.value = "";
      state.formEnabled.checked = true;
      state.formTransport.dispatchEvent(new Event("change"));
      const title = document.getElementById("dm-form-title");
      if (title !== null) title.textContent = t("addServer");
      const cancel = document.querySelector("[data-dm-cancel]");
      if (cancel !== null) cancel.disabled = true;
    }
    function fillForm(state, fill) {
      resetForm(state);
      if (fill.name !== void 0) state.formName.value = fill.name;
      state.formTransport.value = fill.transport ?? "stdio";
      if (fill.command !== void 0) state.formCommand.value = fill.command;
      if (Array.isArray(fill.args)) state.formArgs.value = fill.args.join(", ");
      if (fill.env !== void 0) {
        state.formEnv.value = Object.entries(fill.env).map(([key, value]) => `${key}=${value}`).join("\n");
      }
      if (fill.cwd !== void 0) state.formCwd.value = fill.cwd;
      if (fill.url !== void 0) state.formUrl.value = fill.url;
      if (fill.headers !== void 0) {
        state.formHeaders.value = Object.entries(fill.headers).map(([key, value]) => `${key}: ${value}`).join("\n");
      }
      state.formTransport.dispatchEvent(new Event("change"));
    }
    async function saveForm(state, actions) {
      const server = readForm(state);
      try {
        const payload = { ...server, scope: formScopeValue(state), ...currentCwdBody(state) };
        if (state.editingName !== void 0) {
          await api(`${state.API.servers}?name=${encodeURIComponent(state.editingName)}&scope=${formScopeValue(state)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          });
        } else {
          await api(state.API.servers, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          });
        }
        resetForm(state);
        await actions.refresh();
      } catch (error) {
        window.alert(t("saveFail", { msg: error instanceof Error ? error.message : String(error) }));
      }
    }
    function beginEdit(state, actions, server) {
      state.editingName = server.name;
      state.editing = server;
      actions.switchTab("quick");
      fillForm(state, server);
      if (state.formScope !== void 0 && (server.scope === "project" || server.scope === "global")) {
        state.formScope.value = server.scope;
      }
      const title = document.getElementById("dm-form-title");
      if (title !== null) title.textContent = t("editServer", { name: server.name });
      const cancel = document.querySelector("[data-dm-cancel]");
      if (cancel !== null) cancel.disabled = false;
    }
    function buildQuickAdd(state, actions) {
      const page = el("div");
      const form = el("section", { class: "dm-section" });
      form.appendChild(el("h3", { id: "dm-form-title", text: t("addServer") }));
      state.formName = el("input", { id: "dm-f-name", placeholder: "context7", value: state.editing?.name ?? "" });
      state.formScope = el("select", { id: "dm-f-scope" });
      state.formScope.appendChild(el("option", { value: "project", text: t("scopeProjectOpt") }));
      state.formScope.appendChild(el("option", { value: "global", text: t("scopeGlobalOpt") }));
      state.formScope.value = state.editing?.scope ?? (state.projectRoot !== void 0 && state.projectRoot !== "" ? "project" : "global");
      state.formTransport = el("select", { id: "dm-f-transport" });
      state.formTransport.appendChild(el("option", { value: "stdio", text: t("transportStdioOpt") }));
      state.formTransport.appendChild(el("option", { value: "streamable-http", text: t("transportHttpOpt") }));
      state.formCommand = el("input", { id: "dm-f-command", placeholder: "npx" });
      state.formArgs = el("input", { id: "dm-f-args", placeholder: "-y, @context7/mcp-server" });
      state.formEnv = el("textarea", { id: "dm-f-env", placeholder: t("envPlaceholder") });
      state.formCwd = el("input", { id: "dm-f-cwd", placeholder: t("cwdPlaceholder") });
      state.formUrl = el("input", { id: "dm-f-url", placeholder: "https://mcp.context7.com/mcp" });
      state.formHeaders = el("textarea", { id: "dm-f-headers", placeholder: t("headersPlaceholder") });
      state.formEnabled = el("input", { id: "dm-f-enabled", type: "checkbox", checked: true });
      const grid = el("div", { class: "dm-form" });
      grid.appendChild(el("div", { class: "dm-field", children: [el("label", { text: t("nameLabel") }), state.formName] }));
      grid.appendChild(el("div", { class: "dm-field", children: [el("label", { text: t("ownershipLabel") }), state.formScope] }));
      grid.appendChild(el("div", { class: "dm-field", children: [el("label", { text: t("transportLabel") }), state.formTransport] }));
      grid.appendChild(el("div", { class: "dm-field dm-full", children: [el("label", { text: t("commandLabel") }), state.formCommand] }));
      grid.appendChild(el("div", { class: "dm-field dm-full", children: [el("label", { text: t("argsLabel") }), state.formArgs] }));
      grid.appendChild(el("div", { class: "dm-field dm-full", children: [el("label", { text: t("envLabel") }), state.formEnv] }));
      grid.appendChild(el("div", { class: "dm-field dm-full", children: [el("label", { text: t("cwdLabel") }), state.formCwd] }));
      grid.appendChild(el("div", { class: "dm-field dm-full", children: [el("label", { text: t("urlLabel") }), state.formUrl] }));
      grid.appendChild(el("div", { class: "dm-field dm-full", children: [el("label", { text: t("headersLabel") }), state.formHeaders] }));
      grid.appendChild(el("div", { class: "dm-check dm-field dm-full", children: [state.formEnabled, el("label", { text: t("enabledLabel") })] }));
      const actionsEl = el("div", { class: "dm-form-actions" });
      const save = el("button", { class: "dm-primary", text: t("save"), onclick: () => void saveForm(state, actions) });
      const cancel = el("button", { text: t("cancelEdit"), onclick: () => resetForm(state), disabled: true });
      cancel.dataset.dmCancel = "";
      actionsEl.appendChild(save);
      actionsEl.appendChild(cancel);
      grid.appendChild(actionsEl);
      form.appendChild(grid);
      page.appendChild(form);
      const syncTransport = () => {
        const isHttp = state.formTransport.value === "streamable-http";
        for (const field of [state.formCommand, state.formArgs, state.formEnv, state.formCwd]) {
          field.closest(".dm-field").style.display = isHttp ? "none" : "flex";
        }
        for (const field of [state.formUrl, state.formHeaders]) {
          field.closest(".dm-field").style.display = isHttp ? "flex" : "none";
        }
      };
      state.formTransport.addEventListener("change", syncTransport);
      const paste = el("section", { class: "dm-section" });
      paste.appendChild(el("h3", { text: t("pasteTitle") }));
      const pasteBox = el("div", { class: "dm-paste-box" });
      const textarea = el("textarea", {
        class: "dm-full",
        placeholder: '{"my-server":{"command":"npx","args":["-y","pkg"],"env":{"KEY":"value"}},"remote":{"url":"https://...","headers":{}}}',
        style: "width:100%;min-height:90px;border:1px solid #d7dae0;border-radius:6px;padding:6px 8px;font-size:12px;font-family:ui-monospace,Consolas,monospace;box-sizing:border-box"
      });
      pasteBox.appendChild(textarea);
      pasteBox.appendChild(el("div", { class: "dm-actions", children: [
        el("button", { class: "dm-primary", text: t("importJson"), onclick: async () => {
          const result = pasteBox.querySelector(".dm-result");
          try {
            const payload = await api(state.API.importJson, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ json: textarea.value, scope: formScopeValue(state), ...currentCwdBody(state) })
            });
            result.textContent = t("importedOk", { names: payload.imported.join(", ") || t("importedNone") });
            if (payload.skipped.length > 0) {
              result.appendChild(el("div", { class: "dm-skip", text: t("importSkipped", { names: payload.skipped.join(", ") }) }));
            }
            await actions.refresh();
          } catch (error) {
            result.textContent = t("importFail", { msg: error instanceof Error ? error.message : String(error) });
          }
        } })
      ] }));
      pasteBox.appendChild(el("div", { class: "dm-result" }));
      paste.appendChild(pasteBox);
      page.appendChild(paste);
      return page;
    }

    // src/client/float.ts
    function renderPill(state) {
      if (state.floatPill === void 0) return;
      const ok = state.counts.connected ?? 0;
      const bad = (state.counts.failed ?? 0) + (state.counts.reconnecting ?? 0);
      const dot = bad > 0 ? "var(--dsw-alias-state-error-primary,#e0483e)" : ok > 0 ? "var(--dsw-alias-state-success-primary,#0f9d6e)" : "var(--dsw-alias-label-tertiary,#9aa1ad)";
      const label = state.servers.length > 0 ? `MCP ${ok}/${state.servers.length}` : "MCP";
      state.floatPill.innerHTML = `<span class="dm-dot" style="background:${dot}"></span><span>${label}</span>`;
    }
    function toolCheckbox2(server, tool, disabled, state, actions) {
      const label = el("label", { class: "dm-float-tool" });
      const input = el("input", {
        type: "checkbox",
        checked: disabled,
        dataset: { dshMcpTool: tool }
      });
      input.addEventListener("change", () => {
        void api(state.API.toolDisable, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            server: `@${server.scope === "global" ? "@global" : state.projectRoot ?? ""}/${server.name}`,
            tool,
            disabled: input.checked
          })
        }).then(() => actions.refresh()).catch((error) => {
          input.checked = !input.checked;
          console.warn("[dsh-mcp-manager] tool-disable failed:", error);
        });
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(tool));
      return label;
    }
    function renderFloatTools(server, state, actions) {
      const tools = Array.isArray(server.tools) ? server.tools : [];
      const disabledSet = new Set(Array.isArray(server.disabledTools) ? server.disabledTools : []);
      const details = el("details", { class: "dm-float-tools" });
      details.appendChild(el("summary", { text: t("toolsCount", { n: tools.length }) }));
      const list = el("div", { class: "dm-float-tool-list" });
      for (const tool of tools) {
        list.appendChild(toolCheckbox2(server, tool, disabledSet.has(tool), state, actions));
      }
      details.appendChild(list);
      return details;
    }
    function renderFloatRow(server, state, actions, opts = { tools: true }) {
      const row = el("div", { class: "dm-float-row" });
      row.appendChild(el("span", { class: "dm-dot", style: `background:${statusDot(server.status)}` }));
      row.appendChild(el("span", { class: "dm-float-name", text: server.name, title: server.name }));
      const tools = Array.isArray(server.tools) ? server.tools.length : 0;
      row.appendChild(el("span", { class: "dm-float-meta", text: t("serverMeta", { status: STATUS_TEXT[server.status] !== void 0 ? t(STATUS_TEXT[server.status]) : server.status, tools }) }));
      const actionsEl = el("div", { class: "dm-float-actions" });
      const action = el("button", { class: "dm-float-action" });
      if (server.status === "connected") {
        action.textContent = t("disconnect");
        action.addEventListener("click", () => {
          void api(`${state.API.disconnect}?name=${encodeURIComponent(server.name)}&scope=${server.scope}`, { method: "POST" }).then(() => actions.refresh()).catch((error) => console.warn("[dsh-mcp-manager] disconnect failed:", error));
        });
      } else if (server.status === "disabled") {
        action.textContent = t("enable");
        action.addEventListener("click", () => {
          void api(`${state.API.servers}?name=${encodeURIComponent(server.name)}&scope=${server.scope}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: true })
          }).then(() => actions.refresh()).catch((error) => console.warn("[dsh-mcp-manager] enable failed:", error));
        });
      } else {
        action.textContent = t("connect");
        action.addEventListener("click", () => {
          void api(`${state.API.connect}?name=${encodeURIComponent(server.name)}&scope=${server.scope}`, { method: "POST" }).then(() => actions.refresh()).catch((error) => console.warn("[dsh-mcp-manager] connect failed:", error));
        });
      }
      actionsEl.appendChild(action);
      if (server.status !== "disabled") {
        const disable = el("button", { class: "dm-float-action" });
        disable.textContent = t("disable");
        disable.addEventListener("click", () => {
          void api(`${state.API.servers}?name=${encodeURIComponent(server.name)}&scope=${server.scope}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: false })
          }).then(() => actions.refresh()).catch((error) => console.warn("[dsh-mcp-manager] disable failed:", error));
        });
        actionsEl.appendChild(disable);
      }
      row.appendChild(actionsEl);
      if (opts.tools) row.appendChild(renderFloatTools(server, state, actions));
      return row;
    }
    function renderFloatPanel(state, actions) {
      if (state.floatPanel === void 0) return;
      state.floatPanel.textContent = "";
      const head = el("div", { class: "dm-float-head" });
      const projectName = typeof state.projectRoot === "string" && state.projectRoot !== "" ? state.projectRoot.split(/[\\/]/).filter(Boolean).pop() ?? state.projectRoot : t("floatGlobalSession");
      head.appendChild(el("span", { class: "dm-float-title", text: projectName }));
      head.appendChild(el("button", { text: t("floatManage"), onclick: () => {
        toggleFloat(state, actions, false);
        actions.showPanel();
      } }));
      state.floatPanel.appendChild(head);
      if (state.servers.length === 0) {
        state.floatPanel.appendChild(el("div", { class: "dm-status", text: t("floatEmpty") }));
        if (state.floatOpen) placePanel(state);
        return;
      }
      const isAll = state.middlewareMode === "all";
      const toolsEnabled = (scope) => scope === "project" || isAll;
      for (const scope of ["project", "global"]) {
        const list = state.servers.filter((server) => server.scope === scope);
        if (list.length === 0) continue;
        const section = el("section", { class: "dm-float-group" });
        section.appendChild(el("div", { class: "dm-float-group-title", text: scope === "project" ? t("groupProject") : t("groupGlobal") }));
        const byStatus = /* @__PURE__ */ new Map();
        for (const group of STATUS_ORDER) byStatus.set(group.key, []);
        for (const server of list) {
          const bucket = byStatus.get(server.status);
          if (bucket !== void 0) bucket.push(server);
          else if (byStatus.has("stopped")) byStatus.get("stopped").push(server);
        }
        for (const group of STATUS_ORDER) {
          const bucket = byStatus.get(group.key) ?? [];
          if (bucket.length === 0) continue;
          for (const server of [...bucket].sort((a, b) => a.name.localeCompare(b.name))) {
            section.appendChild(renderFloatRow(server, state, actions, { tools: toolsEnabled(scope) }));
          }
        }
        if (scope === "global" && !isAll) {
          section.appendChild(el("div", { class: "dm-float-hint", text: t("globalToolHint") }));
        }
        state.floatPanel.appendChild(section);
      }
      if (state.floatOpen) placePanel(state);
    }
    function toggleFloat(state, actions, force) {
      if (state.floatPanel === void 0) return;
      const next = force !== void 0 ? force : !state.floatOpen;
      state.floatOpen = next;
      state.floatPanel.hidden = !next;
      if (next) {
        renderFloatPanel(state, actions);
        placePanel(state);
        state.floatPanel.focus({ preventScroll: true });
      }
    }
    function placePanel(state) {
      if (state.floatPill === void 0 || state.floatPanel === void 0) return;
      const pillRect = state.floatPill.getBoundingClientRect();
      if (pillRect.width === 0 && pillRect.height === 0) return;
      const panel = state.floatPanel;
      const position = state.mcpUiConfig?.position;
      const anchorBottom = panelAnchorForPosition(position) === "bottom";
      const isLeft = position === "top-left" || position === "bottom-left";
      const gap = 6;
      const rawTop = anchorBottom ? Math.max(6, pillRect.top - panel.offsetHeight - gap) : Math.max(6, pillRect.bottom + gap);
      const rawLeft = isLeft ? Math.max(10, Math.round(pillRect.left)) : Math.max(10, Math.round(pillRect.right - panel.offsetWidth));
      const point = clampPointToViewport(
        rawLeft,
        rawTop,
        panel.offsetWidth,
        panel.offsetHeight,
        window.innerWidth,
        window.innerHeight
      );
      panel.style.left = `${Math.round(point.x)}px`;
      panel.style.top = `${Math.round(point.y)}px`;
      panel.style.right = "auto";
    }
    function conversationHost() {
      return document.querySelector("[data-conversation-scroll]") ?? document.querySelector('[data-pane="conversation"]') ?? document.querySelector(".pI_x6G_centerCol") ?? document.body;
    }
    function panelHost() {
      return document.querySelector("[data-shell-overlay]") ?? document.body;
    }
    function floatTopOffset(ctx, state) {
      const snap = ctx?.sessions?.list?.getSnapshot?.();
      const current = snap?.current;
      const session = current === void 0 ? void 0 : snap?.byId?.[current];
      const blank = session?.blank === true;
      const cfg = state.mcpUiConfig || {};
      const y = typeof cfg.offsetY === "number" ? cfg.offsetY : 8;
      const blankY = typeof cfg.blankY === "number" ? cfg.blankY : y;
      return blank ? blankY : y;
    }
    function mountFloat(ctx, state, actions) {
      const pill = el("button", {
        type: "button",
        class: "dm-float",
        "aria-label": t("floatAriaLabel"),
        title: t("floatTitle")
      });
      pill.dataset.dshMcpFloat = "";
      pill.addEventListener("click", () => toggleFloat(state, actions));
      const panel = el("div", { class: "dm-float-panel" });
      panel.hidden = true;
      panel.tabIndex = -1;
      state.floatPill = pill;
      state.floatPanel = panel;
      const panelRoot = panelHost();
      if (panel.parentElement !== panelRoot) panelRoot.appendChild(panel);
      const onFocusOut = (event) => {
        if (!state.floatOpen) return;
        const next = event.relatedTarget;
        if (next !== null && (state.floatPanel?.contains(next) || state.floatPill?.contains(next))) return;
        toggleFloat(state, actions, false);
      };
      document.addEventListener("focusout", onFocusOut);
      let host;
      const updateFloat = () => {
        const best = conversationHost();
        if (best === null || best === void 0) return;
        const rect = best.getBoundingClientRect();
        const cfg = state.mcpUiConfig || {};
        const position = ["top-left", "bottom-right", "bottom-left"].includes(cfg.position) ? cfg.position : "top-right";
        const bp = breakpointForWidth(rect.width);
        if (pill.dataset.dmBp !== bp) pill.dataset.dmBp = bp;
        if (panel.dataset.dmBp !== bp) panel.dataset.dmBp = bp;
        const zBase = clampZIndexBase(cfg.zIndexBase, DEFAULT_Z_INDEX_BASE);
        pill.style.zIndex = String(zBase);
        panel.style.zIndex = String(zBase);
        const isBottom = position === "bottom-right" || position === "bottom-left";
        const isLeft = position === "top-left" || position === "bottom-left";
        const offsetX = typeof cfg.offsetX === "number" ? cfg.offsetX : 8;
        const y = floatTopOffset(ctx, state);
        pill.style.position = "fixed";
        const rawLeft = isLeft ? rect.left + offsetX : rect.right - pill.offsetWidth - offsetX;
        let bottomEdge = rect.bottom;
        if (isBottom && bp !== "wide") {
          const seat = document.querySelector("[data-composer-seat]");
          const seatRect = seat !== null ? seat.getBoundingClientRect() : null;
          bottomEdge = bottomAnchorEdge(rect.bottom, seatRect?.top ?? null, composerDockedAtBottom(seatRect, rect));
        }
        const rawTop = isBottom ? Math.max(6, bottomEdge - pill.offsetHeight - y) : rect.top + y;
        const point = clampPointToViewport(
          rawLeft,
          rawTop,
          pill.offsetWidth,
          pill.offsetHeight,
          window.innerWidth,
          window.innerHeight
        );
        pill.style.left = `${Math.round(point.x)}px`;
        pill.style.top = `${Math.round(point.y)}px`;
        pill.style.right = "auto";
        if (state.floatOpen) placePanel(state);
      };
      state.updateFloatState = updateFloat;
      let listeners = [];
      let rafId = 0;
      const scheduleUpdate = () => {
        if (rafId !== 0) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          updateFloat();
        });
      };
      const onOrientationChange = () => {
        scheduleUpdate();
      };
      const onVisualViewportResize = () => {
        scheduleUpdate();
      };
      const attachListeners = (target) => {
        for (const detach of listeners.splice(0)) detach();
        target.addEventListener("scroll", scheduleUpdate, { passive: true });
        window.addEventListener("resize", scheduleUpdate);
        window.addEventListener("orientationchange", onOrientationChange);
        window.visualViewport?.addEventListener("resize", onVisualViewportResize);
        listeners.push(() => {
          target.removeEventListener("scroll", scheduleUpdate);
          window.removeEventListener("resize", scheduleUpdate);
          window.removeEventListener("orientationchange", onOrientationChange);
          window.visualViewport?.removeEventListener("resize", onVisualViewportResize);
        });
        updateFloat();
      };
      const place = () => {
        const best = conversationHost();
        if (best === null || best === void 0) return false;
        if (host !== best || pill.parentElement !== best) {
          host = best;
          if (pill.parentElement !== null) pill.remove();
          best.appendChild(pill);
          attachListeners(best);
        }
        return true;
      };
      let observerRafId = 0;
      const schedulePlace = () => {
        if (observerRafId !== 0) return;
        observerRafId = requestAnimationFrame(() => {
          observerRafId = 0;
          place();
        });
      };
      const observer = new MutationObserver(schedulePlace);
      if (place()) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        const wait = new MutationObserver(() => {
          if (place()) {
            wait.disconnect();
            observer.observe(document.body, { childList: true, subtree: true });
          }
        });
        wait.observe(document.body, { childList: true, subtree: true });
      }
      renderPill(state);
      return () => {
        state.updateFloatState = void 0;
        document.removeEventListener("focusout", onFocusOut);
        observer.disconnect();
        for (const detach of listeners.splice(0)) detach();
        if (rafId !== 0) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        if (observerRafId !== 0) {
          cancelAnimationFrame(observerRafId);
          observerRafId = 0;
        }
        pill.remove();
        panel.remove();
        state.floatPill = void 0;
        state.floatPanel = void 0;
        state.floatOpen = false;
      };
    }

    // src/client/panel.ts
    var inflight;
    function refresh(state, actions) {
      if (inflight !== void 0) return inflight;
      inflight = doRefresh(state, actions).finally(() => {
        inflight = void 0;
      });
      return inflight;
    }
    async function doRefresh(state, actions) {
      try {
        const payload = await api(state.API.servers);
        state.servers = payload.servers ?? [];
        state.counts = payload.counts ?? {};
        state.projectRoot = payload.projectRoot;
        if (typeof payload.middlewareMode === "string") state.middlewareMode = payload.middlewareMode;
        renderPill(state);
        if (state.floatOpen) renderFloatPanel(state, actions);
        const countsEl = document.querySelector(".dm-counts");
        if (countsEl !== null) {
          const parts = [];
          if (state.counts.connected > 0) parts.push(t("countsConnected", { n: state.counts.connected }));
          if (state.counts.connecting > 0 || state.counts.reconnecting > 0) parts.push(t("countsConnecting", { n: (state.counts.connecting ?? 0) + (state.counts.reconnecting ?? 0) }));
          if (state.counts.failed > 0) parts.push(t("countsFailed", { n: state.counts.failed }));
          countsEl.textContent = parts.length > 0 ? t("countsSummary", { n: state.servers.length, parts: parts.join(" · ") }) : t("countsSummaryOnly", { n: state.servers.length });
        }
        if (state.bodyEl !== void 0 && state.activeTab === "servers") renderServers(state, actions);
        return true;
      } catch (error) {
        if (state.bodyEl !== void 0 && state.activeTab === "servers") {
          state.bodyEl.textContent = "";
          state.bodyEl.appendChild(el("div", { class: "dm-status", text: t("loadFail", { msg: error instanceof Error ? error.message : String(error) }) }));
        }
        return false;
      }
    }
    function switchTab(state, actions, tab) {
      state.activeTab = tab;
      for (const tabEl of document.querySelectorAll(".dm-tab")) {
        tabEl.dataset.active = tabEl.dataset.tab === tab ? "true" : "";
      }
      if (state.bodyEl === void 0) return;
      state.bodyEl.textContent = "";
      if (tab === "servers") {
        if (state.servers.length === 0) void refresh(state, actions);
        else renderServers(state, actions);
      } else {
        const page = buildQuickAdd(state, actions);
        state.bodyEl.appendChild(page);
      }
    }
    function close(state) {
      if (state.overlay === void 0) return;
      state.open = false;
      state.overlay.hidden = true;
    }
    function showPanel(state, actions) {
      if (state.overlay === void 0) {
        state.overlay = el("div", { class: "dm-overlay", hidden: true });
        state.overlay.addEventListener("click", (event) => {
          if (event.target === state.overlay) close(state);
        });
        state.card = el("div", { class: "dm-card" });
        const head = el("div", { class: "dm-head" });
        head.appendChild(el("h2", { text: t("panelTitle") }));
        head.appendChild(el("span", { class: "dm-counts", text: "" }));
        head.appendChild(el("button", { text: t("refresh"), onclick: () => void refresh(state, actions) }));
        head.appendChild(el("button", { text: t("close"), onclick: () => close(state) }));
        state.card.appendChild(head);
        const tabs = el("div", { class: "dm-tabs" });
        tabs.appendChild(el("button", { class: "dm-tab", dataset: { tab: "servers" }, text: t("tabServers"), onclick: () => switchTab(state, actions, "servers") }));
        tabs.appendChild(el("button", { class: "dm-tab", dataset: { tab: "quick" }, text: t("tabQuickAdd"), onclick: () => switchTab(state, actions, "quick") }));
        state.card.appendChild(tabs);
        state.bodyEl = el("div", { class: "dm-body" });
        state.card.appendChild(state.bodyEl);
        state.overlay.appendChild(state.card);
        document.body.appendChild(state.overlay);
        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && state.open) close(state);
        });
      }
      state.open = true;
      state.overlay.hidden = false;
      switchTab(state, actions, "servers");
    }

    // src/client/session.ts
    function bindSession(ctx, state, actions) {
      const list = ctx.sessions?.list;
      if (list === void 0 || typeof list.getSnapshot !== "function") return () => {
      };
      const sync = () => {
        let cwd;
        try {
          const snapshot = list.getSnapshot();
          const sessionId = snapshot?.current;
          cwd = sessionId === void 0 ? void 0 : snapshot?.byId?.[sessionId]?.cwd;
        } catch {
          cwd = void 0;
        }
        const prevCwd = state.currentCwd;
        state.currentCwd = cwd;
        state.updateFloatState?.();
        if (cwd === prevCwd) return;
        void api(state.API.session, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cwd: typeof cwd === "string" ? cwd : "" })
        }).then(() => actions.refresh()).catch(() => {
        });
      };
      sync();
      if (typeof list.subscribe === "function") return list.subscribe(sync);
      return () => {
      };
    }

    // src/client/settings-card.ts
    var React = __toESM(require("react"), 1);
    function SettingsCard() {
      const useState2 = React.useState;
      const useEffect2 = React.useEffect;
      const [cfg, setCfg] = useState2(null);
      const [middleware, setMiddleware] = useState2("project");
      const [open, setOpen] = useState2(false);
      const [saving, setSaving] = useState2(false);
      const [msg, setMsg] = useState2(null);
      useEffect2(() => {
        let live = true;
        api(API.config).then((c) => {
          if (live && c !== null && typeof c === "object") {
            setCfg(c);
            if (typeof c.middleware === "string") setMiddleware(c.middleware);
          }
        }).catch(() => {
        });
        return () => {
          live = false;
        };
      }, []);
      if (cfg === null) {
        return React.createElement("li", { className: "dm-set-card" }, t("settingsLoading"));
      }
      const set = (patch) => setCfg((c) => c !== null ? Object.assign({}, c, patch) : c);
      const numInput = (key, label, min = 0, max = 2e3) => React.createElement(
        "label",
        { className: "dm-set-field" },
        label,
        React.createElement("input", {
          className: "dm-set-input",
          type: "number",
          min,
          max,
          value: String(cfg[key]),
          onChange: (e) => {
            const v = Number(e.target.value);
            set({ [key]: Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : min });
          }
        })
      );
      const save = async () => {
        setSaving(true);
        setMsg(null);
        try {
          const payload = { ...cfg };
          if (middleware !== (cfg.middleware ?? "project")) payload.middleware = middleware;
          await api(API.config, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload)
          });
          setMsg({ ok: true, text: t("settingsSavedOk") });
          setTimeout(() => setMsg(null), 2400);
        } catch (e) {
          setMsg({ ok: false, text: t("saveFail", { msg: e instanceof Error ? e.message : String(e) }) });
        }
        setSaving(false);
      };
      return React.createElement(
        "li",
        { className: "dm-set-card" + (open ? " dm-set-cardOpen" : "") },
        React.createElement(
          "button",
          {
            type: "button",
            className: "dm-set-head",
            "aria-expanded": open,
            onClick: () => setOpen(!open)
          },
          React.createElement(
            "span",
            { className: "dm-set-headText" },
            React.createElement("span", { className: "dm-set-name" }, t("settingsName")),
            React.createElement("span", { className: "dm-set-description" }, t("settingsDescription"))
          ),
          React.createElement(
            "svg",
            {
              className: "dm-set-chevron" + (open ? " dm-set-chevronOpen" : ""),
              width: 14,
              height: 14,
              viewBox: "0 0 14 14",
              fill: "none",
              xmlns: "http://www.w3.org/2000/svg",
              "aria-hidden": "true"
            },
            React.createElement("path", {
              d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
              fill: "currentColor"
            })
          )
        ),
        open ? React.createElement(
          "div",
          { className: "dm-set-body" },
          React.createElement(
            "div",
            { className: "dm-set-row" },
            React.createElement("label", { htmlFor: "dm-set-position" }, t("anchorLabel")),
            React.createElement(
              "select",
              {
                id: "dm-set-position",
                className: "dm-set-input",
                value: cfg.position,
                onChange: (e) => set({ position: e.target.value })
              },
              React.createElement("option", { value: "top-right" }, t("posTopRight")),
              React.createElement("option", { value: "top-left" }, t("posTopLeft")),
              React.createElement("option", { value: "bottom-right" }, t("posBottomRight")),
              React.createElement("option", { value: "bottom-left" }, t("posBottomLeft"))
            )
          ),
          React.createElement(
            "div",
            { className: "dm-set-row" },
            React.createElement("label", { htmlFor: "dm-set-middleware" }, t("modeLabel")),
            React.createElement(
              "select",
              {
                id: "dm-set-middleware",
                className: "dm-set-input",
                value: middleware,
                onChange: (e) => setMiddleware(e.target.value)
              },
              React.createElement("option", { value: "project" }, t("modeProject")),
              React.createElement("option", { value: "all" }, t("modeAll")),
              React.createElement("option", { value: "off" }, t("modeOff"))
            )
          ),
          React.createElement(
            "div",
            { className: "dm-set-row" },
            numInput("offsetX", t("offsetX")),
            numInput("offsetY", t("offsetY")),
            numInput("blankY", t("blankY")),
            numInput("zIndexBase", t("zIndexBase"), 1, 9e3)
          ),
          React.createElement(
            "div",
            { className: "dm-set-hint" },
            t("settingsHint")
          ),
          React.createElement(
            "div",
            { className: "dm-set-foot" },
            msg !== null ? React.createElement("span", { className: msg.ok ? "dm-set-saved" : "dm-set-error" }, msg.text) : null,
            React.createElement("button", {
              type: "button",
              className: "dm-set-save",
              disabled: saving,
              onClick: () => {
                void save();
              }
            }, saving ? t("savingNow") : t("save"))
          )
        ) : null
      );
    }

    // src/client/locales.ts
    var zh = {
      // 状态（constants.ts 状态表共用）
      stConnected: "运行中",
      stConnecting: "连接中",
      stReconnecting: "重连中",
      stStopped: "未连接",
      stDisabled: "已停用",
      stFailed: "失败",
      // 通用操作
      connect: "连接",
      disconnect: "断开",
      reconnect: "重连",
      enable: "启用",
      enableAndConnect: "启用并连接",
      disable: "禁用",
      edit: "编辑",
      delete: "删除",
      save: "保存",
      cancel: "取消",
      refresh: "刷新",
      close: "关闭",
      cancelEdit: "取消编辑",
      saveFail: "保存失败：{msg}",
      actionFail: "操作失败：{msg}",
      loadFail: "加载失败：{msg}",
      // 浮窗
      floatAriaLabel: "MCP 管理器",
      floatTitle: "MCP 管理器（点击展开）",
      floatManage: "管理",
      floatEmpty: "没有 MCP 服务器，点「管理」添加",
      floatGlobalSession: "全局会话",
      groupProject: "项目级",
      groupGlobal: "全局",
      badgeScopeProject: "项目",
      badgeScopeGlobal: "全局",
      globalToolHint: "全局工具开关需在 all 模式（中间层全量接管）下管理——切 all 模式可管理全局工具",
      serverMeta: "{status} · {tools} 工具",
      toolsCount: "工具（{n}）",
      toolsCountPlain: "{n} 工具",
      statusGroupCount: "{status}（{n}）",
      // 模态面板
      panelTitle: "MCP 管理器",
      tabServers: "服务器",
      tabQuickAdd: "快速接入",
      countsConnected: "运行中 {n}",
      countsConnecting: "连接中 {n}",
      countsFailed: "失败 {n}",
      countsSummary: "共 {n} 台 · {parts}",
      countsSummaryOnly: "共 {n} 台",
      // 快速接入表单
      addServer: "添加服务器",
      editServer: "编辑服务器：{name}",
      nameLabel: "服务器名称（唯一，作为 mcp__<name>__ 前缀）",
      ownershipLabel: "归属",
      transportLabel: "传输类型",
      commandLabel: "命令（stdio）",
      argsLabel: "参数（逗号分隔）",
      envLabel: "环境变量（每行 KEY=VALUE，支持 ${ENV} 引用，值为空则继承父环境）",
      cwdLabel: "工作目录（可选）",
      urlLabel: "URL（streamable-http）",
      headersLabel: "请求头（每行 KEY: VALUE，支持 ${ENV} 引用）",
      enabledLabel: "启用（保存后立即连接）",
      scopeProjectOpt: "项目级（<项目>/.dsh/mcp.json，随会话切换）",
      scopeGlobalOpt: "全局（~/.dsh/dsh-mcp.json）",
      transportStdioOpt: "stdio（本地子进程）",
      transportHttpOpt: "streamable-http（远程）",
      envPlaceholder: "每行 KEY=VALUE，如\nCONTEXT7_API_KEY=${CONTEXT7_API_KEY}",
      headersPlaceholder: "每行 KEY: VALUE，支持 ${ENV} 引用，如\nAuthorization: Bearer ${CONTEXT7_API_KEY}",
      cwdPlaceholder: "可选工作目录",
      pasteTitle: "粘贴 mcpServers JSON 导入",
      importJson: "导入 JSON",
      importedOk: "已导入：{names}",
      importedNone: "（无）",
      importSkipped: "跳过（已存在）：{names}",
      importFail: "导入失败：{msg}",
      // 服务器列表页
      serversEmpty: "还没有配置 MCP 服务器。切到「快速接入」页添加，或粘贴 mcpServers JSON 导入。",
      confirmDelete: "删除 MCP 服务器「{name}」？",
      // 设置卡
      settingsLoading: "MCP 管理器：加载中…",
      settingsName: "MCP 管理器（dsh-mcp-manager）",
      settingsDescription: "浮窗位置 / 水平·垂直·空白偏移",
      anchorLabel: "锚点",
      posTopRight: "右上（top-right）",
      posTopLeft: "左上（top-left）",
      posBottomRight: "右下（bottom-right）",
      posBottomLeft: "左下（bottom-left）",
      modeLabel: "中间层模式",
      modeProject: "project（项目级走中间层，推荐）",
      modeAll: "all（全局也走中间层）",
      modeOff: "off（全部直呼 mcp__ 工具）",
      offsetX: "水平偏移",
      offsetY: "垂直偏移",
      blankY: "空白偏移",
      zIndexBase: "层级基准",
      settingsHint: "保存即热更新：浮窗位置即时生效；中间层模式切换即时生效并持久化（无需重启 dsh web）。",
      savingNow: "保存中…",
      settingsSavedOk: "已保存——浮窗位置与中间层模式即时生效（无需重启）"
    };
    var en = {
      stConnected: "Running",
      stConnecting: "Connecting",
      stReconnecting: "Reconnecting",
      stStopped: "Disconnected",
      stDisabled: "Disabled",
      stFailed: "Failed",
      connect: "Connect",
      disconnect: "Disconnect",
      reconnect: "Reconnect",
      enable: "Enable",
      enableAndConnect: "Enable & connect",
      disable: "Disable",
      edit: "Edit",
      delete: "Delete",
      save: "Save",
      cancel: "Cancel",
      refresh: "Refresh",
      close: "Close",
      cancelEdit: "Cancel edit",
      saveFail: "Save failed: {msg}",
      actionFail: "Operation failed: {msg}",
      loadFail: "Load failed: {msg}",
      floatAriaLabel: "MCP manager",
      floatTitle: "MCP manager (click to expand)",
      floatManage: "Manage",
      floatEmpty: 'No MCP servers — click "Manage" to add',
      floatGlobalSession: "global session",
      groupProject: "Project",
      groupGlobal: "Global",
      badgeScopeProject: "Project",
      badgeScopeGlobal: "Global",
      globalToolHint: "Global tool switches are managed in all mode (middleware takes over everything) — switch to all mode to manage global tools",
      serverMeta: "{status} · {tools} tools",
      toolsCount: "Tools ({n})",
      toolsCountPlain: "{n} tools",
      statusGroupCount: "{status} ({n})",
      panelTitle: "MCP manager",
      tabServers: "Servers",
      tabQuickAdd: "Quick add",
      countsConnected: "running {n}",
      countsConnecting: "connecting {n}",
      countsFailed: "failed {n}",
      countsSummary: "{n} total · {parts}",
      countsSummaryOnly: "{n} total",
      addServer: "Add server",
      editServer: "Edit server: {name}",
      nameLabel: "Server name (unique, used as the mcp__<name>__ prefix)",
      ownershipLabel: "Scope",
      transportLabel: "Transport",
      commandLabel: "Command (stdio)",
      argsLabel: "Args (comma-separated)",
      envLabel: "Env vars (KEY=VALUE per line, ${ENV} refs supported; empty value inherits the parent environment)",
      cwdLabel: "Working directory (optional)",
      urlLabel: "URL (streamable-http)",
      headersLabel: "Headers (KEY: VALUE per line, ${ENV} refs supported)",
      enabledLabel: "Enabled (connects immediately after saving)",
      scopeProjectOpt: "Project (<project>/.dsh/mcp.json, follows the session)",
      scopeGlobalOpt: "Global (~/.dsh/dsh-mcp.json)",
      transportStdioOpt: "stdio (local subprocess)",
      transportHttpOpt: "streamable-http (remote)",
      envPlaceholder: "One KEY=VALUE per line, e.g.\nCONTEXT7_API_KEY=${CONTEXT7_API_KEY}",
      headersPlaceholder: "One KEY: VALUE per line, ${ENV} refs supported, e.g.\nAuthorization: Bearer ${CONTEXT7_API_KEY}",
      cwdPlaceholder: "Optional working directory",
      pasteTitle: "Paste mcpServers JSON to import",
      importJson: "Import JSON",
      importedOk: "Imported: {names}",
      importedNone: "(none)",
      importSkipped: "Skipped (already present): {names}",
      importFail: "Import failed: {msg}",
      serversEmpty: 'No MCP servers yet. Add one on the "Quick add" tab, or paste mcpServers JSON to import.',
      confirmDelete: 'Delete MCP server "{name}"?',
      settingsLoading: "MCP manager: loading…",
      settingsName: "MCP manager (dsh-mcp-manager)",
      settingsDescription: "Float placement / horizontal·vertical·gap offsets",
      anchorLabel: "Anchor",
      posTopRight: "Top right (top-right)",
      posTopLeft: "Top left (top-left)",
      posBottomRight: "Bottom right (bottom-right)",
      posBottomLeft: "Bottom left (bottom-left)",
      modeLabel: "Middleware mode",
      modeProject: "project (project-level via middleware, recommended)",
      modeAll: "all (global also via middleware)",
      modeOff: "off (call mcp__ tools directly)",
      offsetX: "Horizontal offset",
      offsetY: "Vertical offset",
      blankY: "Blank-session offset",
      zIndexBase: "Z-index base",
      settingsHint: "Hot reload on save: float placement applies immediately; middleware mode applies immediately and persists (no dsh web restart).",
      savingNow: "Saving…",
      settingsSavedOk: "Saved — float placement and middleware mode take effect immediately (no restart)"
    };

    // src/client/index.ts
    var NS = "mcpManager";
    function apply(ctx) {
      const state = createState();
      const actions = {
        refresh: () => refresh(state, actions),
        switchTab: (tab) => switchTab(state, actions, tab),
        close: () => close(state),
        showPanel: () => showPanel(state, actions),
        toggleFloat: (force) => toggleFloat(state, actions, force),
        resetForm: () => resetForm(state),
        beginEdit: (server) => beginEdit(state, actions, server)
      };
      try {
        const locale = ctx.get("locale");
        if (locale && typeof locale.register === "function") {
          try {
            locale.register(NS, { zh, en });
            bindLocale(locale, NS);
            if (typeof locale.subscribe === "function" && typeof locale.getSnapshot === "function") {
              locale.subscribe(function() {
                bindLocale(locale, NS);
              });
            }
          } catch (error) {
            console.warn("[dsh-mcp-manager] locale registration failed: ", error);
          }
        }
        if (document.querySelector("style[data-dsh-mcp-manager-style]") === null) {
          const style = document.createElement("style");
          style.dataset.dshMcpManagerStyle = "";
          style.textContent = style_default;
          document.head.appendChild(style);
        }
        const disposers = [];
        const slots = ctx.get("slots");
        if (slots && typeof slots.inject === "function") {
          slots.inject("settings.plugin.item", () => slots.register(
            { name: "settings.plugin.item", id: "dsh-mcp-manager", key: "dsh-mcp-manager", order: 60, locale: NS },
            () => React2.createElement(SettingsCard, null)
          ));
        }
        disposers.push(mountFloat(ctx, state, actions));
        disposers.push(bindSession(ctx, state, actions));
        api(state.API.config).then((cfg) => {
          if (cfg !== null && typeof cfg === "object") state.mcpUiConfig = cfg;
          state.updateFloatState?.();
        }).catch(() => {
        });
        let retryTimer = void 0;
        const attemptRefresh = (attempt) => {
          refresh(state, actions).then((ok) => {
            if (!ok && attempt < 3) {
              retryTimer = setTimeout(() => attemptRefresh(attempt + 1), 500 * 2 ** attempt);
            }
          }).catch((error) => {
            console.warn("[dsh-mcp-manager] initial render failed: ", error);
          });
        };
        attemptRefresh(0);
        let es = void 0;
        let refreshTimer = void 0;
        let esFailures = 0;
        let pollTimer = void 0;
        const WATCHDOG_MS = 6e4;
        let lastActivity = 0;
        let lastReconnectAt = 0;
        let watchdog = void 0;
        let eventsRetired = false;
        const scheduleRefresh = () => {
          if (refreshTimer !== void 0) return;
          refreshTimer = setTimeout(() => {
            refreshTimer = void 0;
            void refresh(state, actions).catch(() => {
            });
          }, 500);
        };
        const startPolling = () => {
          eventsRetired = true;
          if (watchdog !== void 0) {
            clearTimeout(watchdog);
            watchdog = void 0;
          }
          if (pollTimer !== void 0) return;
          const tick = () => {
            pollTimer = setTimeout(() => {
              void refresh(state, actions).catch(() => {
              });
              tick();
            }, 1e4);
          };
          tick();
        };
        const closeEvents = () => {
          if (es === void 0) return;
          try {
            es.close();
          } catch (error) {
            console.warn("[dsh-mcp-manager] failed to close old SSE connection: ", error);
          }
          es = void 0;
        };
        const armWatchdog = () => {
          if (watchdog !== void 0) clearTimeout(watchdog);
          watchdog = setTimeout(() => {
            if (Date.now() - lastActivity > WATCHDOG_MS) {
              forceReconnect();
            } else {
              armWatchdog();
            }
          }, WATCHDOG_MS + 5e3);
        };
        const connectEvents = () => {
          closeEvents();
          try {
            es = new EventSource(state.API.events);
            lastActivity = Date.now();
            es.onmessage = (ev) => {
              lastActivity = Date.now();
              let msg;
              try {
                msg = JSON.parse(String(ev.data));
              } catch {
                msg = void 0;
              }
              if (msg?.type === "ping") return;
              if (msg !== void 0 && msg.type === "ui-config-changed") {
                void api(state.API.config).then((cfg) => {
                  if (cfg !== null && typeof cfg === "object") {
                    state.mcpUiConfig = cfg;
                    if (typeof cfg.middleware === "string") state.middlewareMode = cfg.middleware;
                  }
                  state.updateFloatState?.();
                  if (state.floatOpen) renderFloatPanel(state, actions);
                }).catch(() => {
                });
              } else {
                scheduleRefresh();
              }
            };
            es.onerror = () => {
              if (es !== void 0 && es.readyState === EventSource.CLOSED) {
                esFailures += 1;
                if (esFailures >= 3) {
                  closeEvents();
                  startPolling();
                }
              }
            };
            armWatchdog();
          } catch {
            startPolling();
          }
        };
        const forceReconnect = () => {
          if (eventsRetired) return;
          const now = Date.now();
          if (now - lastReconnectAt < 5e3) return;
          lastReconnectAt = now;
          connectEvents();
        };
        connectEvents();
        const onVisible = () => {
          if (!document.hidden) {
            forceReconnect();
            void refresh(state, actions).catch(() => {
            });
          }
        };
        document.addEventListener("visibilitychange", onVisible);
        ctx.effect(() => () => {
          clearTimeout(retryTimer);
          if (refreshTimer !== void 0) clearTimeout(refreshTimer);
          if (pollTimer !== void 0) clearTimeout(pollTimer);
          if (watchdog !== void 0) clearTimeout(watchdog);
          closeEvents();
          document.removeEventListener("visibilitychange", onVisible);
          for (const dispose of disposers.splice(0)) dispose();
          if (state.overlay !== void 0 && state.overlay.parentElement !== null) state.overlay.remove();
          const savedUiConfig = state.mcpUiConfig;
          Object.assign(state, createState());
          state.mcpUiConfig = savedUiConfig;
        }, "dsh-mcp-manager: ui");
      } catch (error) {
        console.warn("[dsh-mcp-manager] mount failed:", error);
      }
    }
    var inject = ["sessions", "slots", "locale"];

    Object.defineProperty(module.exports, Symbol.toStringTag, { value: 'Module' })
    return module.exports
  }
})
