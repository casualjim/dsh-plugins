import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The acknowledgement step before a session inside a worktree is elevated. It
 * states the mechanism, the blast radius, and what does not change.
 */
import { useState } from 'react';
/** Full-access acknowledgement dialog. */
export function PermissionDialog(props) {
    const { t } = props;
    const [acknowledged, setAcknowledged] = useState(false);
    const [pending, setPending] = useState(false);
    const submit = () => {
        if (!acknowledged || pending)
            return;
        setPending(true);
        void (async () => {
            try {
                await props.onConfirm();
            }
            catch {
                // The entry turns a failed attempt into its own notice.
            }
            finally {
                setPending(false);
            }
        })();
    };
    return (_jsxs("form", { className: "wt-dialog wt-dialog-permission", onSubmit: (event) => {
            event.preventDefault();
            submit();
        }, children: [_jsx("h3", { children: t('permission.title') }), _jsx("p", { children: t('permission.description', { cwd: props.cwd }) }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: acknowledged, onChange: event => setAcknowledged(event.target.checked) }), t('permission.acknowledge')] }), _jsxs("footer", { children: [_jsx("button", { type: "button", onClick: props.onCancel, children: t('permission.cancel') }), _jsx("button", { type: "submit", disabled: !acknowledged || pending, children: t('permission.enable') })] })] }));
}
