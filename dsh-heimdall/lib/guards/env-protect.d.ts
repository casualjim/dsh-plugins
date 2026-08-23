/**
 * env-protect
 *
 * Blocks `read` tool calls that target `.env` files.
 * Allows through example/template variants (.env.example, .env.sample, etc.)
 * Ported from pi-heimdall/lib/guards/env-protect.ts.
 *
 * @module dsh-heimdall/guards/env-protect
 */
export declare function isDotenvPath(rawPath: string): boolean;
export declare function getEnvProtectReason(path: string): string;
