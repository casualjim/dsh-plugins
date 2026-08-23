import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import Tools from '@deepseek-ai/dsh-tools'
import { HeadroomCompressor, buildRetrieveTool } from '../src/index.js'

/**
 * Provider-facing wire-schema validation. Regression guard for the bug that
 * blocked every request: `parameters` is sent to the provider VERBATIM (the
 * tools registry snapshots it without compiling the defineTool DSL), so it
 * must be standard JSON Schema — `required` as an array at the object level,
 * never a per-property boolean (`true is not of type "array"`).
 */
function assertProviderValidSchema(schema: unknown): void {
  const walk = (node: unknown, path: string): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((entry, index) => walk(entry, `${path}[${index}]`))
      return
    }
    const object = node as Record<string, unknown>
    if ('required' in object) {
      expect(Array.isArray(object.required), `${path}.required must be an array, got ${JSON.stringify(object.required)}`).toBe(true)
    }
    if ('properties' in object) walk(object.properties, `${path}.properties`)
    if ('items' in object) walk(object.items, `${path}.items`)
    if ('oneOf' in object) walk(object.oneOf, `${path}.oneOf`)
  }
  walk(schema, 'schema')
}

function boot(): { ctx: Context; service: HeadroomCompressor } {
  const ctx = new Context()
  void new SystemPrompt(ctx, {} as never)
  void new Tools(ctx)
  void new TokenMeter(ctx)
  // Construction registers the retrieve tool through ctx.get('tools').
  const service = new HeadroomCompressor(ctx, { baseUrl: null })
  return { ctx, service }
}

describe('headroom_retrieve wire schema', () => {
  it('emits a provider-valid JSON Schema through the real tools registry', () => {
    const { ctx } = boot()
    const schemas = ctx.tools.schemas()
    const tool = schemas.find((entry) => entry.name === 'headroom_retrieve')
    expect(tool).toBeDefined()

    const parameters = tool!.parameters as {
      type: string
      required?: unknown
      properties?: Record<string, Record<string, unknown>>
    }
    // The exact shape that previously failed provider validation:
    // `required: true` inside the `hash` property.
    expect(parameters.properties?.hash?.required).toBeUndefined()
    expect(parameters.required).toEqual(['hash'])
    assertProviderValidSchema(parameters)
  })

  it('declares a registry-accepted output schema', () => {
    const { service } = boot()
    const definition = buildRetrieveTool(service)
    assertProviderValidSchema(definition.output.schema)
  })
})
