/**
 * Build-only Typert metadata bridge: the analyzer recognizes protocol meta
 * symbols through this ambient module, while runtime code imports the published
 * protocol package.
 */
declare module '@deepseek-ai/dsh-typert-protocol' {
	declare const TYPERT_LOOKUP_HOST: unique symbol
	declare const TYPERT_LOOKUP_WIRE: unique symbol
	declare const TYPERT_CONTEXT_WIRE: unique symbol

	/**
	 * Merge-extensible declarations that other DSH packages augment. Because this
	 * bridge *replaces* the published module for the whole build program, the
	 * augmentations (`declare module '@deepseek-ai/dsh-typert-protocol'` in
	 * dsh-session, dsh-agent, …) only resolve if these symbols exist here too.
	 */
	export interface TypertLookup<Host, Wire> {
		readonly [TYPERT_LOOKUP_HOST]: Host
		readonly [TYPERT_LOOKUP_WIRE]: Wire
	}

	export interface TypertContext<Wire> {
		readonly [TYPERT_CONTEXT_WIRE]: Wire
	}

	export interface TypertLookupMap {}

	export interface TypertContextMap {}

	export abstract class TypertRemoteService {
		readonly typertRemote: {
			readonly service: TypertRemoteService
			readonly serviceKey: string
			readonly namespace: string
		}
		protected constructor(ctx: unknown, serviceKey: string, options?: { readonly namespace?: string })
	}

	export function Remote<This extends object, Args extends unknown[], Result>(
		method: (this: This, ...args: Args) => Result,
		context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
	): void
}
