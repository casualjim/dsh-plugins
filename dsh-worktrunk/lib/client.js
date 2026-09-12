window.__ModuleLoader__.load({
  id: "dsh-worktrunk",
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

// src/client/entry.ts
var entry_exports = {};
__export(entry_exports, {
  WORKTRUNK_PANEL_ID: () => WORKTRUNK_PANEL_ID,
  WORKTRUNK_PANEL_ORDER: () => WORKTRUNK_PANEL_ORDER,
  apply: () => apply,
  createPermissionConfirmation: () => createPermissionConfirmation,
  currentWorkspaceIdOf: () => currentWorkspaceIdOf,
  describePermissionOutcome: () => describePermissionOutcome,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(entry_exports);
var import_react6 = require("react");

// src/client/locale.ts
var WORKTRUNK_NS = "worktrunk";
var en = {
  "panel.label": "Worktrees",
  "panel.title": "Worktrees",
  "panel.refresh": "Refresh",
  "panel.empty": "No worktrees yet. Create one to start working in a parallel checkout.",
  "panel.loading": "Loading worktrees\u2026",
  "panel.retry": "Retry",
  "panel.local": "Local",
  "panel.detached": "Detached HEAD",
  "panel.branchMismatch": "Branch changed in Git",
  "panel.duplicateBranch": "Branch checked out twice",
  "panel.dirty": "Uncommitted changes",
  "panel.ahead": "{n} ahead",
  "panel.behind": "{n} behind",
  "panel.current": "Current session",
  "panel.copyPath": "Copy path",
  "panel.open": "Open in DSH",
  "panel.newSession": "New session here",
  "panel.syncIgnored": "Sync gitignored files",
  "panel.merge": "Merge into\u2026",
  "panel.remove": "Remove",
  "panel.create": "Create worktree",
  "panel.sessions": "Sessions",
  "panel.noSessions": "No sessions yet",
  "create.title": "Create worktree",
  "create.description": "A new branch and worktree in {repo}. Worktrees live outside the repository.",
  "create.branch": "New branch name",
  "create.branchPlaceholder": "feature/next",
  "create.base": "Base branch",
  "create.baseCurrent": "Current branch ({branch})",
  "create.hooks": "Setup steps from .config/wt.toml",
  "create.noHooks": "This repository configures no start hooks.",
  "create.skipHooks": "Skip start hooks this once (no dependency install, no gitignored file copy)",
  "create.blocking": "A pre-start hook runs before the worktree is ready and can take a while.",
  "create.submit": "Create",
  "create.cancel": "Cancel",
  "create.working": "Creating worktree and running setup steps\u2026",
  "remove.title": "Remove worktree",
  "remove.description": "Remove {branch} at {path} from disk? Its sessions keep their history but lose this directory.",
  "remove.dirty": "This worktree has uncommitted changes.",
  "remove.force": "Remove anyway, discarding uncommitted changes",
  "remove.branchUnmerged": "The branch is not merged; deleting it needs an explicit choice.",
  "remove.forceDeleteBranch": "Also delete the branch even though it is not merged",
  "remove.keepBranch": "Keep the branch, remove only the worktree",
  "remove.detached": "This worktree has a detached HEAD; no branch will be deleted.",
  "remove.submit": "Remove",
  "remove.cancel": "Cancel",
  "merge.title": "Merge worktree",
  "merge.description": "Squash and rebase {branch} into {target}, fast-forward the target, then remove the worktree.",
  "merge.target": "Target branch",
  "merge.keepCommit": "Preserve commit history (no squash)",
  "merge.keepWorktree": "Keep the worktree after merging",
  "merge.hooks": "Pre-merge hooks from .config/wt.toml",
  "merge.submit": "Merge",
  "merge.cancel": "Cancel",
  "permission.title": "Enable Worktree Full access?",
  "permission.description": "This session works inside a git worktree, whose .git entry points at metadata in the main repository. Enabling full access disables filesystem confinement for this session only, so git writes can reach that metadata. Approval prompts stay on; network and process policy are unchanged. Target: {cwd}",
  "permission.acknowledge": "I understand and want to continue",
  "permission.enable": "Enable full access",
  "permission.cancel": "Cancel",
  "permission.userRestricted": "Your own permission restriction was preserved; this session was not elevated.",
  "permission.unavailable": "The permission preset is unavailable in this profile; the session was kept but full access is not confirmed.",
  "error.wtNotInstalled": "worktrunk is not installed. Install it with `brew install worktrunk` or `cargo install worktrunk`, then restart DSH.",
  "error.notARepo": "This workspace is not a git repository.",
  "error.noInitialCommit": "This repository has no commit yet.",
  "error.noLocalBranch": "This repository has no local branch yet.",
  "error.wtFailed": "worktrunk failed: {reason}",
  "error.busy": "Another worktrunk operation is in progress; retry shortly.",
  "error.sessionWorktree": "That would affect the worktree this session runs inside; do it from another session.",
  "error.notFound": "That worktree no longer exists; refresh the panel.",
  "error.hookFailed": "A setup step failed: {reason}",
  "error.presetUnavailable": "The worktree full-access preset is not installed in this profile.",
  "error.unknown": "The worktree operation failed: {reason}"
};

// src/client/connection.ts
var WORKTRUNK_CHANNEL = "/api";
var WORKTRUNK_ENDPOINTS = Object.freeze({
  readPanel: "worktrunkManager/readPanel",
  previewHooks: "worktrunkManager/previewHooks",
  createWorktree: "worktrunkManager/createWorktree",
  removeWorktree: "worktrunkManager/removeWorktree",
  mergeWorktree: "worktrunkManager/mergeWorktree",
  copyIgnored: "worktrunkManager/copyIgnored",
  openWorktree: "worktrunkManager/openWorktree",
  ensureWorktreePermission: "worktrunkManager/ensureWorktreePermission"
});
var WorktrunkConnectionError = class extends Error {
  code;
  details;
  retryable;
  constructor(options) {
    super(options.message, options.cause === void 0 ? void 0 : { cause: options.cause });
    this.name = "WorktrunkConnectionError";
    this.code = options.code;
    this.details = Object.freeze({ ...options.details ?? {} });
    this.retryable = options.retryable;
  }
};
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asEnvelope(value) {
  if (isRecord(value) && typeof value.ok === "boolean") return value;
  return { ok: false, error: { code: "WORKTRUNK_INVALID_RESULT", message: "", details: {} } };
}
function createWorktrunkConnection(rpc) {
  const inFlight = /* @__PURE__ */ new Set();
  let disposed = false;
  async function invoke(endpoint, input) {
    if (disposed) throw new WorktrunkConnectionError({ code: "CLIENT_DISPOSED", message: "Worktrunk connection is disposed; reload the plugin and retry.", retryable: false });
    const controller = new AbortController();
    inFlight.add(controller);
    try {
      let raw;
      try {
        raw = await rpc.call(WORKTRUNK_CHANNEL, endpoint, { args: { input } }, controller.signal);
      } catch (error) {
        if (disposed && controller.signal.aborted) throw new WorktrunkConnectionError({ code: "CLIENT_DISPOSED", message: "Worktrunk connection is disposed; reload the plugin and retry.", retryable: false });
        throw new WorktrunkConnectionError({
          code: "WORKTRUNK_CONNECTION_FAILED",
          message: error instanceof Error ? error.message : String(error),
          details: { endpoint },
          retryable: true,
          cause: error
        });
      }
      const envelope = asEnvelope(raw);
      if (!envelope.ok) {
        const error = envelope.error;
        throw new WorktrunkConnectionError({
          code: typeof error.code === "string" ? error.code : "WORKTRUNK_GATEWAY_FAILED",
          message: typeof error.message === "string" ? error.message : "",
          details: { endpoint, ...isRecord(error.details) ? error.details : {} },
          retryable: true
        });
      }
      const inner = asEnvelope(envelope.value);
      if (!inner.ok) {
        const error = inner.error;
        throw new WorktrunkConnectionError({
          code: typeof error.code === "string" ? error.code : "WORKTRUNK_DOMAIN_FAILED",
          message: typeof error.message === "string" ? error.message : "",
          details: { endpoint, ...isRecord(error.details) ? error.details : {} },
          retryable: false
        });
      }
      return inner.value;
    } finally {
      inFlight.delete(controller);
    }
  }
  return {
    readPanel: (input) => invoke(WORKTRUNK_ENDPOINTS.readPanel, input),
    previewHooks: (input) => invoke(WORKTRUNK_ENDPOINTS.previewHooks, input),
    createWorktree: (input) => invoke(WORKTRUNK_ENDPOINTS.createWorktree, input),
    async removeWorktree(input) {
      await invoke(WORKTRUNK_ENDPOINTS.removeWorktree, input);
    },
    async mergeWorktree(input) {
      await invoke(WORKTRUNK_ENDPOINTS.mergeWorktree, input);
    },
    async copyIgnored(input) {
      await invoke(WORKTRUNK_ENDPOINTS.copyIgnored, input);
    },
    openWorktree: (input) => invoke(WORKTRUNK_ENDPOINTS.openWorktree, input),
    ensureWorktreePermission: (input) => invoke(WORKTRUNK_ENDPOINTS.ensureWorktreePermission, input),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const controller of inFlight) controller.abort();
      inFlight.clear();
    }
  };
}

// src/client/store.ts
var EMPTY = { workspaceId: void 0, repo: void 0, rows: [], hooks: [], loading: false, error: void 0, selection: void 0 };
function worktreeErrorMessageKey(error) {
  const candidate = error instanceof WorktrunkConnectionError ? error.code : error?.code;
  const code = typeof candidate === "string" ? candidate : void 0;
  switch (code) {
    case "WT_NOT_INSTALLED":
      return "error.wtNotInstalled";
    case "NOT_A_REPO":
      return "error.notARepo";
    case "NO_INITIAL_COMMIT":
      return "error.noInitialCommit";
    case "NO_LOCAL_BRANCH":
      return "error.noLocalBranch";
    case "WT_FAILED":
      return "error.wtFailed";
    case "WT_BUSY":
      return "error.busy";
    case "SESSION_WORKTREE":
      return "error.sessionWorktree";
    case "NOT_FOUND":
      return "error.notFound";
    case "HOOK_FAILED":
      return "error.hookFailed";
    case "PRESET_UNAVAILABLE":
      return "error.presetUnavailable";
    default:
      return "error.unknown";
  }
}
function createPanelStore(connection) {
  let state = EMPTY;
  let disposed = false;
  const generations = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  const publish = (next) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async load(workspaceId) {
      if (disposed) return;
      const generation = (generations.get(workspaceId) ?? 0) + 1;
      generations.set(workspaceId, generation);
      const firstRead = state.workspaceId !== workspaceId || state.repo === void 0;
      publish(firstRead ? { workspaceId, repo: void 0, rows: [], hooks: [], loading: true, error: void 0 } : { workspaceId, loading: false, error: void 0 });
      try {
        const snapshot = await connection.readPanel({ workspaceId });
        if (disposed || generations.get(workspaceId) !== generation || state.workspaceId !== workspaceId) return;
        publish({ workspaceId, repo: snapshot.repo, rows: snapshot.items, hooks: snapshot.hooks, loading: false, error: void 0 });
      } catch (error) {
        if (disposed || generations.get(workspaceId) !== generation || state.workspaceId !== workspaceId) return;
        publish({
          loading: false,
          error: {
            code: error instanceof WorktrunkConnectionError ? error.code : "UNKNOWN",
            retryable: error instanceof WorktrunkConnectionError ? error.retryable : true,
            message: error instanceof Error ? error.message : String(error)
          }
        });
      }
    },
    setSelection(worktreePath) {
      if (state.selection === worktreePath) return;
      publish({ selection: worktreePath });
    },
    getSelection: () => state.selection,
    dispose() {
      disposed = true;
      listeners.clear();
    }
  };
}

// src/client/panel/WorktreePanel.tsx
var import_react = require("react");

// src/client/panel/rows.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function rowChips(row, t) {
  const chips = [];
  if (Object.values(row.changes).some(Boolean)) chips.push(t("panel.dirty"));
  if (row.detached) chips.push(t("panel.detached"));
  if (row.branchMismatch) chips.push(t("panel.branchMismatch"));
  if (row.duplicateBranch) chips.push(t("panel.duplicateBranch"));
  if (row.upstream !== null && row.upstream.ahead > 0) chips.push(t("panel.ahead", { n: row.upstream.ahead }));
  if (row.upstream !== null && row.upstream.behind > 0) chips.push(t("panel.behind", { n: row.upstream.behind }));
  return chips;
}
function WorktreeRowView(props) {
  const { row, t } = props;
  const label = row.isMain ? t("panel.local") : row.branch;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wt-row", "data-current": props.isCurrentSession ? "true" : void 0, "data-selected": props.selected ? "true" : void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: "wt-row-main", onClick: props.onSelect, "aria-expanded": props.expanded, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wt-row-label", children: label }),
      props.isCurrentSession ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wt-row-mark", children: t("panel.current") }) : null,
      row.head === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wt-row-head", children: `${row.head.shortSha} ${row.head.subject}` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "wt-row-toggle", "aria-label": t("panel.sessions"), onClick: props.onToggle, children: `${t("panel.sessions")} (${row.sessions.length})` }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "wt-row-chips", children: rowChips(row, t).map((chip) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wt-chip", children: chip }, chip)) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wt-row-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: props.onNewSession, children: t("panel.newSession") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: props.onCopyPath, children: t("panel.copyPath") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: props.onSyncIgnored, children: t("panel.syncIgnored") }),
      row.detached ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: props.onMerge, children: t("panel.merge") }),
      row.isMain ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: props.onRemove, children: t("panel.remove") })
    ] }),
    props.expanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", { className: "wt-sessions", children: [
      row.sessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { className: "wt-session-empty", children: t("panel.noSessions") }) : null,
      row.sessions.map((session) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: () => props.onOpenSession(session.id), children: props.sessionLabel(session.id) }) }, session.id))
    ] }) : null
  ] });
}

