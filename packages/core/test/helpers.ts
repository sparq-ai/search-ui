import type { SearchRequest, SearchResponse, SparqClient } from '../src';

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const tick = () => sleep(0);

export function response(partial: Partial<SearchResponse> = {}): SearchResponse {
  return { items: [], totalItems: 0, facets: {}, processingTimeMs: 1, ...partial };
}

/** Client that resolves immediately and records every request. */
export function recordingClient(
  respond: (req: SearchRequest, callIndex: number) => SearchResponse = () => response(),
) {
  const requests: SearchRequest[] = [];
  const client: SparqClient = {
    async search(req) {
      requests.push(req);
      return respond(req, requests.length - 1);
    },
  };
  return { client, requests };
}

export interface DeferredCall {
  req: SearchRequest;
  resolve: (res: SearchResponse) => void;
  reject: (e: unknown) => void;
  signal: AbortSignal | undefined;
}

/** Client whose responses are resolved manually — for race/abort tests. */
export function deferredClient(opts: { respectAbort?: boolean } = {}) {
  const calls: DeferredCall[] = [];
  const client: SparqClient = {
    search(req, callOpts) {
      return new Promise<SearchResponse>((resolve, reject) => {
        if (opts.respectAbort !== false) {
          callOpts?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }
        calls.push({ req, resolve, reject, signal: callOpts?.signal });
      });
    },
  };
  return { client, calls };
}
