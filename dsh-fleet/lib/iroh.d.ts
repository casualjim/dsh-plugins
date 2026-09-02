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
    private connectPeer;
    private rosterFrame;
    private mergeRoster;
    private acceptLoop;
    private handleConn;
    private upsertPeer;
    private ctrlLoop;
    private pingLoop;
    private tunnelAcceptLoop;
    private reconnectLoop;
}