// src/client/panel/WorktreePanel.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function WorktreePanel(props) {
  const state = (0, import_react.useSyncExternalStore)(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot);
  const [expanded, setExpanded] = (0, import_react.useState)([]);
  const workspaceId = state.workspaceId;
  if (state.loading && state.repo === void 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "wt-panel-loading", children: props.t("panel.loading") });
  if (state.error !== void 0 && state.rows.length === 0) {
    const error = state.error;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "wt-panel-error", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { children: props.t(worktreeErrorMessageKey(error), { reason: error.message }) }),
      error.retryable && workspaceId !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: () => {
        void props.store.load(workspaceId);
      }, children: props.t("panel.retry") }) : null
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "wt-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("header", { className: "wt-panel-header", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { children: props.t("panel.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "wt-panel-repo", children: state.repo?.forge ?? state.repo?.root ?? "" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "wt-panel-default", children: state.repo?.defaultBranch ?? "" }),
      workspaceId === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: () => {
        void props.store.load(workspaceId);
      }, children: props.t("panel.refresh") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", onClick: props.onCreate, children: props.t("panel.create") })
    ] }),
    state.error !== void 0 && state.rows.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "wt-panel-stale", children: props.t(worktreeErrorMessageKey(state.error), { reason: state.error.message }) }) : null,
    state.rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "wt-panel-empty", children: props.t("panel.empty") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "wt-rows", children: state.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      WorktreeRowView,
      {
        row,
        t: props.t,
        expanded: expanded.includes(row.path),
        selected: props.store.getSelection() === row.path,
        isCurrentSession: props.currentSessionCwd !== void 0 && (props.currentSessionCwd === row.path || props.currentSessionCwd.startsWith(`${row.path}/`)),
        sessionLabel: props.sessionLabel ?? ((sessionId) => String(sessionId)),
        onToggle: () => setExpanded((current) => current.includes(row.path) ? current.filter((path) => path !== row.path) : [...current, row.path]),
        onSelect: () => props.store.setSelection(row.path),
        onOpenSession: props.openSession,
        onNewSession: () => props.onNewSession?.(row),
        onCopyPath: () => {
          void navigator.clipboard?.writeText(row.path);
        },
        onSyncIgnored: () => props.onSyncIgnored?.(row),
        onMerge: () => props.onMerge?.(row),
        onRemove: () => props.onRemove?.(row)
      }
    ) }, row.path)) })
  ] });
}

