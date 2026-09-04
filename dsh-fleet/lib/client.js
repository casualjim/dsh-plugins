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
    var import_react = __toESM(require("react"), 1);

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
    async function getJson(path, init) {
      const res = await fetch(path, init);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? path + " " + String(res.status));
      return body;
    }
    var HOME_KEY = "dsh-fleet:home";
    function homeHref() {
      try {
        return localStorage.getItem(HOME_KEY) ?? window.location.origin;
      } catch {
        return window.location.origin;
      }
    }
    async function pick(peer) {
      if (peer.online !== true) return;
      try {
        const out = await getJson(API.dial, { method: "POST", body: JSON.stringify({ id: peer.id }) });
        window.location.href = "http://127.0.0.1:" + String(out.port) + "/";
      } catch (error) {
        console.warn("[dsh-fleet] dial failed:", error);
      }
    }
    var dotStyle = {
      width: 8,
      height: 8,
      borderRadius: "50%",
      flex: "none"
    };
    var menuItemStyle = {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      padding: "6px 8px",
      border: "none",
      borderRadius: 8,
      background: "transparent",
      color: "inherit",
      font: "inherit",
      fontSize: 12,
      textAlign: "left",
      cursor: "pointer"
    };
    function FleetFooterAction({ wide }) {
      const [status, setStatus] = import_react.default.useState(null);
      const [open, setOpen] = import_react.default.useState(false);
      const rootRef = import_react.default.useRef(null);
      import_react.default.useEffect(() => {
        let alive = true;
        const tick = () => {
          getJson(API.status).then((body) => {
            if (!alive) return;
            setStatus(body);
            if (window.location.port === String(body.self?.dsh_port ?? "")) {
              try {
                localStorage.setItem(HOME_KEY, window.location.origin);
              } catch {
              }
            }
          }).catch(() => {
          });
        };
        tick();
        const timer = window.setInterval(tick, 5e3);
        return () => {
          alive = false;
          window.clearInterval(timer);
        };
      }, []);
      import_react.default.useEffect(() => {
        if (!open) return;
        const onDown = (event) => {
          if (rootRef.current !== null && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", onDown);
        return () => document.removeEventListener("pointerdown", onDown);
      }, [open]);
      const peers = (status?.peers ?? []).filter((p) => p.id !== status?.self.id);
      const online = peers.filter((p) => p.online).length;
      const menu = open === false ? null : import_react.default.createElement(
        "div",
        {
          style: {
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 8,
            right: 8,
            background: "var(--dsh-bg-elevated, #1e1f22)",
            color: "inherit",
            border: "1px solid rgba(127,127,127,.35)",
            borderRadius: 10,
            padding: 4,
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,.35)"
          }
        },
        import_react.default.createElement("div", { style: { fontSize: 11, opacity: 0.55, padding: "4px 8px" } }, "fleet instances"),
        import_react.default.createElement(
          "button",
          {
            onClick: () => {
              setOpen(false);
              window.location.href = homeHref();
            },
            style: menuItemStyle
          },
          import_react.default.createElement("span", { style: { ...dotStyle, background: "#4ade80" } }),
          import_react.default.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, (status?.self.name ?? "local") + " · local")
        ),
        peers.map((peer) => import_react.default.createElement(
          "button",
          {
            key: peer.id,
            onClick: () => {
              setOpen(false);
              void pick(peer);
            },
            disabled: peer.online !== true,
            style: menuItemStyle
          },
          import_react.default.createElement("span", { style: { ...dotStyle, background: peer.online ? "#4ade80" : "rgba(127,127,127,.5)" } }),
          import_react.default.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis" } }, peer.name + (peer.online ? "" : " · offline"))
        ))
      );
      const label = "fleet · " + online + "/" + peers.length;
      return import_react.default.createElement(
        "div",
        { ref: rootRef, style: { position: "relative", width: wide ? "100%" : "auto" } },
        menu,
        import_react.default.createElement(
          "button",
          {
            title: label,
            onClick: () => setOpen((v) => !v),
            style: {
              display: "flex",
              alignItems: "center",
              gap: 6,
              width: wide ? "100%" : "auto",
              padding: wide ? "6px 10px" : "6px 8px",
              border: "none",
              borderRadius: 8,
              background: "rgba(127,127,127,.12)",
              color: "inherit",
              font: "inherit",
              fontSize: 12,
              cursor: "pointer",
              justifyContent: wide ? "flex-start" : "center"
            }
          },
          import_react.default.createElement("span", { style: { ...dotStyle, background: online > 0 ? "#4ade80" : "rgba(127,127,127,.5)" } }),
          wide ? import_react.default.createElement("span", { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, label) : null
        )
      );
    }
    function apply(ctx) {
      try {
        registerSlots(ctx);
      } catch (error) {
        console.warn("[dsh-fleet] client slots failed:", error);
      }
    }
    function registerSlots(ctx) {
      const slots = ctx.slots ?? (typeof ctx.get === "function" ? ctx.get("slots") : void 0);
      if (slots === void 0 || typeof slots.inject !== "function" || typeof slots.register !== "function") return;
      slots.inject("sidebar.footer.action", () => slots.register(
        { name: "sidebar.footer.action", id: "fleet", order: 100 },
        FleetFooterAction
      ));
      slots.inject("settings.section", () => slots.register({
        name: "settings.section",
        id: "fleet",
        order: 35,
        label: () => "Fleet"
      }, FleetSection));
    }
    var inject = ["slots"];

    Object.defineProperty(module.exports, Symbol.toStringTag, { value: 'Module' })
    return module.exports
  }
})
