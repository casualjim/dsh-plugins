import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Create form. The hook list is the approval step `wt` would otherwise prompt
 * for, because creation runs with `--yes`; the toggle maps to `--no-hooks`.
 */
import { useState } from 'react';
/** The hook types `wt switch --create` runs; `pre-merge`/`post-remove` hooks are not in play here. */
const START_HOOK_TYPES = ['pre-start', 'post-start'];
/** Hook preview summary: one line per start hook, plus whether creation will block. */
export function createDialogSummary(hooks, t) {
    const start = hooks.filter(hook => START_HOOK_TYPES.includes(hook.type));
    return {
        title: start.length === 0 ? t('create.noHooks') : t('create.hooks'),
        lines: start.map(hook => `${hook.type} ${hook.name}: ${hook.template}`),
        blocking: start.some(hook => hook.type === 'pre-start'),
    };
}
/** Create-worktree dialog. */
export function CreateDialog(props) {
    const { t, hooks } = props;
    const [branch, setBranch] = useState('');
    const [base, setBase] = useState(props.defaultBranch);
    const [skipHooks, setSkipHooks] = useState(false);
    const summary = createDialogSummary(hooks, t);
    const canSubmit = branch.trim() !== '' && props.pending !== true;
    return (_jsxs("form", { className: "wt-dialog wt-dialog-create", onSubmit: (event) => {
            event.preventDefault();
            if (!canSubmit)
                return;
            const base2 = base.trim();
            props.onSubmit({ branch: branch.trim(), ...(base2 === '' ? {} : { base: base2 }), skipHooks });
        }, children: [_jsx("h3", { children: t('create.title') }), _jsx("p", { children: t('create.description', { repo: props.repo.forge ?? props.repo.root }) }), _jsxs("label", { children: [t('create.branch'), _jsx("input", { value: branch, onChange: event => setBranch(event.target.value), placeholder: t('create.branchPlaceholder'), autoFocus: true })] }), _jsxs("label", { children: [t('create.base'), _jsxs("select", { value: base, onChange: event => setBase(event.target.value), children: [props.currentBranch === undefined ? null : _jsx("option", { value: props.currentBranch, children: t('create.baseCurrent', { branch: props.currentBranch }) }), _jsx("option", { value: props.defaultBranch, children: props.defaultBranch })] })] }), _jsxs("section", { className: "wt-hooks", children: [_jsx("h4", { children: summary.title }), summary.lines.length === 0 ? null : (_jsx("ul", { children: summary.lines.map(line => _jsx("li", { children: _jsx("code", { children: line }) }, line)) })), summary.blocking ? _jsx("p", { className: "wt-hooks-blocking", children: t('create.blocking') }) : null, summary.lines.length === 0 ? null : (_jsxs("label", { className: "wt-hooks-skip", children: [_jsx("input", { type: "checkbox", checked: skipHooks, onChange: event => setSkipHooks(event.target.checked) }), t('create.skipHooks')] }))] }), props.pending === true ? _jsx("p", { className: "wt-dialog-working", children: t('create.working') }) : null, props.errorKey === undefined ? null : _jsx("p", { className: "wt-dialog-error", children: t(props.errorKey) }), _jsxs("footer", { children: [_jsx("button", { type: "button", onClick: props.onCancel, children: t('create.cancel') }), _jsx("button", { type: "submit", disabled: !canSubmit, children: t('create.submit') })] })] }));
}