// src/client/panel/CreateDialog.tsx
var import_react2 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var START_HOOK_TYPES = ["pre-start", "post-start"];
function createDialogSummary(hooks, t) {
  const start = hooks.filter((hook) => START_HOOK_TYPES.includes(hook.type));
  return {
    title: start.length === 0 ? t("create.noHooks") : t("create.hooks"),
    lines: start.map((hook) => `${hook.type} ${hook.name}: ${hook.template}`),
    blocking: start.some((hook) => hook.type === "pre-start")
  };
}
function CreateDialog(props) {
  const { t, hooks } = props;
  const [branch, setBranch] = (0, import_react2.useState)("");
  const [base, setBase] = (0, import_react2.useState)(props.defaultBranch);
  const [skipHooks, setSkipHooks] = (0, import_react2.useState)(false);
  const summary = createDialogSummary(hooks, t);
  const canSubmit = branch.trim() !== "" && props.pending !== true;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "form",
    {
      className: "wt-dialog wt-dialog-create",
      onSubmit: (event) => {
        event.preventDefault();
        if (!canSubmit) return;
        const base2 = base.trim();
        props.onSubmit({ branch: branch.trim(), ...base2 === "" ? {} : { base: base2 }, skipHooks });
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { children: t("create.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { children: t("create.description", { repo: props.repo.forge ?? props.repo.root }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { children: [
          t("create.branch"),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { value: branch, onChange: (event) => setBranch(event.target.value), placeholder: t("create.branchPlaceholder"), autoFocus: true })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { children: [
          t("create.base"),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("select", { value: base, onChange: (event) => setBase(event.target.value), children: [
            props.currentBranch === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: props.currentBranch, children: t("create.baseCurrent", { branch: props.currentBranch }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: props.defaultBranch, children: props.defaultBranch })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "wt-hooks", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h4", { children: summary.title }),
          summary.lines.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { children: summary.lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { children: line }) }, line)) }),
          summary.blocking ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "wt-hooks-blocking", children: t("create.blocking") }) : null,
          summary.lines.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: "wt-hooks-skip", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { type: "checkbox", checked: skipHooks, onChange: (event) => setSkipHooks(event.target.checked) }),
            t("create.skipHooks")
          ] })
        ] }),
        props.pending === true ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "wt-dialog-working", children: t("create.working") }) : null,
        props.errorKey === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "wt-dialog-error", children: t(props.errorKey) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("footer", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", onClick: props.onCancel, children: t("create.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "submit", disabled: !canSubmit, children: t("create.submit") })
        ] })
      ]
    }
  );
}

