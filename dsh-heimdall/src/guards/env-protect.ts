/**
 * env-protect
 *
 * Blocks `read` tool calls that target `.env` files.
 * Allows through example/template variants (.env.example, .env.sample, etc.)
 * Ported from pi-heimdall/lib/guards/env-protect.ts.
 *
 * @module dsh-heimdall/guards/env-protect
 */

import { basename } from 'node:path'

const EXAMPLE_SUFFIXES = ['example', 'sample', 'template', 'dist', 'defaults']

function isExampleVariant(name: string): boolean {
  const lower = name.toLowerCase()
  return EXAMPLE_SUFFIXES.some(
    (suffix) => lower.endsWith(`.${suffix}`) || lower.includes(`.${suffix}.`),
  )
}

export function isDotenvPath(rawPath: string): boolean {
  const path = rawPath.replace(/^@/, '')
  const name = basename(path).toLowerCase()

  if (name === '.env' || name === '.envrc') return true
  if (name.startsWith('.env.')) return !isExampleVariant(name)
  if (name.endsWith('.env')) return !isExampleVariant(name)

  return false
}

export function getEnvProtectReason(path: string): string {
  return (
    `Blocked: reading dotenv file "${path}" is forbidden. ` +
    `This is protected by dsh-heimdall/env-protect. ` +
    `If the user needs the contents, ask them to paste the relevant values directly. ` +
    `Never attempt to bypass this protection (cat, head, tail, xxd, base64, etc.) ` +
    `and never ask the user to disable it.`
  )
}
