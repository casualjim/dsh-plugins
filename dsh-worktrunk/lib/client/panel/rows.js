import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Status chips for one row, in a stable order: dirty, detached, branch, ahead/behind. */
export function rowChips(row, t) {
    const chips = [];
    if (Object.values(row.changes).some(Boolean))
        chips.push(t('panel.dirty'));
    if (row.detached)
        chips.push(t('panel.detached'));
    if (row.branchMismatch)
        chips.push(t('panel.branchMismatch'));
    if (row.duplicateBranch)
        chips.push(t('panel.duplicateBranch'));
    if (row.upstream !== null && row.upstream.ahead > 0)
        chips.push(t('panel.ahead', { n: row.upstream.ahead }));
    if (row.upstream !== null && row.upstream.behind > 0)
        chips.push(t('panel.behind', { n: row.upstream.behind }));
    return chips;
}
/** One worktree row with `[current]`, HEAD, chips, and its session list. */
export function WorktreeRowView(props) {
    const { row, t } = props;
    const label = row.isMain ? t('panel.local') : row.branch;
    return (_jsxs("div", { className: "wt-row", "data-current": props.isCurrentSession ? 'true' : undefined, "data-selected": props.selected ? 'true' : undefined, children: [_jsxs("button", { type: "button", className: "wt-row-main", onClick: props.onSelect, "aria-expanded": props.expanded, children: [_jsx("span", { className: "wt-row-label", children: label }), props.isCurrentSession ? _jsx("span", { className: "wt-row-mark", children: t('panel.current') }) : null, row.head === null ? null : _jsx("span", { className: "wt-row-head", children: `${row.head.shortSha} ${row.head.subject}` })] }), _jsx("button", { type: "button", className: "wt-row-toggle", "aria-label": t('panel.sessions'), onClick: props.onToggle, children: `${t('panel.sessions')} (${row.sessions.length})` }), _jsx("div", { className: "wt-row-chips", children: rowChips(row, t).map(chip => _jsx("span", { className: "wt-chip", children: chip }, chip)) }), _jsxs("div", { className: "wt-row-actions", children: [_jsx("button", { type: "button", onClick: props.onNewSession, children: t('panel.newSession') }), _jsx("button", { type: "button", onClick: props.onCopyPath, children: t('panel.copyPath') }), _jsx("button", { type: "button", onClick: props.onSyncIgnored, children: t('panel.syncIgnored') }), row.detached ? null : _jsx("button", { type: "button", onClick: props.onMerge, children: t('panel.merge') }), row.isMain ? null : _jsx("button", { type: "button", onClick: props.onRemove, children: t('panel.remove') })] }), props.expanded
                ? (_jsxs("ul", { className: "wt-sessions", children: [row.sessions.length === 0 ? _jsx("li", { className: "wt-session-empty", children: t('panel.noSessions') }) : null, row.sessions.map(session => (_jsx("li", { children: _jsx("button", { type: "button", onClick: () => props.onOpenSession(session.id), children: props.sessionLabel(session.id) }) }, session.id)))] }))
                : null] }));
}
