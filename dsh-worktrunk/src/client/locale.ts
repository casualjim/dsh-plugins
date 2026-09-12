import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace owned by this plugin. */
export const WORKTRUNK_NS = 'worktrunk' as const

/** English dictionary. Adding `zh` later is a data-only change. */
export const en = {
	'panel.label': 'Worktrees',
	'panel.title': 'Worktrees',
	'panel.refresh': 'Refresh',
	'panel.empty': 'No worktrees yet. Create one to start working in a parallel checkout.',
	'panel.loading': 'Loading worktrees…',
	'panel.retry': 'Retry',
	'panel.local': 'Local',
	'panel.detached': 'Detached HEAD',
	'panel.branchMismatch': 'Branch changed in Git',
	'panel.duplicateBranch': 'Branch checked out twice',
	'panel.dirty': 'Uncommitted changes',
	'panel.ahead': '{n} ahead',
	'panel.behind': '{n} behind',
	'panel.current': 'Current session',
	'panel.copyPath': 'Copy path',
	'panel.open': 'Open in DSH',
	'panel.newSession': 'New session here',
	'panel.syncIgnored': 'Sync gitignored files',
	'panel.merge': 'Merge into…',
	'panel.remove': 'Remove',
	'panel.create': 'Create worktree',
	'panel.sessions': 'Sessions',
	'panel.noSessions': 'No sessions yet',
	'create.title': 'Create worktree',
	'create.description': 'A new branch and worktree in {repo}. Worktrees live outside the repository.',
	'create.branch': 'New branch name',
	'create.base': 'Base branch',
	'create.baseCurrent': 'Current branch ({branch})',
	'create.hooks': 'Setup steps from .config/wt.toml',
	'create.noHooks': 'This repository configures no start hooks.',
	'create.skipHooks': 'Skip start hooks this once (no dependency install, no gitignored file copy)',
	'create.blocking': 'A pre-start hook runs before the worktree is ready and can take a while.',
	'create.submit': 'Create',
	'create.cancel': 'Cancel',
	'create.working': 'Creating worktree and running setup steps…',
	'remove.title': 'Remove worktree',
	'remove.description': 'Remove {branch} at {path} from disk? Its sessions keep their history but lose this directory.',
	'remove.dirty': 'This worktree has uncommitted changes.',
	'remove.force': 'Remove anyway, discarding uncommitted changes',
	'remove.branchUnmerged': 'The branch is not merged; deleting it needs an explicit choice.',
	'remove.forceDeleteBranch': 'Also delete the branch even though it is not merged',
	'remove.keepBranch': 'Keep the branch, remove only the worktree',
	'remove.detached': 'This worktree has a detached HEAD; no branch will be deleted.',
	'remove.submit': 'Remove',
	'remove.cancel': 'Cancel',
	'merge.title': 'Merge worktree',
	'merge.description': 'Squash and rebase {branch} into {target}, fast-forward the target, then remove the worktree.',
	'merge.target': 'Target branch',
	'merge.keepCommit': 'Preserve commit history (no squash)',
	'merge.keepWorktree': 'Keep the worktree after merging',
	'merge.hooks': 'Pre-merge hooks from .config/wt.toml',
	'merge.submit': 'Merge',
	'merge.cancel': 'Cancel',
	'permission.title': 'Enable Worktree Full access?',
	'permission.description':
		'This session works inside a git worktree, whose .git entry points at metadata in the main repository. Enabling full access disables filesystem confinement for this session only, so git writes can reach that metadata. Approval prompts stay on; network and process policy are unchanged. Target: {cwd}',
	'permission.acknowledge': 'I understand and want to continue',
	'permission.enable': 'Enable full access',
	'permission.cancel': 'Cancel',
	'permission.retained': 'The session was kept; confirm full access to retry. It was not opened.',
	'permission.userRestricted': 'Your own permission restriction was preserved; this session was not elevated.',
	'permission.unavailable': 'The permission preset is unavailable in this profile; the session was kept but full access is not confirmed.',
	'error.wtNotInstalled': 'worktrunk is not installed. Install it with `brew install worktrunk` or `cargo install worktrunk`, then restart DSH.',
	'error.notARepo': 'This workspace is not a git repository.',
	'error.noInitialCommit': 'This repository has no commit yet.',
	'error.noLocalBranch': 'This repository has no local branch yet.',
	'error.wtFailed': 'worktrunk failed: {reason}',
	'error.busy': 'Another worktrunk operation is in progress; retry shortly.',
	'error.sessionWorktree': 'That would affect the worktree this session runs inside; do it from another session.',
	'error.notFound': 'That worktree no longer exists; refresh the panel.',
	'error.hookFailed': 'A setup step failed: {reason}',
	'error.presetUnavailable': 'The worktree full-access preset is not installed in this profile.',
	'error.unknown': 'The worktree operation failed: {reason}',
} satisfies Record<string, string>

export type WorktrunkLocaleKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
	interface LocaleNamespaceMap {
		worktrunk: WorktrunkLocaleKey
	}
}
