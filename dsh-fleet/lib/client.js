"use strict";
// 契约外壳（scripts/build-client.ts 生成）：external 依赖（React 等）经 factory 注入的 require 解析
window.__ModuleLoader__.load({
  id: "dsh-fleet",
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    "use strict";
    "use strict";
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    // src/client/index.ts
    var index_exports = {};
    __export(index_exports, {
      apply: () => apply,
      inject: () => inject
    });
    module.exports = __toCommonJS(index_exports);
    var React2 = require("react");

    // src/client/fleet-section.ts
    var React = __toESM(require("react"), 1);
    async function api(path, init) {
      const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers ?? {} } });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? path + " " + String(res.status));
      return body;
    }
    function FleetSection(props) {
      const [status, setStatus] = React.useState(null);
      const [code, setCode] = React.useState("");
      const [paste, setPaste] = React.useState("");
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState("");
      const [copied, setCopied] = React.useState(false);
      const refresh = React.useCallback(() => {
        api("/api/dsh-fleet/status").then((b) => {
          setStatus(b);
        }).catch((e) => {
          setError(e.message);
        });
      }, []);
      React.useEffect(() => {
        api("/api/dsh-fleet/pairing").then((b) => {
          setCode(b.code);
        }).catch(() => {
        });
        refresh();
        const timer = window.setInterval(refresh, 5e3);
        return () => {
          window.clearInterval(timer);
        };
      }, [refresh]);
      const pair = async () => {
        setBusy(true);
        setError("");
        try {
          await api("/api/dsh-fleet/pair", { method: "POST", body: JSON.stringify({ code: paste.trim() }) });
          setPaste("");
          refresh();
        } catch (e) {
          setError(e.message);
        }
        setBusy(false);
      };
      const remove = async (id) => {
        setBusy(true);
        setError("");
        try {
          await api("/api/dsh-fleet/remove", { method: "POST", body: JSON.stringify({ id }) });
          refresh();
        } catch (e) {
          setError(e.message);
        }
        setBusy(false);
      };
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => {
            setCopied(false);
          }, 1500);
        } catch {
          setError("clipboard blocked — select and copy manually");
        }
      };
      const dot = (on) => React.createElement("span", {
        style: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: on ? "#3fb26f" : "#888", flex: "none" }
      });
      return React.createElement(
        "div",
        { "data-fleet-section": true, style: { display: "flex", flexDirection: "column", gap: 18, fontSize: 14 } },
        React.createElement(
          "section",
          { "data-fleet-block": true },
          React.createElement("h3", { style: { margin: "0 0 6px", fontSize: 13, opacity: 0.7, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 } }, "This machine"),
          React.createElement(
            "div",
            null,
            (status?.self.name ?? "…") + "  ·  fleet port " + String(status?.self.dsh_port ?? "…")
          ),
          React.createElement(
            "div",
            { style: { display: "flex", gap: 8, marginTop: 8, alignItems: "flex-start" } },
            React.createElement("textarea", {
              value: code,
              readOnly: true,
              rows: 3,
              style: { flex: 1, fontSize: 11, fontFamily: "monospace", opacity: 0.85, resize: "none" },
              onFocus: (e) => {
                e.currentTarget.select();
              }
            }),
            React.createElement("button", { type: "button", onClick: copy, style: { padding: "6px 12px" } }, copied ? "Copied" : "Copy")
          ),
          React.createElement("div", { style: { fontSize: 12, opacity: 0.6, marginTop: 4 } }, "Pairing code — carries the fleet secret. Treat like a password.")
        ),
        React.createElement(
          "section",
          { "data-fleet-block": true },
          React.createElement("h3", { style: { margin: "0 0 6px", fontSize: 13, opacity: 0.7, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 } }, "Pair a device"),
          React.createElement(
            "div",
            { style: { display: "flex", gap: 8 } },
            React.createElement("textarea", {
              value: paste,
              rows: 3,
              placeholder: "paste their pairing code",
              style: { flex: 1, fontSize: 11, fontFamily: "monospace", resize: "none" },
              onChange: (e) => {
                setPaste(e.currentTarget.value);
              }
            }),
            React.createElement("button", { type: "button", disabled: busy || paste.trim() === "", onClick: pair, style: { padding: "6px 12px" } }, "Pair")
          )
        ),
        React.createElement(
          "section",
          { "data-fleet-block": true },
          React.createElement("h3", { style: { margin: "0 0 6px", fontSize: 13, opacity: 0.7, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 } }, "Devices"),
          (status?.peers.length ?? 0) === 0 ? React.createElement("div", { style: { opacity: 0.6 } }, "No paired devices yet.") : React.createElement(
            "ul",
            { style: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } },
            (status?.peers ?? []).map((p) => React.createElement(
              "li",
              {
                key: p.id,
                "data-fleet-peer": p.id,
                style: { display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8 }
              },
              dot(p.online),
              React.createElement("span", { style: { flex: 1 } }, p.name + (p.online ? "" : " · offline")),
              React.createElement("button", { type: "button", disabled: busy, onClick: () => {
                void remove(p.id);
              }, style: { padding: "2px 10px", fontSize: 12 } }, "Remove")
            ))
          )
        ),
        error !== "" ? React.createElement("div", { style: { color: "#e5607a", fontSize: 13 } }, error) : null
      );
    }

    // src/client/index.ts
    var API = {
      status: "/api/dsh-fleet/status",
      dial: "/api/dsh-fleet/dial"
    };
    var STYLE = "[data-dsh-fleet-row]{margin:2px 10px 6px;display:flex}[data-dsh-fleet-btn]{flex:1;display:flex;align-items:center;gap:6px;padding:5px 10px;border:none;border-radius:8px;cursor:pointer;background:transparent;color:inherit;font:inherit;font-size:12px;text-align:left;overflow:hidden;white-space:nowrap}[data-dsh-fleet-btn]:hover{background:rgba(127,127,127,.15)}[data-dsh-fleet-dot]{width:7px;height:7px;border-radius:50%;background:#888;flex:none}[data-dsh-fleet-dot].on{background:#3fb26f}[data-dsh-fleet-menu]{position:fixed;z-index:2147483000;min-width:200px;max-height:50vh;overflow:auto;background:var(--dsh-bg-elevated,#2a2a2e);color:inherit;border:1px solid rgba(127,127,127,.35);border-radius:10px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.35);font-size:13px}[data-dsh-fleet-item]{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;border:none;border-radius:7px;cursor:pointer;background:transparent;color:inherit;font:inherit;text-align:left}[data-dsh-fleet-item]:hover{background:rgba(127,127,127,.18)}[data-dsh-fleet-item][disabled]{opacity:.5;cursor:default}[data-dsh-fleet-hint]{padding:4px 10px;font-size:11px;opacity:.6}";
    function el(tag, attrs = {}) {
      const node = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs)) {
        if (key === "text") node.textContent = String(value);
        else if (key === "dataset") Object.assign(node.dataset, value);
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
        else if (value !== void 0 && value !== null) node.setAttribute(key, String(value));
      }
      return node;
    }
    async function getJson(path, init) {
      const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers ?? {} } });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? path + " " + String(res.status));
      return body;
    }
    function findNewSessionButton() {
      return document.querySelector('button[class$="_newSession"]');
    }
    function apply(ctx) {
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
        registerSettingsSection(ctx);
      } catch (error) {
        console.warn("[dsh-fleet] settings section failed:", error);
      }
    }
    function registerSettingsSection(ctx) {
      const slots = ctx.slots ?? (typeof ctx.get === "function" ? ctx.get("slots") : void 0);
      if (slots === void 0 || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
      slots.inject("settings.section", () => slots.register({
        name: "settings.section",
        id: "fleet",
        order: 35,
        label: () => "Fleet"
      }, FleetSection));
    }
    function mount() {
      let row = null;
      let menu = null;
      let status = null;
      const closeMenu = () => {
        menu?.remove();
        menu = null;
      };
      const navigate = (href) => {
        window.location.href = href;
      };
      const pick = async (peer) => {
        closeMenu();
        if (peer.online !== true) return;
        try {
          const out = await getJson(API.dial, { method: "POST", body: JSON.stringify({ id: peer.id }) });
          navigate("http://127.0.0.1:" + String(out.port) + "/");
        } catch (error) {
          console.warn("[dsh-fleet] dial failed:", error);
        }
      };
      const openMenu = (anchor2) => {
        closeMenu();
        if (status === null) return;
        const list = el("div", { "data-dsh-fleet-menu": "" });
        list.appendChild(el("div", { "data-dsh-fleet-hint": "", text: "fleet instances" }));
        const selfItem = el("button", {
          "data-dsh-fleet-item": "",
          onclick: () => {
            closeMenu();
            navigate("/");
          }
        });
        selfItem.appendChild(el("span", { "data-dsh-fleet-dot": "", class: "on" }));
        selfItem.appendChild(el("span", { text: status.self.name + " · local" }));
        list.appendChild(selfItem);
        for (const peer of status.peers) {
          if (peer.id === status.self.id) continue;
          const attrs = {
            "data-dsh-fleet-item": "",
            onclick: () => {
              void pick(peer);
            }
          };
          if (peer.online !== true) attrs.disabled = "";
          const item = el("button", attrs);
          item.appendChild(el("span", { "data-dsh-fleet-dot": "", class: peer.online ? "on" : "" }));
          item.appendChild(el("span", { text: peer.name + (peer.online === true ? "" : " · offline") }));
          list.appendChild(item);
        }
        document.body.appendChild(list);
        const rect = anchor2.getBoundingClientRect();
        list.style.left = Math.max(8, rect.left) + "px";
        list.style.top = rect.bottom + 4 + "px";
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
      const buildRow = () => {
        const container = el("div", { "data-dsh-fleet-row": "" });
        const btn = el("button", {
          "data-dsh-fleet-btn": "",
          onclick: (event) => {
            event.stopPropagation();
            if (menu === null) openMenu(container);
            else closeMenu();
          }
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
      let anchor = null;
      const observer = new MutationObserver(() => {
        if (row !== null && row.isConnected && anchor !== null && anchor.isConnected && row.previousElementSibling === anchor) return;
        anchor = findNewSessionButton();
        if (anchor === null) return;
        if (row === null || row.isConnected === false) row = buildRow();
        anchor.after(row);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const refresh = () => {
        getJson(API.status).then((body) => {
          status = body;
          row?.dispatchEvent(new CustomEvent("fleet:update"));
        }).catch(() => {
        });
      };
      refresh();
      window.setInterval(refresh, 5e3);
      window.addEventListener("pagehide", () => {
        observer.disconnect();
        closeMenu();
      }, { once: true });
    }
    var inject = ["slots"];

    Object.defineProperty(module.exports, Symbol.toStringTag, { value: 'Module' })
    return module.exports
  }
})
