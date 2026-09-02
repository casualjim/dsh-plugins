/**
 * dsh-fleet — browser entry.
 *
 * Injects an instance dropdown row directly below the sidebar New Session
 * button (anchor: css-modules class suffix "_newSession"; the DSH client
 * css pattern is [hash]_[local]). Lists this machine + fleet peers from
 * /api/dsh-fleet/status; picking a peer dials a loopback gateway port and
 * navigates the tab there. The plugin runs on every fleet member, so the
 * dropdown is present on remote GUIs too — pick "local" to come back.
 *
 * Failure policy: warn only, never break GUI. If the sidebar anchor never
 * appears (custom shell), stays dormant.
 */

import * as React from "react";
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

const STYLE = "[data-dsh-fleet-row]{margin:2px 10px 6px;display:flex}" +
  "[data-dsh-fleet-btn]{flex:1;display:flex;align-items:center;gap:6px;padding:5px 10px;border:none;border-radius:8px;cursor:pointer;background:transparent;color:inherit;font:inherit;font-size:12px;text-align:left;overflow:hidden;white-space:nowrap}" +
  "[data-dsh-fleet-btn]:hover{background:rgba(127,127,127,.15)}" +
  "[data-dsh-fleet-dot]{width:7px;height:7px;border-radius:50%;background:#888;flex:none}" +
  "[data-dsh-fleet-dot].on{background:#3fb26f}" +
  "[data-dsh-fleet-menu]{position:fixed;z-index:2147483000;min-width:200px;max-height:50vh;overflow:auto;background:var(--dsh-bg-elevated,#2a2a2e);color:inherit;border:1px solid rgba(127,127,127,.35);border-radius:10px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-size:13px}" +
  "[data-dsh-fleet-item]{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;border:none;border-radius:7px;cursor:pointer;background:transparent;color:inherit;font:inherit;text-align:left}" +
  "[data-dsh-fleet-item]:hover{background:rgba(127,127,127,.18)}" +
  "[data-dsh-fleet-item][disabled]{opacity:.5;cursor:default}" +
  "[data-dsh-fleet-hint]{padding:4px 10px;font-size:11px;opacity:.6}";

function el(tag: string, attrs: Record<string, unknown> = {}): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = String(value);
    else if (key === "dataset") Object.assign(node.dataset, value as Record<string, string>);
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value as EventListener);
    else if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  return node;
}

async function getJson(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? path + " " + String(res.status));
  return body;
}

function findNewSessionButton(): HTMLElement | null {
  // no getClientRects/offsetParent: both force synchronous layout, and this
  // runs after DOM churn (streaming tokens); CSS hides the row in the rail.
  return document.querySelector<HTMLElement>('button[class$="_newSession"]');
}

