window.__ModuleLoader__.load({
  id: "dsh-headroom",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/HeadroomCard.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/section-model.ts
var EMPTY_HEADROOM_SECTION = Object.freeze({
  enabled: true,
  baseUrl: null,
  mode: "normal"
});
var MODES = ["normal", "quiet", "silent"];
function decodeHeadroomSection(section) {
  if (typeof section !== "object" || section === null || Array.isArray(section)) return void 0;
  const value = section;
  const mode = MODES.includes(value.mode) ? value.mode : EMPTY_HEADROOM_SECTION.mode;
  return {
    enabled: value.enabled !== false,
    baseUrl: typeof value.baseUrl === "string" && value.baseUrl.trim() !== "" ? value.baseUrl.trim() : null,
    mode
  };
}

// src/client/HeadroomCard.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var MODE_OPTIONS = [
  { value: "normal", label: "Normal \u2014 all output" },
  { value: "quiet", label: "Quiet \u2014 suppress routine success" },
  { value: "silent", label: "Silent \u2014 non-critical only" }
];
var CARD = {
  listStyle: "none",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 12,
  background: "var(--dsw-alias-bg-layer-3)",
  overflow: "hidden"
};
var HEADER = {
  width: "100%",
  appearance: "none",
  border: 0,
  background: "none",
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px"
};
var NAME = {
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.4,
  color: "var(--dsw-alias-label-primary)"
};
var DESCRIPTION = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--dsw-alias-label-tertiary)"
};
var PENDING = {
  flex: "none",
  borderRadius: 999,
  padding: "1px 8px",
  fontSize: 11,
  lineHeight: "17px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  background: "var(--dsw-alias-bg-module-platform)",
  color: "var(--dsw-alias-label-secondary)"
};
var BODY = {
  borderTop: "1px solid var(--dsw-alias-border-l2)",
  margin: "0 16px",
  padding: "12px 0 8px"
};
var FIELD = {
  marginBottom: 14,
  display: "flex",
  flexDirection: "column",
  gap: 4
};
var FIELD_HEAD = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
};
var LABEL = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--dsw-alias-label-primary)"
};
var HINT = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: "var(--dsw-alias-label-tertiary)"
};
var INPUT = {
  font: "inherit",
  fontSize: 13,
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-layer-3)",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  padding: "6px 10px",
  width: "100%",
  boxSizing: "border-box"
};
var BADGE = {
  borderRadius: 999,
  padding: "1px 8px",
  fontSize: 11,
  lineHeight: "17px",
  fontWeight: 500,
  whiteSpace: "nowrap",
  background: "var(--dsw-alias-bg-module-platform)",
  color: "var(--dsw-alias-label-secondary)"
};
var RESET = {
  appearance: "none",
  border: 0,
  background: "none",
  font: "inherit",
  fontSize: 12,
  color: "var(--dsw-alias-label-secondary)",
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline"
};
var FOOTER = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  padding: "12px 0 4px",
  borderTop: "1px solid var(--dsw-alias-border-l2)"
};
var DISCARD = {
  appearance: "none",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  padding: "5px 14px",
  font: "inherit",
  fontSize: 13,
  lineHeight: 1.5,
  cursor: "pointer",
  background: "none",
  color: "var(--dsw-alias-label-secondary)"
};
var SAVE = {
  ...DISCARD,
  borderColor: "transparent",
  background: "var(--dsw-alias-label-primary)",
  color: "var(--dsw-alias-bg-layer-3)"
};
var DISABLED = { opacity: 0.4, cursor: "default" };
function HeadroomCard({ scope }) {
  const snapshot = (0, import_react.useSyncExternalStore)(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot()
  );
  const value = snapshot.value ?? EMPTY_HEADROOM_SECTION;
  const available = snapshot.status === "ready";
  const writable = snapshot.writable;
  const user = typeof snapshot.user === "object" && snapshot.user !== null && !Array.isArray(snapshot.user) ? snapshot.user : {};
  const [open, setOpen] = (0, import_react.useState)(false);
  const [enabled, setEnabled] = (0, import_react.useState)(value.enabled);
  const [baseUrl, setBaseUrl] = (0, import_react.useState)(value.baseUrl ?? "");
  const [mode, setMode] = (0, import_react.useState)(value.mode);
  const [saving, setSaving] = (0, import_react.useState)(false);
  const [failed, setFailed] = (0, import_react.useState)(false);
  const dirty = enabled !== value.enabled || baseUrl !== (value.baseUrl ?? "") || mode !== value.mode;
  (0, import_react.useEffect)(() => {
    if (dirty) return;
    setEnabled(value.enabled);
    setBaseUrl(value.baseUrl ?? "");
    setMode(value.mode);
  }, [value, dirty]);
  if (!available) return null;
  const save = () => {
    setSaving(true);
    setFailed(false);
    const writes = [];
    if (enabled !== value.enabled) writes.push(scope.set("enabled", enabled));
    if (baseUrl !== (value.baseUrl ?? "")) {
      writes.push(scope.set("baseUrl", baseUrl.trim() === "" ? null : baseUrl.trim()));
    }
    if (mode !== value.mode) writes.push(scope.set("mode", mode));
    void Promise.all(writes).then(
      () => {
        setSaving(false);
      },
      () => {
        setSaving(false);
        setFailed(true);
      }
    );
  };
  const overridden = (field2) => field2 in user;
  const field = (id, label, hint, fieldName, control) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: FIELD, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: FIELD_HEAD, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: LABEL, htmlFor: id, children: label }),
      overridden(fieldName) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: BADGE, children: "Overridden" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: RESET,
            disabled: !writable,
            onClick: () => {
              void scope.unset(fieldName);
            },
            children: "Reset"
          }
        )
      ] })
    ] }),
    control,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: HINT, children: hint })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { style: { ...CARD, background: open ? "var(--dsw-alias-bg-layer-2)" : CARD.background }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        style: HEADER,
        "aria-expanded": open,
        onClick: () => {
          setOpen(!open);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: NAME, children: "Headroom" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: DESCRIPTION, children: "Context compression for tool results, over a configured Headroom proxy." })
          ] }),
          dirty && !open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: PENDING, children: "Unsaved" }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flex: "none", color: "var(--dsw-alias-label-tertiary)", transform: open ? "rotate(180deg)" : "none", transition: "transform .16s", display: "flex" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutline14, {}) })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: BODY, children: [
      !writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: HINT, children: "Settings are read-only in this browser." }),
      field(
        "plugin-config-headroom-enabled",
        "Compression enabled",
        "When off, Headroom never compresses tool results.",
        "enabled",
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              id: "plugin-config-headroom-enabled",
              type: "checkbox",
              checked: enabled,
              disabled: !writable,
              onChange: (event) => {
                setEnabled(event.target.checked);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: LABEL, children: "Compress oversized tool results before the model reads them" })
        ] })
      ),
      field(
        "plugin-config-headroom-url",
        "Proxy URL",
        "Empty disables compression (degraded no-op with a warning). Nothing is spawned or managed by this plugin.",
        "baseUrl",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            id: "plugin-config-headroom-url",
            style: INPUT,
            value: baseUrl,
            disabled: !writable,
            placeholder: "http://127.0.0.1:8788",
            spellCheck: false,
            onChange: (event) => {
              setBaseUrl(event.target.value);
            }
          }
        )
      ),
      field(
        "plugin-config-headroom-mode",
        "Output mode",
        "Controls how much the plugin logs about its compression passes.",
        "mode",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "select",
          {
            id: "plugin-config-headroom-mode",
            style: INPUT,
            value: mode,
            disabled: !writable,
            onChange: (event) => {
              setMode(event.target.value);
            },
            children: MODE_OPTIONS.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option.value, children: option.label }, option.value))
          }
        )
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: FOOTER, children: [
        failed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { ...HINT, flex: 1, color: "var(--dsw-alias-label-error)" }, children: "Save failed; values unchanged." }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: { ...DISCARD, ...!dirty || saving ? DISABLED : {} },
            disabled: !dirty || saving,
            onClick: () => {
              setEnabled(value.enabled);
              setBaseUrl(value.baseUrl ?? "");
              setMode(value.mode);
            },
            children: "Discard"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: { ...SAVE, ...!dirty || saving ? DISABLED : {} },
            disabled: !dirty || saving,
            onClick: save,
            children: saving ? "Saving\u2026" : "Save"
          }
        )
      ] })
    ] })
  ] });
}

// src/client/index.ts
var name = "dsh-headroom-client";
var inject = ["slots", "settingsScope"];
function apply(ctx) {
  const scope = ctx.settingsScope.bind({
    namespace: "headroom",
    decode: decodeHeadroomSection
  });
  ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
    name: "settings.plugin.item",
    key: "headroom",
    inject: () => ({ scope })
  }, HeadroomCard));
}
    return module.exports;
  },
});
