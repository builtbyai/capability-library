/**
 * Define your capability's normalized events here. Other capabilities subscribe
 * via the core EventBus (`bus.onPrefix('<your-prefix>.', handler)`), so keep the
 * payloads stable and provider-agnostic.
 */
export interface ExampleEvent {
  event: 'example.thing.happened';
  id: string;
  at: string;
}

export type CapabilityEvent = ExampleEvent;