// src/client/panel/RemoveDialog.tsx
var import_react3 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function removeDialogFacts(row, t) {
  const lines = [];
  const dirty = Object.values(row.changes).some(Boolean);
  if (dirty) lines.push(t("remove.dirty"));
  if (row.detached) lines.push(t("remove.detached"));
  if (row.branchMismatch) lines.push(t("panel.branchMismatch"));
  if (row.sessions.length > 0) lines.push(t("panel.sessions"));
  return { lines, needsForce: dirty, canDeleteBranch: !row.detached };
}
function removeDialogBlocked(needsForce, force) {
  return needsForce && !force;
}
function removeDialogSubmit(facts, choice, submit) {
  if (removeDialogBlocked(facts.needsForce, choice.force)) return;
  submit(choice);
}
function RemoveDialog(props) {
  const { row, t } = props;
  const facts = removeDialogFacts(row, t);
  const [force, setForce] = (0, import_react3.useState)(false);
  const [forceDeleteBranch, setForceDeleteBranch] = (0, import_react3.useState)(false);
  const [keepBranch, setKeepBranch] = (0, import_react3.useState)(false);
  const blocked = removeDialogBlocked(facts.needsForce, force);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "form",
    {
      className: "wt-dialog wt-dialog-remove",
      onSubmit: (event) => {
        event.preventDefault();
        removeDialogSubmit(facts, { force, forceDeleteBranch, keepBranch }, props.onSubmit);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h3", { children: t("remove.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: t("remove.description", { branch: row.branch, path: row.path }) }),
        facts.lines.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { children: facts.lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("li", { children: line }, line)) }),
        facts.needsForce ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "checkbox", checked: force, onChange: (event) => setForce(event.target.checked) }),
          t("remove.force")
        ] }) : null,
        facts.canDeleteBranch && props.unmerged ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "checkbox", checked: forceDeleteBranch, onChange: (event) => setForceDeleteBranch(event.target.checked) }),
          t("remove.forceDeleteBranch")
        ] }) : null,
        facts.canDeleteBranch && !props.unmerged ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "checkbox", checked: keepBranch, onChange: (event) => setKeepBranch(event.target.checked) }),
          t("remove.keepBranch")
        ] }) : null,
        props.errorKey === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "wt-dialog-error", children: t(props.errorKey) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("footer", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", onClick: props.onCancel, children: t("remove.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "submit", disabled: blocked || props.pending === true, children: t("remove.submit") })
        ] })
      ]
    }
  );
}

