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
    private endpoint?;
    private readonly peers;
    private readonly dialing;
    private selfId;
    private stopped;
    constructor(config: FleetConfig, log: (...a: unknown[]) => void);
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
    dial(id: string): Promise<number>;
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
}
