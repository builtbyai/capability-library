/**
 * @multimarcdown/ui — reusable visual components.
 * Add new presentational components here (CommandProposalChip, JobStatusBadge,
 * UploadZone, MapCanvas, …) following the StatusBadge pattern: stateless, inline
 * styles or a co-located CSS module, no backend coupling.
 */
export { StatusBadge, type StatusBadgeProps, type HealthState } from './StatusBadge.js';
export { JobStatusBadge, type JobStatusBadgeProps, type JobLifecycle } from './JobStatusBadge.js';
export {
  CommandProposalChip,
  type CommandProposalChipProps,
  type CommandProposal,
} from './CommandProposalChip.js';
export { UploadZone, type UploadZoneProps } from './UploadZone.js';
export { Pane, type PaneProps } from './Pane.js';
