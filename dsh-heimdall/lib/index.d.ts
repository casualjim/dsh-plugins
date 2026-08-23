/**
 * dsh-heimdall
 *
 * Guardian plugin for DeepSeek Harness that protects against accidental secret
 * exposure through tool calls. Ported from pi-heimdall; the sandbox-guard half
 * is intentionally omitted because DSH owns a native sandbox seam.
 *
 * Guards (all opt-out via `disabled`):
 *   - env-protect:          blocks `read` on .env files
 *   - kubectl-secret-guard: blocks risky kubectl invocations
 *   - sops-secret-guard:    blocks sops decryption
 *   - command-policy-guard: blocks repo policy violations
 *   - secret-guard:         blocks commands referencing secret names,
 *                           redacts secret values from tool result text
 *
 * Redaction runs on the `tools/post-execute` waterfall for every tool result
 * carrying text content, before the model-facing `tools/result` materialization
 * and the durable transcript record.
 *
 * Config: row config deep-merged over `.pi/heimdall.jsonc` at the session
 * workspace root. Secret keys come from `.env.json` at the workspace root;
 * actual values are captured from `process.env`.
 *
 * @module dsh-heimdall
 */
import type { Context } from '@deepseek-ai/cordis';
import { type Config } from './config.js';
export { type CommandPolicy, type Config, OPT_OUT_GUARD_IDS } from './config.js';
export declare const name = "dsh-heimdall";
export declare const inject: string[];
export declare function apply(ctx: Context, config?: Config): void;
