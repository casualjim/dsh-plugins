/**
 * Browser half of dsh-worktrunk. It registers one sidebar panel entry and the
 * matching keyed main panel, and it owns the panel's dialog routing, session
 * creation, and the full-access confirmation flow.
 */
import { createElement, useEffect, useState } from 'react';
import { WORKTRUNK_NS, en } from './locale.js';
import { createWorktrunkConnection } from './connection.js';
import { createPanelStore, worktreeErrorMessageKey } from './store.js';
import { WorktreePanel } from './panel/WorktreePanel.js';
import { CreateDialog } from './panel/CreateDialog.js';
import { RemoveDialog } from './panel/RemoveDialog.js';
import { MergeDialog } from './panel/MergeDialog.js';
import { PermissionDialog } from './panel/PermissionDialog.js';
import { PanelIcon } from './PanelIcon.js';
import worktreeCss from './worktree.css';
/** Panel identity shared by the sidebar entry and the main-column occupant. */
export const WORKTRUNK_PANEL_ID = 'worktrunk';
/** Sidebar row order, after the shipped entries. */
export const WORKTRUNK_PANEL_ORDER = 20;
/** The style-tag id the panel's stylesheet is injected under, per the shell's convention. */
export const WORKTRUNK_CSS_TAG_ID = 'dsh-worktrunk/worktree.css';
/**
 * Inject the panel's stylesheet once. DSH's shell styles are CSS-modules-scoped, so without
 * this every `button`/`ul`/`li` renders as a browser default; the tag id makes a second mount
 * (or a second plugin instance) a no-op. Absent DOM (tests, SSR) is a no-op too.
 */
export function injectPanelStyle() {
    if (typeof document === 'undefined')
        return;
    if (document.querySelector(`style[data-plugin-css=${JSON.stringify(WORKTRUNK_CSS_TAG_ID)}]`) !== null)
        return;
    const tag = document.createElement('style');
    tag.dataset.plugin = 'dsh-worktrunk';
    tag.dataset.pluginCss = WORKTRUNK_CSS_TAG_ID;
    tag.textContent = worktreeCss;
    document.head.appendChild(tag);
}
/** Header facts for a panel whose repository read has not landed yet. */
const NO_REPO = { root: '', defaultBranch: 'main', forge: null };
/**
 * The workspace owning the current session, else the first registered one —
 * the same resolution DSH's own workspace browser performs.
 */
export function currentWorkspaceIdOf(rows, currentSessionId) {
    const items = rows ?? [];
    if (currentSessionId !== undefined) {
        const owner = items.find(item => item.sessionIds?.includes(currentSessionId) === true);
        if (owner !== undefined)
            return owner.workspaceId;
    }
    return items[0]?.workspaceId;
}
/** What a permission outcome means for the session. `undefined` means "claim nothing". */
export function describePermissionOutcome(status) {
    switch (status) {
        case 'applied':
        case 'already-full-access':
            return { key: undefined, openSession: true };
        case 'user-restricted':
            return { key: 'permission.userRestricted', openSession: true };
        default:
            return { key: 'permission.unavailable', openSession: false };
    }
}
/**
 * The confirmation flow, latched: a second trigger while an attempt is in
 * flight joins that attempt instead of creating a second session.
 */
