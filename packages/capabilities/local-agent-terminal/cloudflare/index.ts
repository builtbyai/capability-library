/**
 * Worker entry for the local-agent-terminal relay.
 *
 * Paste the /v1/pty/* block into your existing signaling worker's fetch handler,
 * or use this file directly if the terminal relay is standalone. Auth happens
 * here (AGENT_SECRET for the bridge, API_SECRET for clients); then we fetch()
 * into the singleton PtyRouter DO.
 */
export { PtyRouter } from './pty-router.js';

interface Env {
  PTY_ROUTER: DurableObjectNamespace;
  AGENT_SECRET?: string;
  API_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/v1/pty/')) {
      const token =
        url.searchParams.get('token') || request.headers.get('X-Dashboard-Token') || '';
      const agentSecret = env.AGENT_SECRET || '';
      const apiSecret = env.API_SECRET || '';
      const isBridgeAuth = !!token && token === agentSecret;
      const isClientAuth = !!token && (token === apiSecret || token === agentSecret);

      let role: 'bridge' | 'client' | null = null;
      if (url.pathname === '/v1/pty/bridge') {
        if (!isBridgeAuth) return new Response('unauthorized', { status: 401 });
        role = 'bridge';
      } else if (url.pathname === '/v1/pty/client') {
        if (!isClientAuth) return new Response('unauthorized', { status: 401 });
        role = 'client';
      } else if (url.pathname === '/v1/pty/status') {
        const id = env.PTY_ROUTER.idFromName('default');
        return env.PTY_ROUTER.get(id).fetch(
          new Request(url.toString().replace('/v1/pty/status', '/'), request),
        );
      }

      if (role) {
        const id = env.PTY_ROUTER.idFromName('default');
        const fwd = new URL(url.toString());
        fwd.searchParams.set('role', role);
        return env.PTY_ROUTER.get(id).fetch(new Request(fwd.toString(), request));
      }
      return new Response('Not found', { status: 404 });
    }

    return new Response('Not found', { status: 404 });
  },
};

// Ambient minimal types (replace with @cloudflare/workers-types in your worker).
interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): { fetch(request: Request): Promise<Response> };
}
interface DurableObjectId {
  toString(): string;
}
