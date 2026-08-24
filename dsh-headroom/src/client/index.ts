/**
 * Browser half of dsh-headroom: the Headroom card on the Plugins settings
 * tab. The host half registers the `headroom` settings namespace; this half
 * binds a `settingsScope` over it and registers a `settings.plugin.item`
 * card under the same key, which the Plugins section pairs with the
 * namespace without learning what it means. Reads ride the settings mirror;
 * writes go through `scope.set` (Host-validated, persisted by the
 * settings-file provider) — no custom RPC exists here.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ctx.settingsScope into this program.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls ctx.slots into this program.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: declares the `settings.plugin.item` slot type.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import { HeadroomCard } from './HeadroomCard.js'
import { decodeHeadroomSection } from './section-model.js'

export const name = 'dsh-headroom-client'

export const inject = ['slots', 'settingsScope']

export function apply(ctx: ClientContext): void {
  const scope = ctx.settingsScope.bind({
    namespace: 'headroom',
    decode: decodeHeadroomSection,
  })
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'headroom',
    inject: () => ({ scope }),
  }, HeadroomCard))
}
