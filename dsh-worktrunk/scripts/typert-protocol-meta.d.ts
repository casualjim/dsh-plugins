/**
 * Build-only Typert metadata bridge: the analyzer recognizes protocol meta
 * symbols through this ambient module, while runtime code imports the published
 * protocol package.
 */
declare module '@deepseek-ai/dsh-typert-protocol' {
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
