/**
 * Shared vocabulary for the dsh-headroom port.
 *
 * The bridge vocabulary is a direct port of noheadroom's `types.ts`
 * (https://github.com/raquezha/nothing/tree/main/packages/noheadroom):
 * OpenAI wire messages, the compression payload with `applyTo` mappings, and
 * the applied-result contract. Only `toolResult` mappings are ever applied
 * back to the DSH session; user/assistant messages are sent as compression
 * context and their returned changes are ignored.
 */
export {};
