/**
 * dsh-fleet — Settings section (settings.section, first-party pattern from
 * ui-settings-models: slots.inject -> slots.register({id, order, label}, Comp)).
 *
 * Page: this machine's pairing code (copy), pair-a-device paste box, device
 * list with online dots and remove. Data via /api/dsh-fleet/*.
 */
import * as React from "react";

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

async function api(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? path + " " + String(res.status));
  return body;
}

export function FleetSection(props: { close?: () => void }): React.ReactElement {
  const [status, setStatus] = React.useState<FleetStatus | null>(null);
  const [code, setCode] = React.useState("");
  const [paste, setPaste] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const refresh = React.useCallback(() => {
    api("/api/dsh-fleet/status").then((b) => { setStatus(b as FleetStatus); }).catch((e: Error) => { setError(e.message); });
  }, []);

  React.useEffect(() => {
    api("/api/dsh-fleet/pairing").then((b) => { setCode((b as { code: string }).code); }).catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { window.clearInterval(timer); };
  }, [refresh]);

  const pair = async () => {
    setBusy(true); setError("");
    try {
      await api("/api/dsh-fleet/pair", { method: "POST", body: JSON.stringify({ code: paste.trim() }) });
      setPaste("");
      refresh();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const remove = async (id: string) => {
    setBusy(true); setError("");
    try {
      await api("/api/dsh-fleet/remove", { method: "POST", body: JSON.stringify({ id }) });
      refresh();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => { setCopied(false); }, 1500); }
    catch { setError("clipboard blocked — select and copy manually"); }
  };

  const dot = (on: boolean) => React.createElement("span", {
    style: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: on ? "#3fb26f" : "#888", flex: "none" },
  });

  return React.createElement("div", { "data-fleet-section": true, style: { display: "flex", flexDirection: "column", gap: 18, fontSize: 14 } },

    React.createElement("section", { "data-fleet-block": true },
      React.createElement("h3", { style: { margin: "0 0 6px", fontSize: 13, opacity: 0.7, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 } }, "This machine"),
      React.createElement("div", null,
        (status?.self.name ?? "…") + "  ·  fleet port " + String(status?.self.dsh_port ?? "…")),
      React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8, alignItems: "flex-start" } },
        React.createElement("textarea", {
          value: code, readOnly: true, rows: 3,
          style: { flex: 1, fontSize: 11, fontFamily: "monospace", opacity: 0.85, resize: "none" },
          onFocus: (e: React.FocusEvent<HTMLTextAreaElement>) => { e.currentTarget.select(); },
        }),
        React.createElement("button", { type: "button", onClick: copy, style: { padding: "6px 12px" } }, copied ? "Copied" : "Copy"),
      ),
      React.createElement("div", { style: { fontSize: 12, opacity: 0.6, marginTop: 4 } }, "Pairing code — carries the fleet secret. Treat like a password.")),

    React.createElement("section", { "data-fleet-block": true },
      React.createElement("h3", { style: { margin: "0 0 6px", fontSize: 13, opacity: 0.7, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 } }, "Pair a device"),
      React.createElement("div", { style: { display: "flex", gap: 8 } },
        React.createElement("textarea", {
          value: paste, rows: 3, placeholder: "paste their pairing code",
          style: { flex: 1, fontSize: 11, fontFamily: "monospace", resize: "none" },
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => { setPaste(e.currentTarget.value); },
        }),
        React.createElement("button", { type: "button", disabled: busy || paste.trim() === "", onClick: pair, style: { padding: "6px 12px" } }, "Pair"),
      )),

    React.createElement("section", { "data-fleet-block": true },
      React.createElement("h3", { style: { margin: "0 0 6px", fontSize: 13, opacity: 0.7, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 } }, "Devices"),
      (status?.peers.length ?? 0) === 0
        ? React.createElement("div", { style: { opacity: 0.6 } }, "No paired devices yet.")
        : React.createElement("ul", { style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } },
            (status?.peers ?? []).map((p: PeerView) => React.createElement("li", {
              key: p.id, "data-fleet-peer": p.id,
              style: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8 },
            },
              dot(p.online),
              React.createElement("span", { style: { flex: 1 } }, p.name + (p.online ? "" : " · offline")),
              React.createElement("button", { type: "button", disabled: busy, onClick: () => { void remove(p.id); }, style: { padding: "2px 10px", fontSize: 12 } }, "Remove"),
            ))),
      ),

    error !== "" ? React.createElement("div", { style: { color: "#e5607a", fontSize: 13 } }, error) : null,
  );
}
