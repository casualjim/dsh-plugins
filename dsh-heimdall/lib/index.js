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
import { dotenvPath, loadConfig } from './config.js';
import { getEnvProtectReason, isDotenvPath } from './guards/env-protect.js';
import { getKubectlBlockReason } from './guards/kubectl.js';
import { getSopsBlockReason } from './guards/sops.js';
import { checkCommand, getCommandPolicyBlockReason } from './guards/command-policy.js';
import { getSecretGuardBlockReason, getSecretReference, loadSecretGuardState, redactOutput, } from './guards/secret.js';
export { OPT_OUT_GUARD_IDS } from './config.js';
export const name = 'dsh-heimdall';
export const inject = ['sandboxPolicy'];
function readArg(exec, key) {
    const args = exec.arguments;
    return args?.[key];
}
function resolveState(ctx, exec, rowConfig) {
    const policy = ctx.sandboxPolicy.resolve({ session: exec.agent?.session });
    const workspaceRoot = policy.workspaceRoot;
    const loaded = loadConfig(workspaceRoot, rowConfig);
    const secret = loadSecretGuardState(dotenvPath(workspaceRoot, loaded.config));
    return { workspaceRoot, config: loaded.config, disabled: loaded.disabled, secret };
}
/** First matching block reason for one pending call, or undefined when allowed. */
function getBlockReason(exec, state) {
    if (exec.name === 'read') {
        if (state.disabled.has('env-protect'))
            return undefined;
        const path = readArg(exec, 'file_path');
        if (typeof path === 'string' && isDotenvPath(path))
            return getEnvProtectReason(path);
        return undefined;
    }
    if (exec.name !== 'bash')
        return undefined;
    const command = readArg(exec, 'command');
    if (typeof command !== 'string')
        return undefined;
    if (!state.disabled.has('kubectl-secret-guard')) {
        const reason = getKubectlBlockReason(command);
        if (reason)
            return reason;
    }
    if (!state.disabled.has('sops-secret-guard')) {
        const reason = getSopsBlockReason(command);
        if (reason)
            return reason;
    }
    if (!state.disabled.has('command-policy-guard')) {
        const policy = checkCommand(command, state.config.commandPolicies ?? []);
        if (policy)
            return getCommandPolicyBlockReason(policy);
    }
    if (!state.disabled.has('secret-guard')) {
        const secretName = getSecretReference(command, state.secret);
        if (secretName)
            return getSecretGuardBlockReason(secretName);
    }
    return undefined;
}
export function apply(ctx, config = {}) {
    ctx.on('tools/pre-execute', async (exec, next) => {
        const state = resolveState(ctx, exec, config);
        const reason = getBlockReason(exec, state);
        if (reason !== undefined)
            return { kind: 'deny', reason };
        return next();
    });
    ctx.on('tools/post-execute', async (exec, result, next) => {
        const decision = await next();
        if (decision.kind !== 'accept')
            return decision;
        if ('value' in decision)
            return decision;
        if (!decision.content && !result.content)
            return decision;
        const state = resolveState(ctx, exec, config);
        if (state.disabled.has('secret-guard'))
            return decision;
        const values = state.secret.secretValues;
        const content = decision.content ?? result.content;
        let changed = false;
        const nextContent = content.map((block) => {
            if (block.type !== 'text' || typeof block.text !== 'string')
                return block;
            const redacted = redactOutput(block.text, values);
            if (redacted === block.text)
                return block;
            changed = true;
            return { ...block, text: redacted };
        });
        if (!changed)
            return decision;
        return { kind: 'accept', content: nextContent, additionalContexts: decision.additionalContexts };
    });
}