// src/client/panel/MergeDialog.tsx
var import_react4 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
function mergeHooks(hooks, t) {
  return hooks.filter((hook) => hook.type === "pre-merge").map((hook) => `${hook.type} ${hook.name}: ${hook.template}`);
}
function MergeDialog(props) {
  const { row, t } = props;
  const lines = mergeHooks(props.hooks, t);
  const [target, setTarget] = (0, import_react4.useState)(props.defaultBranch);
  const [keepCommit, setKeepCommit] = (0, import_react4.useState)(false);
  const [keepWorktree, setKeepWorktree] = (0, import_react4.useState)(props.isCurrentSessionWorktree);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "form",
    {
      className: "wt-dialog wt-dialog-merge",
      onSubmit: (event) => {
        event.preventDefault();
        props.onSubmit({ target: target.trim() === "" ? props.defaultBranch : target.trim(), keepCommit, keepWorktree });
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { children: t("merge.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { children: t("merge.description", { branch: row.branch, target }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { children: [
          t("merge.target"),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { value: target, onChange: (event) => setTarget(event.target.value) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: keepCommit, onChange: (event) => setKeepCommit(event.target.checked) }),
          t("merge.keepCommit")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: keepWorktree, onChange: (event) => setKeepWorktree(event.target.checked) }),
          t("merge.keepWorktree")
        ] }),
        lines.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "wt-hooks", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h4", { children: t("merge.hooks") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ul", { children: lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: line }) }, line)) })
        ] }),
        props.errorKey === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "wt-dialog-error", children: t(props.errorKey) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("footer", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: props.onCancel, children: t("merge.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "submit", disabled: props.pending === true, children: t("merge.submit") })
        ] })
      ]
    }
  );
}

