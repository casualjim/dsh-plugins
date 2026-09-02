/**
 * dsh-fleet — /api/dsh-fleet/* routes (loopback-only).
 *
 * status: self + peers with online state and gateway ports.
 * invite: own join ticket (id + relay URL + direct addrs) + fleet name.
 * dial:   allocate/return the loopback gateway port for one peer.
 * peers:  join a peer by their invite ticket (persisted to config.json).
 */
import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
import type { FleetNode, FleetConfig } from "./iroh.js";
export declare const ROUTES: {
    readonly status: "/api/dsh-fleet/status";
    readonly invite: "/api/dsh-fleet/invite";
    readonly pairing: "/api/dsh-fleet/pairing";
    readonly pair: "/api/dsh-fleet/pair";
    readonly remove: "/api/dsh-fleet/remove";
    readonly dial: "/api/dsh-fleet/dial";
    readonly peers: "/api/dsh-fleet/peers";
};
export interface RoutesDeps {
    node: () => FleetNode;
    config: FleetConfig;
}
export declare function makeRoutes(deps: RoutesDeps): WebRoute[];
