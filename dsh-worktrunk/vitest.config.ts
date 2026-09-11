import { transform } from 'esbuild'
import { defineConfig } from 'vitest/config'

/**
 * Vitest 5 transforms with Vite 8's oxc, which only implements legacy
 * decorators; this plugin lowers the TC39 decorators the host Remote service
 * uses before oxc sees them. Remove it when oxc gains TC39 decorator support.
 */
const tc39Decorators = {
  name: 'worktrunk-tc39-decorators',
  enforce: 'pre' as const,
  async transform(code: string, id: string) {
    if (!/\.[cm]?tsx?$/.test(id) || !/^\s*@/mu.test(code)) return null
    const result = await transform(code, {
      loader: id.endsWith('.tsx') ? 'tsx' : 'ts',
      target: 'node22',
      jsx: 'automatic',
      sourcemap: true,
      sourcefile: id,
    })
    return { code: result.code, map: result.map }
  },
}

export default defineConfig({
  plugins: [tc39Decorators],
  test: {
    environment: 'node',
  },
})
