/**
 * Browser half of dsh-headroom: the Headroom card on the Plugins settings
 * tab. The host half registers the `headroom` settings namespace; this half
 * binds a `settingsScope` over it and registers a `settings.plugin.item`
 * card under the same key, which the Plugins section pairs with the
 * namespace without learning what it means. Reads ride the settings mirror;
 * writes go through `scope.set` (Host-validated, persisted by the
 * settings-file provider) — no custom RPC exists here.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.settingsScope augmentation into this program.
import type { SettingsScopeBinder } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the `settings.plugin.item` slot type into this program.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import { HeadroomCard } from './HeadroomCard.js'
import { decodeHeadroomSection } from './section-model.js'

export const name = 'dsh-headroom-client'

export const inject = ['slots', 'settingsScope']

/**
 * Narrowed browser faces. The slots registry is provided by packages this
 * one does not depend on (the UI renderer), so its read face lives here —
 * the same treatment dsh-worktrunk's client entry gives its optional
 * services.
 */
interface HeadroomClient {
  readonly settingsScope: SettingsScopeBinder
  readonly slots: {
    readonly register: SlotCore['register']
    inject(key: string, callback: () => () => void): () => void
  }
}

export function apply(ctx: ClientContext): void {
  const client = ctx as unknown as HeadroomClient
  const scope = client.settingsScope.bind({
    namespace: 'headroom',
    decode: decodeHeadroomSection,
  })
  client.slots.inject('settings.plugin.item', () => client.slots.register({
    name: 'settings.plugin.item',
    key: 'headroom',
    inject: () => ({ scope }),
  }, HeadroomCard))
}
