/**
 * Thin transport over the `headroom-ai` SDK client. The proxy URL is a
 * configuration input; this module never spawns or manages a proxy process.
 * When no URL is configured the service does not construct a transport and
 * degrades to a no-op with a warning (see `HeadroomCompressor`).
 */

import { HeadroomClient } from 'headroom-ai'
import type {
  CompressResult,
  OpenAIMessage,
  ProxyStats,
  RetrieveResult,
  RetrieveSearchResult,
} from 'headroom-ai'

export const DSH_HEADROOM_STACK = 'dsh-headroom'

export interface HeadroomTransportOptions {
  readonly baseUrl: string
  readonly timeoutMs: number
}

export class HeadroomTransport {
  private readonly client: HeadroomClient

  constructor(options: HeadroomTransportOptions) {
    this.client = new HeadroomClient({
      baseUrl: options.baseUrl,
      timeout: options.timeoutMs,
      fallback: false,
      stack: DSH_HEADROOM_STACK,
    })
  }

  async compress(
    messages: OpenAIMessage[],
    model?: string,
  ): Promise<CompressResult> {
    return this.client.compress(messages, { model })
  }

  async retrieve(hash: string): Promise<RetrieveResult | RetrieveSearchResult> {
    return this.client.retrieve(hash)
  }

  async stats(): Promise<ProxyStats> {
    return this.client.proxyStats()
  }

  async health(): Promise<boolean> {
    const status = await this.client.health()
    return status.status === 'healthy'
  }
}
