import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Renders the branch glyph at the sidebar-requested size. */
export function PanelIcon({ size, active }) {
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": "true", "data-active": active ? 'true' : undefined, children: [_jsx("path", { d: "M4 2v9a2 2 0 0 0 2 2h3", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("circle", { cx: "4", cy: "2.5", r: "1.5", fill: "currentColor" }), _jsx("circle", { cx: "11", cy: "13", r: "1.5", fill: "currentColor" }), _jsx("circle", { cx: "11", cy: "5.5", r: "1.5", fill: "currentColor" }), _jsx("path", { d: "M11 7v4.5", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }));
}
