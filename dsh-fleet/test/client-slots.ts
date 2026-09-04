// dsh-fleet client slot contract test — the built bundle must contribute
// its cells through the slot registry (sidebar.footer.action +
// settings.section); React owns all rendering, zero direct DOM work.
import assert from "node:assert/strict";

const injected: Array<{ slot: string; make: () => unknown }> = [];
const registered: Array<{ opts: Record<string, unknown>; component: unknown }> = [];
const slotsStub = {
  inject(slot: string, make: () => unknown) { injected.push({ slot, make }); return undefined; },
  register(opts: Record<string, unknown>, component: unknown) { registered.push({ opts, component }); return () => {}; },
};
(globalThis as any).window = {
  __ModuleLoader__: { load: (m: any) => { (globalThis as any).__fleetLoaded = m; } },
  location: { origin: "http://127.0.0.1:3080", port: "3080", href: "" },
  setInterval: () => 0, clearInterval: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
};
(globalThis as any).localStorage = (globalThis as any).window.localStorage;
(globalThis as any).fetch = () => Promise.reject(new Error("offline test"));
const ReactStub: any = {
  createElement: (tag: any, props: any, ...children: any[]) => ({ tag, props, children }),
  useState: (init: any) => [typeof init === "function" ? init() : init, () => {}],
  useRef: (init: any) => ({ current: init }),
  useEffect: () => {},
  CSSProperties: {},
};

await import("../lib/client.js");
const mod = (globalThis as any).__fleetLoaded;
assert.ok(mod, "bundle did not register with __ModuleLoader__");
const clientApi = mod.factory((name: string) => ({ react: ReactStub })[name] ?? {});
assert.equal(typeof clientApi.apply, "function", "bundle exports apply");
clientApi.apply({ slots: slotsStub });

const slotKeys = injected.map((i) => i.slot);
assert.ok(slotKeys.includes("sidebar.footer.action"), "missing sidebar.footer.action contribution: " + slotKeys.join(","));
assert.ok(slotKeys.includes("settings.section"), "missing settings.section contribution");
injected.find((i) => i.slot === "sidebar.footer.action")!.make();
injected.find((i) => i.slot === "settings.section")!.make();
const footer = registered.find((r) => r.opts.id === "fleet" && r.opts.name === "sidebar.footer.action");
assert.ok(footer, "footer action cell not registered");
assert.equal(typeof footer.component, "function", "footer cell component missing");
const settings = registered.find((r) => r.opts.id === "fleet" && r.opts.name === "settings.section");
assert.ok(settings, "settings cell not registered");

// render smoke: wide row, menu closed -> button element, no menu node
const tree: any = (footer.component as any)({ wide: true });
assert.equal(tree.tag, "div");
assert.equal(tree.children.length, 2);
assert.equal(tree.children[0], null, "closed menu rendered");
assert.equal(tree.children[1].tag, "button");
console.log("PASS slot contributions: " + slotKeys.join(", "));
console.log("PASS footer cell renders (wide) with closed menu; settings cell registered");

console.log("dsh-fleet client slots: all assertions passed");
