/**
 * Launch profiles.
 *
 * The original module hard-coded a single purple "Claude (yolo)" button. The
 * reusable capability models that as ONE launch profile among several, each
 * carrying a risk level and an optional confirmation gate. Claude is no longer
 * special — it's a profile whose command happens to be `claude`.
 */
import type { Terminal } from '@xterm/xterm';
import type { LaunchProfile } from '../contracts/config.js';

/** REPL prompt signatures we poll for after launching an interactive agent. */
const REPL_PROMPT_SIGNATURES = ['›', '❯', '>'];

/** Commands that mean "the agent/shell is exiting" — used to clear claudeAlive. */
const EXIT_COMMANDS = ['/exit', '/quit', 'exit'];

export function isExitCommand(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  return EXIT_COMMANDS.includes(trimmed);
}

/** Does this profile launch an interactive agent we should wait on (e.g. Claude)? */
export function isAgentProfile(profile: LaunchProfile): boolean {
  return profile.command.startsWith('claude');
}

/**
 * Build the keystrokes that launch a profile. On Windows we `cd /d` into the
 * working directory first; elsewhere a plain `cd`. The trailing \r submits.
 */
export function buildLaunchKeystrokes(profile: LaunchProfile, cwd?: string): string {
  const isWin = typeof navigator !== 'undefined' && /win/i.test(navigator.platform);
  const lines: string[] = [];
  if (cwd) lines.push(isWin ? `cd /d ${cwd}` : `cd "${cwd}"`);
  lines.push(profile.command);
  return lines.map((l) => l + '\r').join('');
}

/**
 * Poll xterm's buffer for a REPL prompt at column 0, up to timeoutMs.
 * Tolerates the welcome banner, theme picker, and login flow. Resolves true on
 * detection, false on timeout.
 */
export function waitForReplPrompt(term: Terminal, timeoutMs = 30_000): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (hasPromptAtColumnZero(term)) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 250);
    };
    tick();
  });
}

function hasPromptAtColumnZero(term: Terminal): boolean {
  const buf = term.buffer.active;
  // Scan the last few lines for a prompt signature at the start of the line.
  const bottom = buf.baseY + buf.cursorY;
  for (let y = Math.max(0, bottom - 4); y <= bottom; y++) {
    const line = buf.getLine(y);
    if (!line) continue;
    const text = line.translateToString(true);
    const firstChar = text.replace(/^\s+/, '').charAt(0);
    if (REPL_PROMPT_SIGNATURES.includes(firstChar)) return true;
  }
  return false;
}

/** Should we prompt the user before running this profile? */
export function needsConfirmation(profile: LaunchProfile): boolean {
  return profile.requiresConfirmation || profile.riskLevel === 'privileged';
}

/** Validate a cwd against a profile's allowlist (if it declares one). */
export function isCwdAllowed(profile: LaunchProfile, cwd: string | undefined): boolean {
  if (!profile.allowedWorkingDirectories || !cwd) return true;
  const normalized = cwd.replace(/\\/g, '/').toLowerCase();
  return profile.allowedWorkingDirectories.some((allowed) => {
    const a = allowed.replace(/^~\//, '').replace(/\\/g, '/').toLowerCase();
    return normalized.includes(a);
  });
}
