import { makeRoutes } from "./routes.js";
export interface FleetConfig {
    fleet: string;
    secret: string;
    dsh_port: number;
    gateway_base: number;
    name: string;
    peers: string[];
}
export declare function fleetHome(): string;
export declare function defaultConfig(): FleetConfig;
export declare function loadConfig(): FleetConfig;
export declare function saveConfig(config: FleetConfig): void;
export declare class FleetNode {
    private readonly config;
    private readonly log;
    private readonly launchToken?;
    private endpoint?;
    private readonly peers;
    private readonly dialing;
    private selfId;
    private stopped;
    /** Local dispatcher for intercepted gateway requests — the browser runs
     * on this machine, so its fleet API must be served here, not tunneled. */
    readonly routes: ReturnType<typeof makeRoutes>;
    constructor(config: FleetConfig, log: (...a: unknown[]) => void, launchToken?: (() => string | undefined) | undefined);
    /** Set once the connection service loads; undefined before that. */
    private homeUrl;
    private proof;
    private verify;
    private selfHello;
    start(): Promise<void>;
    stop(): Promise<void>;
    invite(): string;
    status(): Record<string, unknown>;
    addPeer(ticket: string): Promise<void>;
    /** Pairing code: base64url JSON {v, f, n, t, s} — ticket + fleet secret. */
    pairingCode(): string;
    /**
     * Pair from another machine's code. Adopts the incoming fleet (name +
     * secret) only while unpaired; refuses to silently re-key an existing
     * fleet. Then joins by ticket.
     */
    pair(code: string): Promise<void>;
    /** Drop a device: peer entry, gateway, persisted ticket. */
    removePeer(id: string): void;
    dial(id: string): Promise<{
        port: number;
        token?: string;
    }>;
    /**
     * One browser connection to a gateway port. Requests under /api/dsh-fleet/
     * are served by THIS node — the browser runs on this machine, so a dial
     * must allocate a gateway here, never on the peer at the tunnel's far end
     * whose loopback the browser cannot reach. Everything else is proxied to
     * the peer's web UI the way a reverse proxy would: Host/Origin/Referer are
     * rewritten to the peer's listening address (the harness only accepts
     * requests whose Origin matches where it listens), a 401 on GET / mints a
     * token handoff, Location headers point back at the gateway, and websocket
     * upgrades are relayed raw.
     */
    private gatewayConn;
    /**
     * Proxy one non-fleet request to the peer's web UI over a fresh tunnel
     * stream. Returns false when the socket must not serve more requests
     * (connection handed to a raw relay, or the tunnel failed).
     */
    private bridgeRequest;
    /** Serve one intercepted fleet request locally; close the socket after. */
    private serveFleetApi;
    private writeHttp;
    private findFreePort;
    /**
     * Event-driven liveness: resolves when the connection closes; clears state
     * only if this conn is still the current one, then arms a retry.
     */
    private watchConn;
    /** Exponential retry (1s doubling to 30s) while a peer is unreachable. */
    private scheduleRetry;
    /** One dial in flight per peer — pair() and retry chains share it. */
    private connectPeer;
    private dialPeer;
    private rosterFrame;
    private mergeRoster;
    private acceptLoop;
    private handleConn;
    /** Persist a peer ticket once (idempotent; survives restarts). */
    private persistTicket;
    private upsertPeer;
    private ctrlLoop;
    private tunnelAcceptLoop;
    /** One tunnel stream -> this machine's web UI. Never takes the accept
     * loop down: a single failed connect used to kill the loop for good,
     * leaving every later dial timing out on a still-"online" conn. */
    private relayTunnel;
}
export interface ParsedHead {
    method: string;
    target: string;
    path: string;
    headers: Record<string, string>;
}
/** Request line + headers of one HTTP request head (bytes up to \r\n\r\n). */
export declare function parseHead(head: Buffer): ParsedHead | null;
