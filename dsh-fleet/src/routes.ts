/**
 * dsh-fleet — /api/dsh-fleet/* routes (loopback-only).
 *
 * status: self + peers with online state and gateway ports.
 * invite: own join ticket (id + relay URL + direct addrs) + fleet name.
 * dial:   allocate/return the loopback gateway port for one peer.
 * peers:  join a peer by their invite ticket (persisted to config.json).
 */
import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
import { isLoopbackRequest } from "../shared/loopback.js";
import { writeJson, readJsonBody, errorMessage } from "../shared/host-utils.js";
import type { FleetNode, FleetConfig } from "./iroh.ts";

export const ROUTES = {
  status: "/api/dsh-fleet/status",
  invite: "/api/dsh-fleet/invite",
  pairing: "/api/dsh-fleet/pairing",
  pair: "/api/dsh-fleet/pair",
  remove: "/api/dsh-fleet/remove",
  dial: "/api/dsh-fleet/dial",
  peers: "/api/dsh-fleet/peers",
} as const;

export interface RoutesDeps {
  node: () => FleetNode;
  config: FleetConfig;
}

export function makeRoutes(deps: RoutesDeps): WebRoute[] {
  const guard = (req: Parameters<WebRoute["handler"]>[0], res: Parameters<WebRoute["handler"]>[1]): boolean => {
    if (isLoopbackRequest(req)) return true;
    writeJson(res, 403, { error: "forbidden: loopback-only" });
    return false;
  };

  return [
    {
      kind: "exact",
      path: ROUTES.status,
      handler: async (req, res) => {
        if (req.method !== "GET" || !guard(req, res)) return;
        try {
          writeJson(res, 200, deps.node().status());
        } catch (error) { writeJson(res, 503, { error: errorMessage(error) }); }
      },
    },
    {
      kind: "exact",
      path: ROUTES.invite,
      handler: async (req, res) => {
        if (req.method !== "GET" || !guard(req, res)) return;
        try {
          writeJson(res, 200, {
            ticket: deps.node().invite(),
            fleet: deps.config.fleet,
            name: deps.config.name,
          });
        } catch (error) { writeJson(res, 503, { error: errorMessage(error) }); }
      },
    },
    {
      kind: "exact",
      path: ROUTES.pairing,
      handler: async (req, res) => {
        if (req.method !== "GET" || !guard(req, res)) return;
        try {
          writeJson(res, 200, { code: deps.node().pairingCode(), fleet: deps.config.fleet, name: deps.config.name });
        } catch (error) { writeJson(res, 503, { error: errorMessage(error) }); }
      },
    },
    {
      kind: "exact",
      path: ROUTES.pair,
      handler: async (req, res) => {
        if (req.method !== "POST" || !guard(req, res)) return;
        const body = await readJsonBody(req);
        const code = typeof (body as { code?: unknown } | undefined)?.code === "string" ? (body as { code: string }).code : undefined;
        if (code === undefined || code.trim() === "") { writeJson(res, 400, { error: "missing code" }); return; }
        try {
          await deps.node().pair(code);
          writeJson(res, 200, { ok: true });
        } catch (error) { writeJson(res, 400, { error: errorMessage(error) }); }
      },
    },
    {
      kind: "exact",
      path: ROUTES.remove,
      handler: async (req, res) => {
        if (req.method !== "POST" || !guard(req, res)) return;
        const body = await readJsonBody(req);
        const id = typeof (body as { id?: unknown } | undefined)?.id === "string" ? (body as { id: string }).id : undefined;
        if (id === undefined || id === "") { writeJson(res, 400, { error: "missing id" }); return; }
        try {
          deps.node().removePeer(id);
          writeJson(res, 200, { ok: true });
        } catch (error) { writeJson(res, 400, { error: errorMessage(error) }); }
      },
    },
    {
      kind: "exact",
      path: ROUTES.dial,
      handler: async (req, res) => {
        if (req.method !== "POST" || !guard(req, res)) return;
        const body = await readJsonBody(req);
        const id = typeof (body as { id?: unknown } | undefined)?.id === "string" ? (body as { id: string }).id : undefined;
        if (id === undefined) { writeJson(res, 400, { error: "missing id" }); return; }
        try {
          writeJson(res, 200, { port: await deps.node().dial(id) });
        } catch (error) { writeJson(res, 503, { error: errorMessage(error) }); }
      },
    },
    {
      kind: "exact",
      path: ROUTES.peers,
      handler: async (req, res) => {
        if (req.method !== "POST" || !guard(req, res)) return;
        const body = await readJsonBody(req);
        const ticket = typeof (body as { ticket?: unknown } | undefined)?.ticket === "string" ? (body as { ticket: string }).ticket : undefined;
        if (ticket === undefined || ticket.trim() === "") { writeJson(res, 400, { error: "missing ticket" }); return; }
        try {
          await deps.node().addPeer(ticket);
          writeJson(res, 200, { ok: true });
        } catch (error) { writeJson(res, 400, { error: errorMessage(error) }); }
      },
    },
  ];
}
