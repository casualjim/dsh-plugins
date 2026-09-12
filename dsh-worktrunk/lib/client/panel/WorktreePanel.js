import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Panel body: header, worktree list, and the empty/loading/error states. Dialogs
 * are owned by the routing component in `entry.ts`; this file renders rows.
 */
import { useState, useSyncExternalStore } from 'react';
import { worktreeErrorMessageKey } from '../store.js';
import { WorktreeRowView } from './rows.js';
/** Panel body. */
export function WorktreePanel(props) {
    const state = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot);
    const [expanded, setExpanded] = useState([]);
    const workspaceId = state.workspaceId;
    if (state.loading && state.repo === undefined)
        return _jsx("div", { className: "wt-panel-loading", children: props.t('panel.loading') });
    if (state.error !== undefined && state.rows.length === 0) {
        const error = state.error;
        return (_jsxs("div", { className: "wt-panel-error", children: [_jsx("p", { children: props.t(worktreeErrorMessageKey(error), { reason: error.message }) }), error.retryable && workspaceId !== undefined
                    ? _jsx("button", { type: "button", onClick: () => { void props.store.load(workspaceId); }, children: props.t('panel.retry') })
                    : null] }));
    }
    return (_jsxs("div", { className: "wt-panel", children: [_jsxs("header", { className: "wt-panel-header", children: [_jsx("h2", { children: props.t('panel.title') }), _jsx("span", { className: "wt-panel-repo", children: state.repo?.forge ?? state.repo?.root ?? '' }), _jsx("span", { className: "wt-panel-default", children: state.repo?.defaultBranch ?? '' }), workspaceId === undefined ? null : (_jsx("button", { type: "button", onClick: () => { void props.store.load(workspaceId); }, children: props.t('panel.refresh') })), _jsx("button", { type: "button", onClick: props.onCreate, children: props.t('panel.create') })] }), state.error !== undefined && state.rows.length > 0
                ? _jsx("p", { className: "wt-panel-stale", children: props.t(worktreeErrorMessageKey(state.error), { reason: state.error.message }) })
                : null, state.rows.length === 0
                ? _jsx("p", { className: "wt-panel-empty", children: props.t('panel.empty') })
                : null, _jsx("ul", { className: "wt-rows", children: state.rows.map(row => (_jsx("li", { children: _jsx(WorktreeRowView, { row: row, t: props.t, expanded: expanded.includes(row.path), selected: props.store.getSelection() === row.path, isCurrentSession: props.currentSessionCwd !== undefined && (props.currentSessionCwd === row.path || props.currentSessionCwd.startsWith(`${row.path}/`)), sessionLabel: props.sessionLabel ?? (sessionId => String(sessionId)), onToggle: () => setExpanded(current => (current.includes(row.path) ? current.filter(path => path !== row.path) : [...current, row.path])), onSelect: () => props.store.setSelection(row.path), onOpenSession: props.openSession, onNewSession: () => props.onNewSession?.(row), onCopyPath: () => { void navigator.clipboard?.writeText(row.path); }, onSyncIgnored: () => props.onSyncIgnored?.(row), onMerge: () => props.onMerge?.(row), onRemove: () => props.onRemove?.(row) }) }, row.path))) })] }));
}
