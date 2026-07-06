/**
 * PtyTerminal — the reusable terminal surface.
 *
 * This component is deliberately thin: all the hard state (xterm instance, WS,
 * session id, claudeAlive) lives in terminalStore so it survives unmount. The
 * component mounts the parked xterm node into a container, renders a status bar
 * with launch-profile buttons + a cwd picker, surfaces AI command-proposal
 * chips, and listens for the `pty:send-to-claude` handoff event.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerminalConfig, LaunchProfile } from '../contracts/config.js';
import {
  configureStore,
  connect,
  disposeEntry,
  fit,
  getEntry,
  handoffToAgent,
  launchProfile,
  mountEntry,
  subscribeEntry,
  unmountEntry,
  type TerminalEntry,
} from './terminalStore.js';
import { needsConfirmation, isCwdAllowed } from './launchProfiles.js';
import {
  HANDOFF_EVENT,
  getProposalsFor,
  runProposal,
  dismissProposal,
  setActiveSession,
  subscribe as subscribeShellContext,
  type HandoffDetail,
  type CommandProposal,
} from './shellContext.js';
import './PtyTerminal.css';

export interface PtyTerminalProps {
  slot: string;
  config: TerminalConfig;
  defaultMode?: 'direct' | 'cloud';
}

export function PtyTerminal({ slot, config, defaultMode = 'cloud' }: PtyTerminalProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [entry, setEntry] = useState<TerminalEntry | undefined>(() => getEntry(slot));
  const [proposals, setProposals] = useState<CommandProposal[]>([]);
  const [pendingProfile, setPendingProfile] = useState<LaunchProfile | null>(null);
  const [cwd, setCwd] = useState<string>(() => localStorage.getItem(config.storageKeys.lastCwd) ?? '');
  const [recentCwds, setRecentCwds] = useState<string[]>(() => readRecentCwds(config));

  // Configure the store once.
  useEffect(() => {
    configureStore(config);
  }, [config]);

  // Mount the parked terminal into this container; connect on first mount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    mountEntry(slot, container);
    setActiveSession(slot);

    const existing = getEntry(slot);
    if (existing && existing.status === 'idle') {
      void connect(slot, defaultMode);
    }

    const unsub = subscribeEntry(slot, () => setEntry({ ...(getEntry(slot) as TerminalEntry) }));
    setEntry(getEntry(slot));

    const ro = new ResizeObserver(() => fit(slot));
    ro.observe(container);

    return () => {
      ro.disconnect();
      unsub();
      unmountEntry(slot); // keep alive — do NOT dispose
    };
  }, [slot, defaultMode, config]);

  // Subscribe to AI command proposals for this slot.
  useEffect(() => {
    const refresh = () => setProposals(getProposalsFor(slot));
    refresh();
    return subscribeShellContext(refresh);
  }, [slot]);

  // Listen for AI -> terminal handoffs.
  useEffect(() => {
    const onHandoff = (e: Event) => {
      const detail = (e as CustomEvent<HandoffDetail>).detail;
      if (detail?.prompt) handoffToAgent(slot, detail.prompt);
    };
    window.addEventListener(HANDOFF_EVENT, onHandoff);
    return () => window.removeEventListener(HANDOFF_EVENT, onHandoff);
  }, [slot]);

  const rememberCwd = useCallback(
    (value: string) => {
      if (!value) return;
      localStorage.setItem(config.storageKeys.lastCwd, value);
      const next = [value, ...recentCwds.filter((c) => c !== value)].slice(0, 8);
      setRecentCwds(next);
      localStorage.setItem(config.storageKeys.recentCwds, JSON.stringify(next));
    },
    [config, recentCwds],
  );

  const runProfile = useCallback(
    (profile: LaunchProfile) => {
      if (!isCwdAllowed(profile, cwd)) {
        alert(`"${cwd}" is not in this profile's allowed working directories.`);
        return;
      }
      if (needsConfirmation(profile)) {
        setPendingProfile(profile);
        return;
      }
      rememberCwd(cwd);
      void launchProfile(slot, profile, cwd || undefined);
    },
    [slot, cwd, rememberCwd],
  );

  const confirmPending = useCallback(() => {
    if (!pendingProfile) return;
    rememberCwd(cwd);
    void launchProfile(slot, pendingProfile, cwd || undefined);
    setPendingProfile(null);
  }, [pendingProfile, slot, cwd, rememberCwd]);

  const acceptProposal = useCallback(
    (proposal: CommandProposal) => {
      const accepted = runProposal(slot, proposal.id);
      if (accepted) handoffToAgent(slot, accepted.command);
    },
    [slot],
  );

  const status = entry?.status ?? 'idle';

  return (
    <div className="pty-terminal" data-status={status}>
      <div className="pty-statusbar">
        <span className={`pty-dot pty-dot--${status}`} title={entry?.statusDetail ?? status} />
        <span className="pty-status-label">{statusLabel(status, entry)}</span>

        <input
          className="pty-cwd"
          list={`pty-cwd-${slot}`}
          placeholder="working directory (optional)"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          spellCheck={false}
        />
        <datalist id={`pty-cwd-${slot}`}>
          {recentCwds.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="pty-profiles">
          {config.launchProfiles.map((p) => (
            <button
              key={p.id}
              className={`pty-profile pty-profile--${p.riskLevel}`}
              onClick={() => runProfile(p)}
              title={`${p.command}${p.riskLevel === 'privileged' ? ' — privileged' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button className="pty-kill" onClick={() => disposeEntry(slot)} title="Close terminal & kill PTY">
          ✕
        </button>
      </div>

      {proposals.length > 0 && (
        <div className="pty-proposals">
          {proposals.map((p) => (
            <div className="pty-chip" key={p.id} title={p.rationale}>
              <code>{p.command}</code>
              <button onClick={() => acceptProposal(p)}>Run</button>
              <button className="pty-chip-dismiss" onClick={() => dismissProposal(slot, p.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pty-surface" ref={containerRef} />

      {pendingProfile && (
        <div className="pty-confirm" role="dialog" aria-modal="true">
          <div className="pty-confirm-card">
            <h4>Run a {pendingProfile.riskLevel} command?</h4>
            <code>{pendingProfile.command}</code>
            {cwd && <p className="pty-confirm-cwd">in {cwd}</p>}
            <p className="pty-confirm-warn">
              This launches a privileged process that can read and write your filesystem.
            </p>
            <div className="pty-confirm-actions">
              <button className="pty-confirm-cancel" onClick={() => setPendingProfile(null)}>
                Cancel
              </button>
              <button className="pty-confirm-go" onClick={confirmPending}>
                Run {pendingProfile.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string, entry?: TerminalEntry): string {
  if (entry?.claudeAlive) return 'agent ready';
  switch (status) {
    case 'ready':
      return entry?.mode === 'cloud' ? 'connected (cloud)' : 'connected';
    case 'connecting':
      return 'connecting…';
    case 'error':
      return entry?.statusDetail ?? 'error';
    case 'closed':
      return 'closed';
    default:
      return 'idle';
  }
}

function readRecentCwds(config: TerminalConfig): string[] {
  try {
    const raw = localStorage.getItem(config.storageKeys.recentCwds);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
