import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSyncExternalStore } from 'react';
import { Input } from '@deepseek-ai/dsh-client-ui-primitives';
import { decodeHeadroomSection, EMPTY_HEADROOM_SECTION, } from './section-model.js';
const MODE_OPTIONS = [
    { value: 'normal', label: 'Normal (all output)' },
    { value: 'quiet', label: 'Quiet (suppress routine success)' },
    { value: 'silent', label: 'Silent (non-critical only)' },
];
/**
 * The Headroom settings page: enabled toggle, proxy URL, and output mode.
 * Values ride the host settings namespace through the injected scope; writes
 * are applied live by the host half and persisted to settings.yaml.
 */
export function HeadroomSection({ scope }) {
    const snapshot = useSyncExternalStore(scope.subscribe, scope.getSnapshot);
    const value = snapshot.value ?? EMPTY_HEADROOM_SECTION;
    const writable = snapshot.writable && snapshot.status === 'ready';
    if (snapshot.status === 'loading') {
        return _jsx("p", { children: "Loading Headroom settings\u2026" });
    }
    return (_jsxs("div", { children: [_jsxs("label", { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }, children: [_jsx("input", { type: "checkbox", checked: value.enabled, disabled: !writable, onChange: (event) => { void scope.set('enabled', event.target.checked); } }), "Compression enabled"] }), _jsxs("div", { style: { marginBottom: '12px' }, children: [_jsx("div", { style: { marginBottom: '4px' }, children: "Headroom proxy URL" }), _jsx(Input, { value: value.baseUrl ?? '', disabled: !writable, placeholder: "http://127.0.0.1:8788 \u2014 empty disables compression", spellCheck: false, onChange: (event) => {
                            const trimmed = event.target.value.trim();
                            void scope.set('baseUrl', trimmed === '' ? null : trimmed);
                        } }), value.baseUrl === null && _jsx("div", { style: { marginTop: '4px' }, children: "No proxy configured: compression degrades to a no-op with a warning." })] }), _jsxs("div", { children: [_jsx("div", { style: { marginBottom: '4px' }, children: "Output mode" }), _jsx("select", { value: value.mode, disabled: !writable, onChange: (event) => { void scope.set('mode', event.target.value); }, children: MODE_OPTIONS.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] })] }));
}
export { decodeHeadroomSection };
