/**
 * Thin transport over the `headroom-ai` SDK client. The proxy URL is a
 * configuration input; this module never spawns or manages a proxy process.
 * When no URL is configured the service does not construct a transport and
 * degrades to a no-op with a warning (see `HeadroomCompressor`).
 */
import type { CompressResult, OpenAIMessage, ProxyStats, RetrieveResult, RetrieveSearchResult } from 'headroom-ai';
export declare const DSH_HEADROOM_STACK = "dsh-headroom";
export interface HeadroomTransportOptions {
    readonly baseUrl: string;
    readonly timeoutMs: number;
}
export declare class HeadroomTransport {
    private readonly client;
    constructor(options: HeadroomTransportOptions);
    compress(messages: OpenAIMessage[], model?: string): Promise<CompressResult>;
    retrieve(hash: string): Promise<RetrieveResult | RetrieveSearchResult>;
    stats(): Promise<ProxyStats>;
    health(): Promise<boolean>;
}
