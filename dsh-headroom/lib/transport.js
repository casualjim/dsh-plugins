/**
 * Thin transport over the `headroom-ai` SDK client. The proxy URL is a
 * configuration input; this module never spawns or manages a proxy process.
 * When no URL is configured the service does not construct a transport and
 * degrades to a no-op with a warning (see `HeadroomCompressor`).
 */
import { HeadroomClient } from 'headroom-ai';
export const DSH_HEADROOM_STACK = 'dsh-headroom';
export class HeadroomTransport {
    client;
    constructor(options) {
        this.client = new HeadroomClient({
            baseUrl: options.baseUrl,
            timeout: options.timeoutMs,
            fallback: false,
            stack: DSH_HEADROOM_STACK,
        });
    }
    async compress(messages, model) {
        return this.client.compress(messages, { model });
    }
    async retrieve(hash) {
        return this.client.retrieve(hash);
    }
    async stats() {
        return this.client.proxyStats();
    }
    async health() {
        const status = await this.client.health();
        return status.status === 'healthy';
    }
}
