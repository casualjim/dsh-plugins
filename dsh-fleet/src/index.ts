/**
 * dsh-fleet — host entry (composition root).
 *
 * Loads/creates <DSH_HOME>/dsh-fleet/config.json, starts the in-process
 * iroh fleet node (@number0/iroh), registers /api/dsh-fleet/* routes for
 * the browser dropdown. Failure policy: warn, never break GUI startup.
 */
import { FleetNode, loadConfig, type FleetConfig } from "./iroh.ts";
import { makeRoutes } from "./routes.ts";

export { ROUTES, makeRoutes } from "./routes.ts";
export { FleetNode, fleetHome, loadConfig, defaultConfig, saveConfig } from "./iroh.ts";
export type { FleetConfig } from "./iroh.ts";

export const name = "dsh-fleet";
export const inject = ["webServer"];

interface FleetContext {
  webServer: { register: (route: unknown) => () => void };
  effect: (fn: () => () => void) => void;
  logger?: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void };
}

export function apply(ctx: FleetContext): void {
  // cordis LoggerService methods invoke this() — keep them as bound method
  // calls; extracting the reference ((ctx.logger?.warn ?? console.warn)(...))
  // detaches this and throws "this is not a function".
  const log = (...args: unknown[]) => {
    if (ctx.logger?.info !== undefined) ctx.logger.info("[dsh-fleet]", ...args);
    else console.log("[dsh-fleet]", ...args);
  };
  const warn = (...args: unknown[]) => {
    if (ctx.logger?.warn !== undefined) ctx.logger.warn("[dsh-fleet]", ...args);
    else console.warn("[dsh-fleet]", ...args);
  };

  let config: FleetConfig;
  try {
    config = loadConfig();
  } catch (error) {
    warn("config load failed:", error instanceof Error ? error.message : String(error));
    return;
  }

  let node: FleetNode | undefined;
  let disposers: Array<() => void> = [];

  ctx.effect(() => {
    let cancelled = false;
    const fleet = new FleetNode(config, log);
    fleet.start()
      .then(() => {
        if (cancelled) { void fleet.stop(); return; }
        node = fleet;
        const routes = makeRoutes({
          node: () => fleet,
          config,
        });
        disposers = routes.map((route) => ctx.webServer.register(route));
        log("fleet node running; join via GET /api/dsh-fleet/invite");
      })
      .catch((error: unknown) => {
        warn("fleet node failed:", error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
      for (const dispose of disposers) dispose();
      void node?.stop();
    };
  });
}