export function apply(ctx: unknown): void {
  try {
    if (document.querySelector("style[data-dsh-fleet-style]") === null) {
      const style = document.createElement("style");
      style.dataset.dshFleetStyle = "";
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    mount();
  } catch (error) {
    console.warn("[dsh-fleet] client mount failed:", error);
  }
  try {
    registerSettingsSection(ctx as { slots?: SettingsSlots; get?: (name: string) => unknown });
  } catch (error) {
    console.warn("[dsh-fleet] settings section failed:", error);
  }
}

interface SettingsSlots {
  inject: (slot: string, disposer: () => unknown) => unknown;
  register: (options: { name: string; id: string; order: number; label: () => string }, component: unknown) => unknown;
}

/**
 * Settings page, first-party pattern (ui-settings-models): one
 * settings.section list entry. Content = FleetSection (React, injected
 * via the externals build path).
 */
function registerSettingsSection(ctx: { slots?: SettingsSlots; get?: (name: string) => unknown }): void {
  const slots = ctx.slots ?? (typeof ctx.get === "function" ? (ctx.get("slots") as SettingsSlots | undefined) : undefined);
  if (slots === undefined || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
  slots.inject("settings.section", () => slots.register({
    name: "settings.section",
    id: "fleet",
    order: 35,
    label: () => "Fleet",
  }, FleetSection));
}

function mount(): void {
  let row: HTMLElement | null = null;
  let menu: HTMLElement | null = null;
  let status: FleetStatus | null = null;

  const closeMenu = () => { menu?.remove(); menu = null; };
  const navigate = (href: string) => { window.location.href = href; };

  const pick = async (peer: PeerView): Promise<void> => {
    closeMenu();
    if (peer.online !== true) return;
    try {
      const out = (await getJson(API.dial, { method: "POST", body: JSON.stringify({ id: peer.id }) })) as { port: number };
      navigate("http://127.0.0.1:" + String(out.port) + "/");
    } catch (error) {
      console.warn("[dsh-fleet] dial failed:", error);
    }
  };

  const openMenu = (anchor: HTMLElement) => {
    closeMenu();
    if (status === null) return;
    const list = el("div", { "data-dsh-fleet-menu": "" });
    list.appendChild(el("div", { "data-dsh-fleet-hint": "", text: "fleet instances" }));
    const selfItem = el("button", {
      "data-dsh-fleet-item": "",
      onclick: () => { closeMenu(); navigate("/"); },
    });
    selfItem.appendChild(el("span", { "data-dsh-fleet-dot": "", class: "on" }));
    selfItem.appendChild(el("span", { text: status.self.name + " · local" }));
    list.appendChild(selfItem);
    for (const peer of status.peers) {
      if (peer.id === status.self.id) continue;
      const attrs: Record<string, unknown> = {
        "data-dsh-fleet-item": "",
        onclick: () => { void pick(peer); },
      };
      if (peer.online !== true) attrs.disabled = "";
      const item = el("button", attrs);
      item.appendChild(el("span", { "data-dsh-fleet-dot": "", class: peer.online ? "on" : "" }));
      item.appendChild(el("span", { text: peer.name + (peer.online === true ? "" : " · offline") }));
      list.appendChild(item);
    }
    document.body.appendChild(list);
    const rect = anchor.getBoundingClientRect();
    list.style.left = Math.max(8, rect.left) + "px";
    list.style.top = (rect.bottom + 4) + "px";
    menu = list;
    setTimeout(() => {
      document.addEventListener("pointerdown", function onDown(event) {
        if (menu !== null && event.target instanceof Node && menu.contains(event.target) === false) {
          closeMenu();
          document.removeEventListener("pointerdown", onDown);
        }
      });
    }, 0);
  };

  const buildRow = (): HTMLElement => {
    const container = el("div", { "data-dsh-fleet-row": "" });
    const btn = el("button", {
      "data-dsh-fleet-btn": "",
      onclick: (event: Event) => { event.stopPropagation(); if (menu === null) openMenu(container); else closeMenu(); },
    });
    const dot = el("span", { "data-dsh-fleet-dot": "" });
    const label = el("span", { text: "fleet · local" });
    btn.appendChild(dot);
    btn.appendChild(label);
    container.appendChild(btn);
    container.addEventListener("fleet:update", () => {
      const peers = (status?.peers ?? []).filter((p) => p.id !== status?.self.id);
      const online = peers.filter((p) => p.online).length;
      dot.className = online > 0 ? "on" : "";
      label.textContent = "fleet · " + String(online) + "/" + String(peers.length);
    });
    return container;
  };

  // sidebar mounts async and React may re-render; keep the row pinned.
  // Hot path: streaming chat fires this per mutation batch — the fast path
  // below is two property reads; findNewSessionButton must stay layout-free.
  let anchor: HTMLElement | null = null;
  const observer = new MutationObserver(() => {
    if (row !== null && row.isConnected && anchor !== null && anchor.isConnected && row.previousElementSibling === anchor) return;
    anchor = findNewSessionButton();
    if (anchor === null) return;
    if (row === null || row.isConnected === false) row = buildRow();
    anchor.after(row);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const refresh = () => {
    getJson(API.status)
      .then((body) => { status = body as FleetStatus; row?.dispatchEvent(new CustomEvent("fleet:update")); })
      .catch(() => {});
  };
  refresh();
  window.setInterval(refresh, 5000);
  window.addEventListener("pagehide", () => { observer.disconnect(); closeMenu(); }, { once: true });
}

// service-key names for the loader-built apply ctx (ctx.slots gated on this)
export const inject: string[] = ["slots"];
