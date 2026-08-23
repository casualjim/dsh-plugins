/**
 * command-policy-guard
 *
 * Blocks bash commands that violate repo policy. Uses `shell-quote` for proper
 * shell tokenization with bypass hardening.
 * Ported from pi-heimdall/lib/guards/command-policy-guard.ts.
 *
 * @module dsh-heimdall/guards/command-policy
 */
import type { CommandPolicy } from '../config.ts';
/**
 * shell-quote treats newlines as plain whitespace and lets `#` comments run
 * to the end of the string. Multi-line commands then collapse into one
 * segment and hide a blocked command behind a harmless prefix
 * (`cd /x\ncargo test`), and anything after a comment disappears entirely.
 * Bash instead treats unquoted newlines as command separators and comments
 * as line-scoped. Rewrite the command to match: separator newlines become
 * `;`, comments are cut at their line, and quoted newlines and heredoc
 * bodies pass through untouched.
 */
export declare function splitShellLines(command: string): string;
export declare function checkCommand(command: string, policies: CommandPolicy[], nonBare?: boolean): CommandPolicy | null;
export declare function getCommandPolicyBlockReason(policy: CommandPolicy): string;
