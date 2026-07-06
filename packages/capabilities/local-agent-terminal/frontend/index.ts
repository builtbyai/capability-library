/** Frontend public surface for the local-agent-terminal capability. */
export { PtyTerminal, type PtyTerminalProps } from './PtyTerminal.js';
export {
  configureStore,
  connect,
  launchProfile,
  handoffToAgent,
  disposeEntry,
  getEntry,
  type TerminalEntry,
  type TerminalStatus,
  type TerminalMode,
} from './terminalStore.js';
export * from './launchProfiles.js';
export {
  registerSession,
  setActiveSession,
  getActiveScrollback,
  queueProposal,
  dispatchHandoff,
  HANDOFF_EVENT,
  type CommandProposal,
  type HandoffDetail,
} from './shellContext.js';