// src/client/panel/PermissionDialog.tsx
var import_react5 = require("react");
var import_jsx_runtime6 = require("react/jsx-runtime");
function PermissionDialog(props) {
  const { t } = props;
  const [acknowledged, setAcknowledged] = (0, import_react5.useState)(false);
  const [pending, setPending] = (0, import_react5.useState)(false);
  const submit = () => {
    if (!acknowledged || pending) return;
    setPending(true);
    void (async () => {
      try {
        await props.onConfirm();
      } catch {
      } finally {
        setPending(false);
      }
    })();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
    "form",
    {
      className: "wt-dialog wt-dialog-permission",
      onSubmit: (event) => {
        event.preventDefault();
        submit();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h3", { children: t("permission.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { children: t("permission.description", { cwd: props.cwd }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "checkbox", checked: acknowledged, onChange: (event) => setAcknowledged(event.target.checked) }),
          t("permission.acknowledge")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("footer", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", onClick: props.onCancel, children: t("permission.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "submit", disabled: !acknowledged || pending, children: t("permission.enable") })
        ] })
      ]
    }
  );
}

// src/client/PanelIcon.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function PanelIcon({ size, active }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": "true", "data-active": active ? "true" : void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M4 2v9a2 2 0 0 0 2 2h3", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("circle", { cx: "4", cy: "2.5", r: "1.5", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("circle", { cx: "11", cy: "13", r: "1.5", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("circle", { cx: "11", cy: "5.5", r: "1.5", fill: "currentColor" }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M11 7v4.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })
  ] });
}

