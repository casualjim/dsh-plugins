/**
 * sops-secret-guard
 *
 * Blocks sops invocations that would decrypt content: `sops decrypt`,
 * `sops -d`, `sops --decrypt`, `sops exec-env`, `sops exec-file`, `sops edit`,
 * and bare `sops <file>`.
 * Ported from pi-heimdall/lib/guards/sops-secret-guard.ts.
 *
 * @module dsh-heimdall/guards/sops
 */
export declare const SOPS_DECRYPT: RegExp;
export declare function getSopsBlockReason(command: string): string | null;