export function createPermissionConfirmation() {
    let inFlight;
    return (input, cwd) => {
        if (inFlight !== undefined)
            return inFlight;
        const attempt = (async () => {
            try {
                const sessionId = await input.sessions.create({ cwd });
                const result = await input.ensurePermission({ sessionId });
                const outcome = describePermissionOutcome(result.status);
                input.notice(outcome.key);
                if (outcome.openSession)
                    input.sessions.open(sessionId);
            }
            catch (error) {
                input.notice(worktreeErrorMessageKey(error));
            }
        })();
        inFlight = attempt;
        void attempt.then(() => { inFlight = undefined; });
        return attempt;
    };
}
export const name = 'dsh-worktrunk-client';
export const inject = ['connection', 'locale', 'slots', 'sessions', 'workspaces'];
/** Register both slots and wire the panel. */
export function apply(ctx) {
    const client = ctx;
    const t = ctx.locale.bind(WORKTRUNK_NS);
    injectPanelStyle();
    ctx.effect(() => ctx.locale.register(WORKTRUNK_NS, 'en', en), 'dsh-worktrunk: locale dictionary');
    const connection = createWorktrunkConnection(client.connection.rpc);
    ctx.effect(() => () => connection.dispose(), 'dsh-worktrunk: connection disposal');
    const store = createPanelStore(connection);
    ctx.effect(() => () => store.dispose(), 'dsh-worktrunk: panel store disposal');
    // One latch per plugin instance, so it survives the panel's re-renders.
    const confirmation = createPermissionConfirmation();
    const sessionList = () => client.sessions.list.getSnapshot();
    const currentWorkspaceId = () => currentWorkspaceIdOf(client.workspaces?.list?.getSnapshot().items, sessionList().current);
    const currentSessionCwd = () => {
        const snapshot = sessionList();
        return snapshot.current === undefined ? undefined : snapshot.byId[snapshot.current]?.cwd;
    };
    const sessionLabel = (sessionId) => sessionList().byId[sessionId]?.displayTitle ?? String(sessionId);
    const isInsideWorktree = (path) => {
        const cwd = currentSessionCwd();
        return cwd !== undefined && (cwd === path || cwd.startsWith(`${path}/`));
    };
    const Body = () => {
        const [dialog, setDialog] = useState({ kind: 'none' });
        const [hooks, setHooks] = useState([]);
        const [errorKey, setErrorKey] = useState(undefined);
        useEffect(() => {
            const workspaceId = currentWorkspaceId();
            if (workspaceId !== undefined)
                void store.load(workspaceId);
        }, []);
        const submitCreate = (input) => {
            const workspaceId = currentWorkspaceId();
            if (workspaceId === undefined)
                return;
            setErrorKey(undefined);
            void connection.createWorktree({ workspaceId, ...input })
                .then(() => store.load(workspaceId))
                .then(() => setDialog({ kind: 'none' }))
                .catch(error => setErrorKey(worktreeErrorMessageKey(error)));
        };
        const confirmPermission = (cwd) => confirmation({
            sessions: client.sessions,
            ensurePermission: input => connection.ensureWorktreePermission(input),
            notice: setErrorKey,
        }, cwd).finally(() => { setDialog({ kind: 'none' }); });
        return createElement('div', { className: 'wt-panel-host' }, createElement(WorktreePanel, {
            store,
            connection,
            t,
            currentSessionCwd: currentSessionCwd(),
            sessionLabel,
            openSession: (sessionId) => { client.sessions.open(sessionId); },
            onCreate: () => {
                const workspaceId = currentWorkspaceId();
                if (workspaceId === undefined)
                    return;
                void connection.previewHooks({ workspaceId }).then(setHooks).catch(() => setHooks([]));
                setErrorKey(undefined);
                setDialog({ kind: 'create' });
            },
            onNewSession: (row) => { setErrorKey(undefined); setDialog({ kind: 'permission', cwd: row.path }); },
            onSyncIgnored: (row) => {
                const workspaceId = currentWorkspaceId();
                if (workspaceId === undefined)
                    return;
                setErrorKey(undefined);
                void connection.copyIgnored({ workspaceId, path: row.path })
                    .then(() => setErrorKey('panel.synced'))
                    .catch(error => setErrorKey(worktreeErrorMessageKey(error)));
            },
            onMerge: (row) => { setErrorKey(undefined); setDialog({ kind: 'merge', row: row }); },
            onRemove: (row) => { setErrorKey(undefined); setDialog({ kind: 'remove', row: row }); },
        }), dialog.kind === 'create'
            ? createElement(CreateDialog, {
                repo: store.getSnapshot().repo ?? NO_REPO,
                hooks,
                defaultBranch: store.getSnapshot().repo?.defaultBranch ?? NO_REPO.defaultBranch,
                t,
                errorKey,
                onCancel: () => setDialog({ kind: 'none' }),
                onSubmit: submitCreate,
            })
            : null, dialog.kind === 'remove'
            ? createElement(RemoveDialog, {
                row: dialog.row,
                t,
                errorKey,
                onCancel: () => setDialog({ kind: 'none' }),
                onSubmit: (input) => {
                    const workspaceId = currentWorkspaceId();
                    if (workspaceId === undefined)
                        return;
                    void connection.removeWorktree({ workspaceId, branch: dialog.row.branch, ...input, currentCwd: currentSessionCwd() })
                        .then(() => store.load(workspaceId))
                        .then(() => setDialog({ kind: 'none' }))
                        .catch(error => setErrorKey(worktreeErrorMessageKey(error)));
                },
            })
            : null, dialog.kind === 'merge'
            ? createElement(MergeDialog, {
                row: dialog.row,
                defaultBranch: store.getSnapshot().repo?.defaultBranch ?? NO_REPO.defaultBranch,
                hooks: store.getSnapshot().hooks,
                isCurrentSessionWorktree: isInsideWorktree(dialog.row.path),
                t,
                errorKey,
                onCancel: () => setDialog({ kind: 'none' }),
                onSubmit: (input) => {
                    const workspaceId = currentWorkspaceId();
                    if (workspaceId === undefined)
                        return;
                    void connection.mergeWorktree({ workspaceId, branch: dialog.row.branch, ...input, currentCwd: currentSessionCwd() })
                        .then(() => store.load(workspaceId))
                        .then(() => setDialog({ kind: 'none' }))
                        .catch(error => setErrorKey(worktreeErrorMessageKey(error)));
                },
            })
            : null, dialog.kind === 'permission'
            ? createElement(PermissionDialog, {
                cwd: dialog.cwd,
                t,
                onCancel: () => setDialog({ kind: 'none' }),
                onConfirm: () => confirmPermission(dialog.cwd),
            })
            : null, errorKey === undefined
            ? null
            : createElement('p', { className: 'wt-panel-notice' }, t(errorKey)));
    };
    client.slots.inject('sidebar.panellist', () => client.slots.register({
        name: 'sidebar.panellist',
        id: WORKTRUNK_PANEL_ID,
        order: WORKTRUNK_PANEL_ORDER,
        label: () => t('panel.label'),
    }, PanelIcon));
    client.slots.inject('main', () => client.slots.register({
        name: 'main',
        key: WORKTRUNK_PANEL_ID,
        locale: WORKTRUNK_NS,
        inject: () => ({ store }),
    }, Body));
}