// src/client/entry.ts
var WORKTRUNK_PANEL_ID = "worktrunk";
var WORKTRUNK_PANEL_ORDER = 20;
var NO_REPO = { root: "", defaultBranch: "main", forge: null };
function currentWorkspaceIdOf(rows, currentSessionId) {
  const items = rows ?? [];
  if (currentSessionId !== void 0) {
    const owner = items.find((item) => item.sessionIds?.includes(currentSessionId) === true);
    if (owner !== void 0) return owner.workspaceId;
  }
  return items[0]?.workspaceId;
}
function describePermissionOutcome(status) {
  switch (status) {
    case "applied":
    case "already-full-access":
      return { key: "permission.applied", openSession: true };
    case "user-restricted":
      return { key: "permission.userRestricted", openSession: true };
    default:
      return { key: "permission.unavailable", openSession: false };
  }
}
function createPermissionConfirmation() {
  let inFlight;
  return (input, cwd) => {
    if (inFlight !== void 0) return inFlight;
    const attempt = (async () => {
      try {
        const sessionId = await input.sessions.create({ cwd });
        const result = await input.ensurePermission({ sessionId });
        const outcome = describePermissionOutcome(result.status);
        input.notice(outcome.key === "permission.applied" ? void 0 : outcome.key);
        if (outcome.openSession) input.sessions.open(sessionId);
      } catch (error) {
        input.notice(worktreeErrorMessageKey(error));
      }
    })();
    inFlight = attempt;
    void attempt.then(() => {
      inFlight = void 0;
    });
    return attempt;
  };
}
var name = "dsh-worktrunk-client";
var inject = ["connection", "locale", "slots", "sessions", "workspaces"];
function apply(ctx) {
  const client = ctx;
  const t = ctx.locale.bind(WORKTRUNK_NS);
  ctx.effect(() => ctx.locale.register(WORKTRUNK_NS, "en", en), "dsh-worktrunk: locale dictionary");
  const connection = createWorktrunkConnection(client.connection.rpc);
  ctx.effect(() => () => connection.dispose(), "dsh-worktrunk: connection disposal");
  const store = createPanelStore(connection);
  ctx.effect(() => () => store.dispose(), "dsh-worktrunk: panel store disposal");
  const confirmation = createPermissionConfirmation();
  const sessionList = () => client.sessions.list.getSnapshot();
  const currentWorkspaceId = () => currentWorkspaceIdOf(client.workspaces?.list?.getSnapshot().items, sessionList().current);
  const currentSessionCwd = () => {
    const snapshot = sessionList();
    return snapshot.current === void 0 ? void 0 : snapshot.byId[snapshot.current]?.cwd;
  };
  const sessionLabel = (sessionId) => sessionList().byId[sessionId]?.displayTitle ?? String(sessionId);
  const isInsideWorktree = (path) => {
    const cwd = currentSessionCwd();
    return cwd !== void 0 && (cwd === path || cwd.startsWith(`${path}/`));
  };
  const Body = () => {
    const [dialog, setDialog] = (0, import_react6.useState)({ kind: "none" });
    const [hooks, setHooks] = (0, import_react6.useState)([]);
    const [errorKey, setErrorKey] = (0, import_react6.useState)(void 0);
    (0, import_react6.useEffect)(() => {
      const workspaceId = currentWorkspaceId();
      if (workspaceId !== void 0) void store.load(workspaceId);
    }, []);
    const submitCreate = (input) => {
      const workspaceId = currentWorkspaceId();
      if (workspaceId === void 0) return;
      setErrorKey(void 0);
      void connection.createWorktree({ workspaceId, ...input }).then(() => store.load(workspaceId)).then(() => setDialog({ kind: "none" })).catch((error) => setErrorKey(worktreeErrorMessageKey(error)));
    };
    const confirmPermission = (cwd) => confirmation({
      sessions: client.sessions,
      ensurePermission: (input) => connection.ensureWorktreePermission(input),
      notice: setErrorKey
    }, cwd).finally(() => {
      setDialog({ kind: "none" });
    });
    return (0, import_react6.createElement)(
      "div",
      { className: "wt-panel-host" },
      (0, import_react6.createElement)(WorktreePanel, {
        store,
        connection,
        t,
        currentSessionCwd: currentSessionCwd(),
        sessionLabel,
        openSession: (sessionId) => {
          client.sessions.open(sessionId);
        },
        onCreate: () => {
          const workspaceId = currentWorkspaceId();
          if (workspaceId === void 0) return;
          void connection.previewHooks({ workspaceId }).then(setHooks).catch(() => setHooks([]));
          setErrorKey(void 0);
          setDialog({ kind: "create" });
        },
        onNewSession: (row) => {
          setErrorKey(void 0);
          setDialog({ kind: "permission", cwd: row.path });
        },
        onSyncIgnored: (row) => {
          const workspaceId = currentWorkspaceId();
          if (workspaceId !== void 0) void connection.copyIgnored({ workspaceId, path: row.path });
        },
        onMerge: (row) => {
          setErrorKey(void 0);
          setDialog({ kind: "merge", row });
        },
        // ponytail: `unmerged` is not in the panel snapshot, so the delete-branch gate cannot be
        // pre-emptive; the host refuses and the notice names it. Widen WorktreeRow if it must show.
        onRemove: (row) => {
          setErrorKey(void 0);
          setDialog({ kind: "remove", row, unmerged: false });
        }
      }),
      dialog.kind === "create" ? (0, import_react6.createElement)(CreateDialog, {
        repo: store.getSnapshot().repo ?? NO_REPO,
        hooks,
        defaultBranch: store.getSnapshot().repo?.defaultBranch ?? NO_REPO.defaultBranch,
        t,
        errorKey,
        onCancel: () => setDialog({ kind: "none" }),
        onSubmit: submitCreate
      }) : null,
      dialog.kind === "remove" ? (0, import_react6.createElement)(RemoveDialog, {
        row: dialog.row,
        unmerged: dialog.unmerged,
        t,
        errorKey,
        onCancel: () => setDialog({ kind: "none" }),
        onSubmit: (input) => {
          const workspaceId = currentWorkspaceId();
          if (workspaceId === void 0) return;
          void connection.removeWorktree({ workspaceId, branch: dialog.row.branch, ...input, currentCwd: currentSessionCwd() }).then(() => store.load(workspaceId)).then(() => setDialog({ kind: "none" })).catch((error) => setErrorKey(worktreeErrorMessageKey(error)));
        }
      }) : null,
      dialog.kind === "merge" ? (0, import_react6.createElement)(MergeDialog, {
        row: dialog.row,
        defaultBranch: store.getSnapshot().repo?.defaultBranch ?? NO_REPO.defaultBranch,
        hooks: store.getSnapshot().hooks,
        isCurrentSessionWorktree: isInsideWorktree(dialog.row.path),
        t,
        errorKey,
        onCancel: () => setDialog({ kind: "none" }),
        onSubmit: (input) => {
          const workspaceId = currentWorkspaceId();
          if (workspaceId === void 0) return;
          void connection.mergeWorktree({ workspaceId, branch: dialog.row.branch, ...input, currentCwd: currentSessionCwd() }).then(() => store.load(workspaceId)).then(() => setDialog({ kind: "none" })).catch((error) => setErrorKey(worktreeErrorMessageKey(error)));
        }
      }) : null,
      dialog.kind === "permission" ? (0, import_react6.createElement)(PermissionDialog, {
        cwd: dialog.cwd,
        t,
        onCancel: () => setDialog({ kind: "none" }),
        onConfirm: () => confirmPermission(dialog.cwd)
      }) : null,
      errorKey === void 0 ? null : (0, import_react6.createElement)("p", { className: "wt-panel-notice" }, t(errorKey))
    );
  };
  client.slots.inject("sidebar.panellist", () => client.slots.register({
    name: "sidebar.panellist",
    id: WORKTRUNK_PANEL_ID,
    order: WORKTRUNK_PANEL_ORDER,
    label: () => t("panel.label")
  }, PanelIcon));
  client.slots.inject("main", () => client.slots.register({
    name: "main",
    key: WORKTRUNK_PANEL_ID,
    locale: WORKTRUNK_NS,
    inject: () => ({ store })
  }, Body));
}
    return module.exports;
  },
});
