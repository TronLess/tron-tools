export interface Endpoint {
  name?: string;
  url: string;
  kind?: 'http' | 'jsonrpc';
  network?: 'mainnet' | 'nile' | 'shasta' | string;
}

export interface EndpointResult {
  name: string;
  url: string;
  kind: 'http' | 'jsonrpc';
  network: string | null;
  ok: boolean;
  latencyMs: number;
  blockNumber: number | null;
  blockTimestamp: number | null;
  blockTime: string | null;
  lagMs: number | null;
  lagBlocks: number | null;
  error: string | null;
  behindBlocks?: number | null;
  healthy?: boolean;
}

export interface HealthReport {
  checkedAt: string;
  network: string | null;
  consensusHeight: number | null;
  results: EndpointResult[];
  best: EndpointResult | null;
  bestHttp: EndpointResult | null;
  bestJsonRpc: EndpointResult | null;
}

export interface CheckOptions {
  network?: string;
  concurrency?: number;
  timeoutMs?: number;
  apiKey?: string;
  fetch?: typeof fetch;
  maxLagBlocks?: number;
  now?: () => number;
}

export const DEFAULT_ENDPOINTS: ReadonlyArray<Required<Pick<Endpoint, 'name' | 'url' | 'kind' | 'network'>>>;
export const BLOCK_INTERVAL_MS: 3000;
export function checkEndpoint(endpoint: Endpoint, options?: Omit<CheckOptions, 'network' | 'concurrency' | 'maxLagBlocks'>): Promise<EndpointResult>;
export function checkEndpoints(endpoints?: Endpoint[] | null, options?: CheckOptions): Promise<HealthReport>;
export function pickBestNode(network?: string, options?: CheckOptions): Promise<string | null>;
export function formatReport(report: HealthReport): string;

declare const _default: {
  DEFAULT_ENDPOINTS: typeof DEFAULT_ENDPOINTS;
  BLOCK_INTERVAL_MS: typeof BLOCK_INTERVAL_MS;
  checkEndpoint: typeof checkEndpoint;
  checkEndpoints: typeof checkEndpoints;
  pickBestNode: typeof pickBestNode;
  formatReport: typeof formatReport;
};
export default _default;
