import { useState, useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import {
  EMPTY_HEADROOM_SECTION,
  type HeadroomModeValue,
  type HeadroomSectionValue,
} from './section-model.js'

export interface HeadroomCardProps {
  readonly scope: SettingsScope<HeadroomSectionValue>
}

const MODE_OPTIONS: ReadonlyArray<{ value: HeadroomModeValue; label: string }> = [
  { value: 'normal', label: 'Normal — all output' },
  { value: 'quiet', label: 'Quiet — suppress routine success' },
  { value: 'silent', label: 'Silent — non-critical only' },
]

// Visual language mirrors the shipped plugin cards (PluginCard/ValueField in
// @deepseek-ai/dsh-client-ui-settings-plugins) via the shared theme tokens,
// because those components are not exported for out-of-repo registrants.
const CARD: CSSProperties = {
  listStyle: 'none',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 12,
  background: 'var(--dsw-alias-bg-layer-3)',
  overflow: 'hidden',
}

const HEADER: CSSProperties = {
  width: '100%',
  appearance: 'none',
  border: 0,
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '14px 16px',
}

const NAME: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.4,
  color: 'var(--dsw-alias-label-primary)',
}

const DESCRIPTION: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary)',
}

const PENDING: CSSProperties = {
  flex: 'none',
  borderRadius: 999,
  padding: '1px 8px',
  fontSize: 11,
  lineHeight: '17px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  background: 'var(--dsw-alias-bg-module-platform)',
  color: 'var(--dsw-alias-label-secondary)',
}

const BODY: CSSProperties = {
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  margin: '0 16px',
  padding: '12px 0 8px',
}

const FIELD: CSSProperties = {
  marginBottom: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const FIELD_HEAD: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

const LABEL: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary)',
}

const HINT: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary)',
}

const INPUT: CSSProperties = {
  font: 'inherit',
  fontSize: 13,
  color: 'var(--dsw-alias-label-primary)',
  background: 'var(--dsw-alias-bg-layer-3)',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  padding: '6px 10px',
  width: '100%',
  boxSizing: 'border-box',
}

const BADGE: CSSProperties = {
  borderRadius: 999,
  padding: '1px 8px',
  fontSize: 11,
  lineHeight: '17px',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  background: 'var(--dsw-alias-bg-module-platform)',
  color: 'var(--dsw-alias-label-secondary)',
}

const RESET: CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'none',
  font: 'inherit',
  fontSize: 12,
  color: 'var(--dsw-alias-label-secondary)',
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
}

const FOOTER: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 0 4px',
  borderTop: '1px solid var(--dsw-alias-border-l2)',
}

const DISCARD: CSSProperties = {
  appearance: 'none',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  padding: '5px 14px',
  font: 'inherit',
  fontSize: 13,
  lineHeight: 1.5,
  cursor: 'pointer',
  background: 'none',
  color: 'var(--dsw-alias-label-secondary)',
}

const SAVE: CSSProperties = {
  ...DISCARD,
  borderColor: 'transparent',
  background: 'var(--dsw-alias-label-primary)',
  color: 'var(--dsw-alias-bg-layer-3)',
}

const DISABLED: CSSProperties = { opacity: 0.4, cursor: 'default' }

/**
 * Headroom plugin card for the Plugins settings tab: staged edits over the
 * `headroom` settings namespace, saved field-by-field through the scope.
 */
