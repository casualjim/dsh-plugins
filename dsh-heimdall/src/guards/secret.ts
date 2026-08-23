/**
 * secret-guard
 *
 * Project-scoped secret protection driven by a `.env.json` file at the
 * workspace root. The file is a flat object whose keys name environment
 * variables that are considered secret.
 *
 * Behavior:
 *   1. blocks bash commands referencing secret key names
 *   2. redacts secret values from bash output (plaintext,
 *      base64, rot13, reversed, hex, hexdump)
 * Ported from pi-heimdall/lib/guards/secret-guard.ts.
 *
 * @module dsh-heimdall/guards/secret
 */

import { readFileSync } from 'node:fs'

export type SecretValues = Record<string, string>

export interface SecretGuardState {
  secretKeys: string[]
  secretValues: SecretValues
  keyPattern: RegExp | null
}

export const REDACTED = '[REDACTED]'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rot13(input: string): string {
  return input.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
  })
}

function extractDecodedText(output: string): string | null {
  const lines = output.split('\n')
  const decoded: string[] = []
  let hasHexFormat = false

  for (const line of lines) {
    const pipeMatch = line.match(/\|([^|]+)\|/)
    if (pipeMatch) {
      hasHexFormat = true
      decoded.push(pipeMatch[1] ?? '')
      continue
    }

    const xxdMatch = line.match(
      /^(?:[0-9a-f]+:\s+)?(?:[0-9a-f]{2,4}(?:\s+[0-9a-f]{2,4})*)\s{2,}(\S.*)$/i,
    )
    if (xxdMatch) {
      hasHexFormat = true
      decoded.push(xxdMatch[1] ?? '')
      continue
    }

    if (/^\d+\s+/.test(line) && !line.includes('|')) {
      const parts = line.split(/^\d+\s+/)
      if (parts.length > 1 && parts[1] && /\S\s+\S/.test(parts[1])) {
        hasHexFormat = true
        decoded.push(parts[1].replace(/\s+/g, ''))
      }
    }
  }

  return hasHexFormat ? decoded.join('') : null
}

function containsSecretInHex(output: string, secretValues: SecretValues): boolean {
  const lower = output.toLowerCase()
  const stripped = lower.replace(/[^0-9a-f]/g, '')

  for (const [key, value] of Object.entries(secretValues)) {
    const fullValue = `${key}=${value}`
    const hex = Buffer.from(fullValue).toString('hex')

    if (lower.includes(hex)) return true
    if (stripped.includes(hex)) return true
  }
  return false
}

export function redactOutput(output: string, secretValues: SecretValues): string {
  const decoded = extractDecodedText(output)
  if (decoded) {
    for (const [key, value] of Object.entries(secretValues)) {
      if (!value) continue
      if (!decoded.includes(`${key}=`)) continue
      const tail = value.substring(0, Math.max(5, value.length - 2))
      if (decoded.includes(value) || decoded.includes(tail)) {
        return REDACTED
      }
    }
  }

  if (containsSecretInHex(output, secretValues)) {
    return REDACTED
  }

  let result = output

  for (const [key, value] of Object.entries(secretValues)) {
    if (!value) continue
    const fullValue = `${key}=${value}`

    result = result.split(fullValue).join(REDACTED)
    result = result
      .split(Buffer.from(fullValue).toString('base64'))
      .join(REDACTED)
    result = result
      .split(Buffer.from(`${fullValue}\n`).toString('base64'))
      .join(REDACTED)
    result = result.split(rot13(fullValue)).join(REDACTED)
    result = result.split(fullValue.split('').reverse().join('')).join(REDACTED)
  }

  result = result.replace(
    /(\b\w*(?:SECRET|KEY|TOKEN|PASSWORD|PASS|APIKEY|CREDENTIAL|PRIVATE)=)\S*/gi,
    `$1${REDACTED}`,
  )

  return result
}

/**
 * Load the secret manifest from `dotenvPath` (default `<workspaceRoot>/.env.json`).
 * Values in the JSON are ignored — only the keys matter; the actual values are
 * captured from `process.env`. Missing or unparseable file yields empty state.
 */
export function loadSecretGuardState(dotenvPath: string | undefined): SecretGuardState {
  const state: SecretGuardState = {
    secretKeys: [],
    secretValues: {},
    keyPattern: null,
  }

  let parsed: Record<string, unknown>
  try {
    if (!dotenvPath) return state
    parsed = JSON.parse(readFileSync(dotenvPath, 'utf8')) as Record<string, unknown>
  } catch {
    return state
  }

  if (!parsed || typeof parsed !== 'object') return state

  state.secretKeys = Object.keys(parsed).filter((key) => key !== 'sops')
  for (const key of state.secretKeys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.length > 0) {
      state.secretValues[key] = value
    }
  }

  if (state.secretKeys.length > 0) {
    const escaped = state.secretKeys.map(escapeRegex)
    state.keyPattern = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i')
  }

  return state
}

export function getSecretReference(command: string, state: SecretGuardState): string | null {
  if (!state.keyPattern) return null
  const match = command.match(state.keyPattern)
  return match?.[0] ?? null
}

export function getSecretGuardBlockReason(secretName: string): string {
  return (
    `Blocked: command references secret "${secretName}". ` +
    `This is protected by dsh-heimdall/secret-guard based on .env.json. ` +
    `Ask the user to run this command directly in their terminal if needed. ` +
    `Never attempt to bypass this protection or ask the user to disable it.`
  )
}
