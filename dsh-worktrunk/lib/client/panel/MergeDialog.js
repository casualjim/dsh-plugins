import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Merge form. `wt merge` runs with the worktree as cwd, squashes and rebases,
 * fast-forwards the target, and removes the worktree unless told to keep it.
 */
import { useState } from 'react';
/** One line per pre-merge hook. */
export function mergeHooks(hooks, t) {
    return hooks.filter(hook => hook.type === 'pre-merge').map(hook => `${hook.type} ${hook.name}: ${hook.template}`);
}
/** Merge-worktree dialog. */
export function MergeDialog(props) {
    const { row, t } = props;
    const lines = mergeHooks(props.hooks, t);
    const [target, setTarget] = useState(props.defaultBranch);
    const [keepCommit, setKeepCommit] = useState(false);
    const [keepWorktree, setKeepWorktree] = useState(props.isCurrentSessionWorktree);
    return (_jsxs("form", { className: "wt-dialog wt-dialog-merge", onSubmit: (event) => {
            event.preventDefault();
            props.onSubmit({ target: target.trim() === '' ? props.defaultBranch : target.trim(), keepCommit, keepWorktree });
        }, children: [_jsx("h3", { children: t('merge.title') }), _jsx("p", { children: t('merge.description', { branch: row.branch, target }) }), _jsxs("label", { children: [t('merge.target'), _jsx("input", { value: target, onChange: event => setTarget(event.target.value) })] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: keepCommit, onChange: event => setKeepCommit(event.target.checked) }), t('merge.keepCommit')] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: keepWorktree, onChange: event => setKeepWorktree(event.target.checked) }), t('merge.keepWorktree')] }), lines.length === 0 ? null : (_jsxs("section", { className: "wt-hooks", children: [_jsx("h4", { children: t('merge.hooks') }), _jsx("ul", { children: lines.map(line => _jsx("li", { children: _jsx("code", { children: line }) }, line)) })] })), props.errorKey === undefined ? null : _jsx("p", { className: "wt-dialog-error", children: t(props.errorKey) }), _jsxs("footer", { children: [_jsx("button", { type: "button", onClick: props.onCancel, children: t('merge.cancel') }), _jsx("button", { type: "submit", disabled: props.pending === true, children: t('merge.submit') })] })] }));
}
