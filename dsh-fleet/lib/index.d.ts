export { ROUTES, makeRoutes } from "./routes.js";
export { FleetNode, fleetHome, loadConfig, defaultConfig, saveConfig } from "./iroh.js";
export type { FleetConfig } from "./iroh.js";
export declare const name = "dsh-fleet";
export declare const inject: string[];
interface FleetContext {
    webServer: {
        register: (route: unknown) => () => void;
    };
    effect: (fn: () => () => void) => void;
    logger?: {
        info: (...a: unknown[]) => void;
        warn: (...a: unknown[]) => void;
    };
}
export declare function apply(ctx: FleetContext): void;
