/**
 * kubectl-secret-guard
 *
 * Blocks risky kubectl invocations:
 *   1. kubectl get secrets
 *   2. kubectl patch ... finalizers
 *   3. kubectl exec into pods accessing sensitive data
 * Ported from pi-heimdall/lib/guards/kubectl-secret-guard.ts.
 *
 * @module dsh-heimdall/guards/kubectl
 */
export declare const KUBECTL_BLOCKED: RegExp;
export declare function getKubectlBlockReason(command: string): string | null;
