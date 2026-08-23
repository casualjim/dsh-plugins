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
export type SecretValues = Record<string, string>;
export interface SecretGuardState {
    secretKeys: string[];
    secretValues: SecretValues;
    keyPattern: RegExp | null;
}
export declare const REDACTED = "[REDACTED]";
export declare function redactOutput(output: string, secretValues: SecretValues): string;
/**
 * Load the secret manifest from `dotenvPath` (default `<workspaceRoot>/.env.json`).
 * Values in the JSON are ignored — only the keys matter; the actual values are
 * captured from `process.env`. Missing or unparseable file yields empty state.
 */
export declare function loadSecretGuardState(dotenvPath: string | undefined): SecretGuardState;
export declare function getSecretReference(command: string, state: SecretGuardState): string | null;
export declare function getSecretGuardBlockReason(secretName: string): string;
