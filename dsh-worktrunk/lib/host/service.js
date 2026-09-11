import { assertNotSessionWorktree, copyIgnoredArgs, createArgs, hookSpecs, listWorktrees, listWorktreesFull, mergeArgs, removeArgs, runWtOk, WtError, } from '../wt.js';
import { ensureWorktreeFullAccess } from './permission.js';
import { readSessionHeaders, sessionsForWorktree } from './sessions.js';
import { registerWorkspace, registryOf, resolveWorkspacePath, unregisterWorkspace } from './workspace.js';
async function workspacePath(ctx, workspaceId) {
    const path = await resolveWorkspacePath(ctx, workspaceId);
    if (path === undefined)
        throw new WtError('NOT_FOUND', `workspace ${JSON.stringify(workspaceId)} is not registered`);
    return path;
}
/** Whether the registry already knows this path; either registry face counts. */
async function isRegistered(ctx, path) {
    // Resolved per call, like the rest of `workspace.ts`: the registry service may
    // appear on the context after this service is constructed.
    const registry = registryOf(ctx);
    if (registry === undefined)
        return false;
    if (registry.resolveByPath !== undefined && (await registry.resolveByPath(path)) !== undefined)
        return true;
    return (registry.list?.() ?? []).some(workspace => workspace.path === path);
}
function rowOf(entry, sessions, registered) {
    return {
        path: entry.path,
        branch: entry.branch,
        isMain: entry.isMain,
        isCurrent: entry.isCurrent,
        detached: entry.detached,
        branchMismatch: entry.branchMismatch,
        duplicateBranch: entry.duplicateBranch,
        head: entry.head,
        changes: entry.changes,
        upstream: entry.upstream,
        sessions,
        registered,
    };
}
function sessionSources(ctx) {
    return {
        sessions: ctx.get('sessions'),
        sessionPersistence: ctx.get('sessionPersistence'),
    };
}
/** Build the panel-facing service over one Cordis context. */
export function createWorktrunkService(ctx, config) {
    async function readRows(root, signal) {
        const [full, refs] = await Promise.all([
            listWorktreesFull(ctx, config.bin, root, signal),
            readSessionHeaders(sessionSources(ctx)),
        ]);
        const items = [];
        for (const entry of full.entries) {
            items.push(rowOf(entry, sessionsForWorktree(refs, entry.path), await isRegistered(ctx, entry.path)));
        }
        // One panel read = one `wt list`: that listing reports repo facts (root =
        // the workspace path it ran in) alongside every worktree of the repo, so a
        // second listing in the main worktree would only repeat them.
        return { repo: full.repo, items };
    }
    async function findEntry(root, branch, signal) {
        const entries = await listWorktrees(ctx, config.bin, root, signal);
        const entry = entries.find(candidate => candidate.branch === branch);
        if (entry === undefined)
            throw new WtError('NOT_FOUND', `no worktree for branch ${JSON.stringify(branch)} — check \`worktrunk_list\`.`);
        return entry;
    }
    return {
        async readPanel(input, signal) {
            const root = await workspacePath(ctx, input.workspaceId);
            const rows = await readRows(root, signal);
            let hooks = [];
            try {
                hooks = await hookSpecs(ctx, config.bin, root, signal);
            }
            catch {
                // Hook discovery is presentation data: a failure shows no hooks, it
                // never fails the panel read.
            }
            return { repo: rows.repo, items: rows.items, hooks };
        },
        async previewHooks(input, signal) {
            return hookSpecs(ctx, config.bin, await workspacePath(ctx, input.workspaceId), signal);
        },
        async createWorktree(input, signal) {
            const root = await workspacePath(ctx, input.workspaceId);
            await runWtOk(ctx, createArgs(config.bin, { branch: input.branch, base: input.base, hooks: input.skipHooks === true ? false : undefined }), root, signal);
            const entry = await findEntry(root, input.branch, signal);
            const registrationWarning = await registerWorkspace(ctx, entry.path, input.branch, config.labelPrefix);
            return {
                path: entry.path,
                branch: input.branch,
                hooksRan: input.skipHooks !== true,
                ...(registrationWarning === undefined ? {} : { registrationWarning }),
            };
        },
        async removeWorktree(input, signal) {
            const root = await workspacePath(ctx, input.workspaceId);
            const entry = await findEntry(root, input.branch, signal);
            // No supplied session cwd means "not running inside one": the guard is a no-op then.
            if (input.currentCwd !== undefined)
                assertNotSessionWorktree(entry, input.currentCwd, 'remove');
            await runWtOk(ctx, removeArgs(config.bin, { branch: input.branch, force: input.force, forceDeleteBranch: input.forceDeleteBranch, keepBranch: input.keepBranch }), root, signal);
            await unregisterWorkspace(ctx, entry.path);
            return { removed: true };
        },
        async mergeWorktree(input, signal) {
            const root = await workspacePath(ctx, input.workspaceId);
            const entry = await findEntry(root, input.branch, signal);
            if (input.keepWorktree !== true && input.currentCwd !== undefined) {
                assertNotSessionWorktree(entry, input.currentCwd, 'merge (it removes the worktree)');
            }
            await runWtOk(ctx, mergeArgs(config.bin, { target: input.target, keepCommit: input.keepCommit, keepWorktree: input.keepWorktree }), entry.path, signal);
            if (input.keepWorktree !== true)
                await unregisterWorkspace(ctx, entry.path);
            return { merged: true };
        },
        async copyIgnored(input, signal) {
            const cwd = input.path ?? (await workspacePath(ctx, input.workspaceId));
            await runWtOk(ctx, copyIgnoredArgs(config.bin, { force: input.force, requireInclude: input.requireInclude }), cwd, signal);
            return { ok: true };
        },
        async openWorktree(input) {
            const warning = await registerWorkspace(ctx, input.path, input.branch, config.labelPrefix);
            if (warning !== undefined)
                return { workspaceId: undefined };
            const registered = await (registryOf(ctx)?.resolveByPath(input.path) ?? Promise.resolve(undefined));
            return { workspaceId: registered?.id };
        },
        async ensureWorktreePermission(input) {
            return ensureWorktreeFullAccess({
                sessions: { get: sessionId => ctx.get('sessions')?.get(sessionId) },
                permissionPresets: ctx.get('permissionPresets'),
            }, input.sessionId);
        },
    };
}
