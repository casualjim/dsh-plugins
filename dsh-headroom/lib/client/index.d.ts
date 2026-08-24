/**
 * Browser half of dsh-headroom: the Headroom card on the Plugins settings
 * tab. The host half registers the `headroom` settings namespace; this half
 * binds a `settingsScope` over it and registers a `settings.plugin.item`
 * card under the same key, which the Plugins section pairs with the
 * namespace without learning what it means. Reads ride the settings mirror;
 * writes go through `scope.set` (Host-validated, persisted by the
 * settings-file provider) — no custom RPC exists here.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export declare const name = "dsh-headroom-client";
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
