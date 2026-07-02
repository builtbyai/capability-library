/** storm-to-rag -- When storm-data matches an event near a known property, fetch the full event report -> intake -> chunk -> embed for RAG over historical storm context. */
import { bus, jobs, type CoreEvent } from '@multimarcdown/core';

export function register(): () => void {
  return bus.on('storm.event.matched', async (e: CoreEvent) => {
    const evt = e.payload as { eventId: string; lat: number; lng: number };
    await jobs.enqueue('storm-data', 'fetch-full-report', { eventId: evt.eventId });
    // storm-data emits storm.report.fetched with an intakeObjectId; intake routes
    // to document-ingestion via text/markdown MIME, then knowledge-index embeds.
  });
}
