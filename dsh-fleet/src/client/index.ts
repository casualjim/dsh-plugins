/**
 * dsh-fleet — browser entry.
 *
 * Contributes two React cells through the client slot registry (no direct
 * DOM work anywhere — the shell owns rendering):
 *   - "sidebar.footer.action" list cell: fleet instance switcher beside the
 *     Settings seat (wide row in the expanded sidebar, icon in the rail).
 *   - "settings.section" list cell: Fleet settings page (pairing, devices).
 *
 * Status refresh is one fetch every 5s while the sidebar is mounted, bounded
 * by React lifecycle. On a peer gateway origin the page is served through the
 * tunnel, so the self row navigates to the remembered local origin
 * (localStorage "dsh-fleet:home") instead of a peer-relative "/".
 *
 * Failure policy: warn only, never break the GUI.
 */

import React from "react";
import { FleetSection } from "./fleet-section.ts";

const API = {
  status: "/api/dsh-fleet/status",
  dial: "/api/dsh-fleet/dial",
};

interface PeerView {
  id: string;
  name: string;
  dsh_port: number;
  online: boolean;
  gateway_port: number | null;
}

interface FleetStatus {
  self: { id: string; name: string; dsh_port: number };
  peers: PeerView[];
}

async function getJson(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? path + " " + String(res.status));
  return body;
}

// Origin of this machine's own GUI. Remembered whenever we browse it
// directly (location port === self dsh_port); on a gateway origin the self
// row returns here instead of reloading the peer.
const HOME_KEY = "dsh-fleet:home";
function homeHref(): string {
  try { return localStorage.getItem(HOME_KEY) ?? window.location.origin; }
  catch { return window.location.origin; }
}

async function pick(peer: PeerView): Promise<void> {
  if (peer.online !== true) return;
  try {
    const out = (await getJson(API.dial, { method: "POST", body: JSON.stringify({ id: peer.id }) })) as { port: number };
    window.location.href = "http://127.0.0.1:" + String(out.port) + "/";
  } catch (error) {
    console.warn("[dsh-fleet] dial failed:", error);
  }
}

const dotStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: "50%", flex: "none",
};

const menuItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  padding: "6px 8px", border: "none", borderRadius: 8,
  background: "transparent", color: "inherit", font: "inherit",
  fontSize: 12, textAlign: "left", cursor: "pointer",
};

function FleetFooterAction({ wide }: { wide: boolean }): React.ReactElement {
  const [status, setStatus] = React.useState<FleetStatus | null>(null);
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let alive = true;
    const tick = () => {
      getJson(API.status)
        .then((body) => {
          if (!alive) return;
          setStatus(body as FleetStatus);
          if (window.location.port === String((body as FleetStatus).self?.dsh_port ?? "")) {
            try { localStorage.setItem(HOME_KEY, window.location.origin); } catch { /* private mode */ }
          }
        })
        .catch(() => {});
    };
    tick();
    const timer = window.setInterval(tick, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current !== null && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const peers = (status?.peers ?? []).filter((p) => p.id !== status?.self.id);
  const online = peers.filter((p) => p.online).length;

  const menu = open === false ? null : React.createElement("div", {
    style: {
      position: "absolute", bottom: "calc(100% + 6px)", left: 8, right: 8,
      background: "var(--dsh-bg-elevated, #1e1f22)", color: "inherit",
      border: "1px solid rgba(127,127,127,.35)", borderRadius: 10,
      padding: 4, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    },
  },
    React.createElement("div", { style: { fontSize: 11, opacity: 0.55, padding: "4px 8px" } }, "fleet instances"),
    React.createElement("button", {
      onClick: () => { setOpen(false); window.location.href = homeHref(); },
      style: menuItemStyle,
    },
      React.createElement("span", { style: { ...dotStyle, background: "#4ade80" } }),
      React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, (status?.self.name ?? "local") + " \u00b7 local"),
    ),
    peers.map((peer) => React.createElement("button", {
      key: peer.id,
      onClick: () => { setOpen(false); void pick(peer); },
      disabled: peer.online !== true,
      style: menuItemStyle,
    },
      React.createElement("span", { style: { ...dotStyle, background: peer.online ? "#4ade80" : "rgba(127,127,127,.5)" } }),
      React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, peer.name + (peer.online ? "" : " \u00b7 offline")),
    )),
  );

  const label = "fleet \u00b7 " + online + "/" + peers.length;
  return React.createElement("div", { ref: rootRef, style: { position: "relative", width: wide ? "100%" : "auto" } },
    menu,
    React.createElement("button", {
      title: label,
      onClick: () => setOpen((v) => !v),
      style: {
        display: "flex", alignItems: "center", gap: 6, width: wide ? "100%" : "auto",
        padding: wide ? "6px 10px" : "6px 8px", border: "none", borderRadius: 8,
        background: "rgba(127,127,127,.12)", color: "inherit", font: "inherit",
        fontSize: 12, cursor: "pointer", justifyContent: wide ? "flex-start" : "center",
      },
    },
      React.createElement("span", { style: { ...dotStyle, background: online > 0 ? "#4ade80" : "rgba(127,127,127,.5)" } }),
      wide ? React.createElement("span", { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, label) : null,
    ),
  );
}

export function apply(ctx: unknown): void {
  try {
    registerSlots(ctx as { slots?: SettingsSlots });
  } catch (error) {
    console.warn("[dsh-fleet] client slots failed:", error);
  }
}

interface SettingsSlots {
  inject: (slot: string, disposer: () => unknown) => unknown;
  register: (options: { name: string; id: string; order: number; label?: () => string }, component: unknown) => unknown;
}

function registerSlots(ctx: { slots?: SettingsSlots }): void {
  const slots = ctx.slots ?? (typeof (ctx as { get?: (n: string) => unknown }).get === "function"
    ? (ctx as { get: (n: string) => unknown }).get("slots") as SettingsSlots | undefined
    : undefined);
  if (slots === undefined || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
  // sidebar footer switcher (list cell; owner passes { wide })
  slots.inject("sidebar.footer.action", () => slots.register(
    { name: "sidebar.footer.action", id: "fleet", order: 100 },
    FleetFooterAction,
  ));
  // settings page (list cell)
  slots.inject("settings.section", () => slots.register({
    name: "settings.section",
    id: "fleet",
    order: 35,
    label: () => "Fleet",
  }, FleetSection));
}

// service-key names loader-built apply ctx (ctx.slots gated on build)
export const inject: string[] = ["slots"];
