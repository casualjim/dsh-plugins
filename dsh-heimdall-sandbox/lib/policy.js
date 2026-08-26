/**
 * Build one heimdall-sandbox policy document from a resolved DSH
 * {@link SandboxPolicy} plus the provider's deployment-wide exceptions.
 *
 * Mode mapping (heimdall >= 0.1.45):
 * - `read-only`: a DECLARED but empty `filesystem` block confines read-only.
 *   The profile keeps cwd/HOME/platform reads and grants its platform temp
 *   areas — slightly wider than DSH's read-only promise; deployments that
 *   want the DSH-exact shape add those dirs to `deniedPaths`.
 * - `workspace-write`: explicit writable list = workspace root + configured
 *   extra roots. Platform temps come from heimdall's profile defaults,
 *   matching DSH's `writableRoots` promise without restating them.
 * - Deny paths pass through verbatim in heimdall's own syntax (tilde
 *   expansion and ordered `!` negations included) — no reinterpretation.
 *
 * @module dsh-heimdall-sandbox/policy
 */
/**
 * Map one confined call onto its heimdall-sandbox policy document.
 * @param argv - the exact caller argv (program plus arguments).
 * @param policy - the resolved per-call file-effect policy.
 * @param options - the provider's configured exception lists.
 * @returns the policy document to serialize for `exec --policy`.
 */
export function buildPolicyDocument(argv, policy, options = {}) {
    if (policy.mode === 'danger-full-access') {
        throw new Error('heimdall-sandbox: danger-full-access bypasses the sandbox provider and must never reach confine()');
    }
    const filesystem = {};
    if (policy.mode === 'workspace-write') {
        filesystem.writable = [policy.workspaceRoot, ...(options.extraWritableRoots ?? [])];
    }
    if (options.deniedPaths?.length) {
        filesystem.deny = [...options.deniedPaths];
    }
    return {
        cwd: policy.workspaceRoot,
        command: [...argv],
        // inherit: the consumer owns the child's pipes; heimdall passes stdio through.
        stdio: 'inherit',
        filesystem,
    };
}
