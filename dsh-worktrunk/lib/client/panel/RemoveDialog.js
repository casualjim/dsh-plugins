import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Removal confirmation. `wt` owns the gates; this dialog only states them, so
 * its choices map one-to-one onto `--force`, `--force-delete`, and keeping the
 * branch. Both branch choices are always offered when a branch can be deleted —
 * the panel cannot know whether the branch is merged, and `wt remove` refuses an
 * unmerged branch without `--force-delete`.
 */
import { useState } from 'react';
/** What the dialog must tell the user, and which gates apply. */
export function removeDialogFacts(row, t) {
    const lines = [];
    const dirty = Object.values(row.changes).some(Boolean);
    if (dirty)
        lines.push(t('remove.dirty'));
    if (row.detached)
        lines.push(t('remove.detached'));
    if (row.branchMismatch)
        lines.push(t('panel.branchMismatch'));
    if (row.sessions.length > 0)
        lines.push(t('panel.sessions'));
    return { lines, needsForce: dirty, canDeleteBranch: !row.detached };
}
/** Submit gate: a dirty worktree may only go once the force acknowledgement is ticked. */
export function removeDialogBlocked(needsForce, force) {
    return needsForce && !force;
}
/**
 * Handler body, exported so the gate is drivable without a DOM: a blocked attempt
 * never reaches `submit`.
 */
export function removeDialogSubmit(facts, choice, submit) {
    if (removeDialogBlocked(facts.needsForce, choice.force))
        return;
    submit(choice);
}
/** Remove-worktree dialog. */
export function RemoveDialog(props) {
    const { row, t } = props;
    const facts = removeDialogFacts(row, t);
    const [force, setForce] = useState(false);
    const [forceDeleteBranch, setForceDeleteBranch] = useState(false);
    const [keepBranch, setKeepBranch] = useState(false);
    const blocked = removeDialogBlocked(facts.needsForce, force);
    return (_jsxs("form", { className: "wt-dialog wt-dialog-remove", onSubmit: (event) => {
            event.preventDefault();
            removeDialogSubmit(facts, { force, forceDeleteBranch, keepBranch }, props.onSubmit);
        }, children: [_jsx("h3", { children: t('remove.title') }), _jsx("p", { children: t('remove.description', { branch: row.branch, path: row.path }) }), facts.lines.length === 0 ? null : _jsx("ul", { children: facts.lines.map(line => _jsx("li", { children: line }, line)) }), facts.needsForce
                ? (_jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: force, onChange: event => setForce(event.target.checked) }), t('remove.force')] }))
                : null, facts.canDeleteBranch
                ? (_jsxs("label", { className: "wt-dialog-choice", children: [_jsx("input", { type: "checkbox", checked: forceDeleteBranch, onChange: event => setForceDeleteBranch(event.target.checked) }), t('remove.forceDeleteBranch'), _jsx("span", { className: "wt-dialog-hint", children: t('remove.branchUnmerged') })] }))
                : null, facts.canDeleteBranch
                ? (_jsxs("label", { className: "wt-dialog-choice", children: [_jsx("input", { type: "checkbox", checked: keepBranch, onChange: event => setKeepBranch(event.target.checked) }), t('remove.keepBranch')] }))
                : null, props.errorKey === undefined ? null : _jsx("p", { className: "wt-dialog-error", children: t(props.errorKey) }), _jsxs("footer", { children: [_jsx("button", { type: "button", onClick: props.onCancel, children: t('remove.cancel') }), _jsx("button", { type: "submit", disabled: blocked || props.pending === true, children: t('remove.submit') })] })] }));
}