export function HeadroomCard({ scope }: HeadroomCardProps): ReactNode {
  const snapshot = useSyncExternalStore(
    (listener: () => void) => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const value = snapshot.value ?? EMPTY_HEADROOM_SECTION
  const available = snapshot.status === 'ready'
  const writable = snapshot.writable
  const user = typeof snapshot.user === 'object' && snapshot.user !== null && !Array.isArray(snapshot.user)
    ? snapshot.user as Record<string, unknown>
    : {}

  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(value.enabled)
  const [baseUrl, setBaseUrl] = useState(value.baseUrl ?? '')
  const [mode, setMode] = useState<HeadroomModeValue>(value.mode)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const dirty = enabled !== value.enabled
    || baseUrl !== (value.baseUrl ?? '')
    || mode !== value.mode

  // Re-seed drafts whenever the Host accepted value changes underneath us;
  // never clobber edits the user has staged.
  useEffect(() => {
    if (dirty) return
    setEnabled(value.enabled)
    setBaseUrl(value.baseUrl ?? '')
    setMode(value.mode)
  }, [value, dirty])

  if (!available) return null

  const save = (): void => {
    setSaving(true)
    setFailed(false)
    const writes: Promise<void>[] = []
    if (enabled !== value.enabled) writes.push(scope.set('enabled', enabled))
    if (baseUrl !== (value.baseUrl ?? '')) {
      writes.push(scope.set('baseUrl', baseUrl.trim() === '' ? null : baseUrl.trim()))
    }
    if (mode !== value.mode) writes.push(scope.set('mode', mode))
    void Promise.all(writes).then(
      () => { setSaving(false) },
      () => { setSaving(false); setFailed(true) },
    )
  }

  const overridden = (field: string): boolean => field in user

  const field = (
    id: string,
    label: string,
    hint: string,
    fieldName: string,
    control: ReactNode,
  ): ReactNode => (
    <div style={FIELD}>
      <div style={FIELD_HEAD}>
        <label style={LABEL} htmlFor={id}>{label}</label>
        {overridden(fieldName) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={BADGE}>Overridden</span>
            <button
              type="button"
              style={RESET}
              disabled={!writable}
              onClick={() => { void scope.unset(fieldName) }}
            >
              Reset
            </button>
          </span>
        )}
      </div>
      {control}
      <p style={HINT}>{hint}</p>
    </div>
  )

  return (
    <li style={{ ...CARD, background: open ? 'var(--dsw-alias-bg-layer-2)' : CARD.background }}>
      <button
        type="button"
        style={HEADER}
        aria-expanded={open}
        onClick={() => { setOpen(!open) }}
      >
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={NAME}>Headroom</span>
          <span style={DESCRIPTION}>Context compression for tool results, over a configured Headroom proxy.</span>
        </span>
        {dirty && !open ? <span style={PENDING}>Unsaved</span> : null}
        <span style={{ flex: 'none', color: 'var(--dsw-alias-label-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .16s', display: 'flex' }}>
          <IconChevronDownOutline14 />
        </span>
      </button>
      {open && (
        <div style={BODY}>
          {!writable && <p style={HINT}>Settings are read-only in this browser.</p>}
          {field(
            'plugin-config-headroom-enabled',
            'Compression enabled',
            'When off, Headroom never compresses tool results.',
            'enabled',
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="plugin-config-headroom-enabled"
                type="checkbox"
                checked={enabled}
                disabled={!writable}
                onChange={(event) => { setEnabled(event.target.checked) }}
              />
              <span style={LABEL}>Compress oversized tool results before the model reads them</span>
            </label>,
          )}
          {field(
            'plugin-config-headroom-url',
            'Proxy URL',
            'Empty disables compression (degraded no-op with a warning). Nothing is spawned or managed by this plugin.',
            'baseUrl',
            <input
              id="plugin-config-headroom-url"
              style={INPUT}
              value={baseUrl}
              disabled={!writable}
              placeholder="http://127.0.0.1:8788"
              spellCheck={false}
              onChange={(event) => { setBaseUrl(event.target.value) }}
            />,
          )}
          {field(
            'plugin-config-headroom-mode',
            'Output mode',
            'Controls how much the plugin logs about its compression passes.',
            'mode',
            <select
              id="plugin-config-headroom-mode"
              style={INPUT}
              value={mode}
              disabled={!writable}
              onChange={(event) => { setMode(event.target.value as HeadroomModeValue) }}
            >
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>,
          )}
          <div style={FOOTER}>
            {failed && <span style={{ ...HINT, flex: 1, color: 'var(--dsw-alias-label-error)' }}>Save failed; values unchanged.</span>}
            <button
              type="button"
              style={{ ...DISCARD, ...(!dirty || saving ? DISABLED : {}) }}
              disabled={!dirty || saving}
              onClick={() => {
                setEnabled(value.enabled)
                setBaseUrl(value.baseUrl ?? '')
                setMode(value.mode)
              }}
            >
              Discard
            </button>
            <button
              type="button"
              style={{ ...SAVE, ...(!dirty || saving ? DISABLED : {}) }}
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
