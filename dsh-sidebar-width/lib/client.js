window.__ModuleLoader__.load({ id: "dsh-sidebar-width", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
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

// src/client/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react2 = __toESM(require("react"), 1);

// src/client/h.js
var import_react = require("react");
var h = import_react.createElement;

// src/client/kit-tab.js
var KIT_TAB_SLOT = "settings.pluginKit.tab";
function registerKitTab(ctx, options) {
  const slot = options.slot ?? KIT_TAB_SLOT;
  const slots = ctx.slots;
  let dispose;
  let mode;
  const apply2 = () => {
    const declared = slots.spec?.(slot) !== void 0;
    const next = declared ? "tab" : options.fallback ? "fallback" : void 0;
    if (next === mode) return;
    if (dispose) dispose();
    dispose = void 0;
    mode = next;
    dispose = next === "tab" ? options.tab() : next === "fallback" ? options.fallback() : void 0;
  };
  const off = slots.subscribe(slot, apply2);
  apply2();
  ctx.effect(() => () => {
    off();
    if (dispose) dispose();
  }, options.effectName ?? "plugin-kit: settings tab");
}

// src/client/index.js
var NS = "settings.sidebarWidth";
var SETTINGS_NAMESPACE = "sidebar-width";
var SIDEBAR_MIN = 264;
var SIDEBAR_MAX = 420;
var RIGHTBAR_MIN = 300;
var SIDEBAR_AUTO_COLLAPSE = 1024;
var RECORD_DEBOUNCE_MS = 300;
var CSS_ID = "dsh-sidebar-width/settings.css";
var CSS = `
.sw{display:flex;flex-direction:column;gap:14px;max-width:760px;color:var(--dsw-alias-label-primary)}
.sw-title{font-size:18px;font-weight:600;margin:0}
.sw-muted{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.55;margin:0}
.sw-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;margin:0}
.sw-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.sw-form label{display:flex;flex-direction:column;gap:5px;color:var(--dsw-alias-label-secondary);font-size:12px}
.sw-input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:7px}
.sw-actions{display:flex;gap:6px;justify-content:flex-end}
.sw-actions button{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:5px 10px;color:var(--dsw-alias-label-primary);background:transparent}
.sw-actions button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.sw-actions button:disabled{cursor:default;opacity:.5}
.sw-primary{background:var(--dsw-alias-brand-primary)!important;border-color:var(--dsw-alias-brand-primary)!important;color:#fff!important}
.sw-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5;margin:0}
.sw-ok{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:1.5;margin:0}
.sw-live{font-family:var(--ds-font-family-code,monospace);font-size:12px;color:var(--dsw-alias-label-secondary);margin:0}
`;
if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${CSS_ID}"]`) === null) {
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-sidebar-width";
  style.dataset.pluginCss = CSS_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
var zh = {
  tab: "\u4FA7\u680F\u5BBD\u5EA6",
  title: "\u4FA7\u680F\u5BBD\u5EA6",
  intro: "\u628A\u5DE6\u53F3\u4FA7\u8FB9\u680F\u5BBD\u5EA6\u5B58\u6210\u5168\u5C40\u914D\u7F6E\uFF1A\u6362\u4F1A\u8BDD\u3001\u5237\u65B0\u9875\u9762\u3001\u91CD\u542F DSH \u90FD\u4FDD\u6301\u540C\u4E00\u5BBD\u5EA6\u3002DSH \u539F\u751F\u5B8C\u5168\u4E0D\u6301\u4E45\u5316\u5DE6\u4FA7\u680F\uFF0C\u53F3\u4FA7\u680F\u53EA\u6309\u4F1A\u8BDD\u8BB0\u3002",
  sidebarLabel: "\u5DE6\u4FA7\u680F\u5BBD\u5EA6\uFF08px\uFF09",
  rightbarLabel: "\u53F3\u4FA7\u680F\u5BBD\u5EA6\uFF08px\uFF09",
  hint: `\u5DE6\u4FA7\u680F\u539F\u751F\u9650\u5236 ${SIDEBAR_MIN}\u2013${SIDEBAR_MAX}px\uFF1B\u53F3\u4FA7\u680F\u6700\u5C0F ${RIGHTBAR_MIN}px\uFF08\u4E0A\u9650\u662F\u89C6\u53E3\u7684 70%\uFF09\u3002\u586B 0 \u8868\u793A\u300C\u4E0D\u8BBE\u7F6E\u3001\u7528\u539F\u751F\u9ED8\u8BA4\u300D\u3002`,
  live: "\u5F53\u524D\u751F\u6548\uFF1A\u5DE6 {left} \uFF0F \u53F3 {right}",
  liveNone: "\uFF08\u672A\u5C55\u5F00\uFF09",
  save: "\u4FDD\u5B58\u5E76\u5E94\u7528",
  reset: "\u6E05\u9664\u8BB0\u5F55",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u5DF2\u4FDD\u5B58\u5E76\u5E94\u7528\u3002",
  loading: "\u6B63\u5728\u8FDE\u63A5 DSH \u5E03\u5C40\u2026",
  unavailable: "\u62FF\u4E0D\u5230 DSH \u7684\u5E03\u5C40 store\uFF0C\u6B64\u90E8\u7F72\u4E0D\u652F\u6301\u8C03\u6574\u4FA7\u680F\u5BBD\u5EA6\u3002",
  autoHint: "\u76F4\u63A5\u62D6\u52A8\u5206\u9694\u6761\u4E5F\u4F1A\u81EA\u52A8\u8BB0\u5F55\uFF08\u65E0\u9700\u56DE\u5230\u8FD9\u91CC\u70B9\u4FDD\u5B58\uFF09\uFF1B\u6536\u8D77\u4FA7\u680F\u4E0D\u4F1A\u88AB\u8BB0\u5F55\u3002"
};
var en = {
  tab: "Sidebar width",
  title: "Sidebar widths",
  intro: "Keep the left and right sidebar widths in one global setting: they survive session switches, page reloads and DSH restarts. DSH itself persists neither (the right one only per session).",
  sidebarLabel: "Left sidebar width (px)",
  rightbarLabel: "Right sidebar width (px)",
  hint: `The left sidebar is natively clamped to ${SIDEBAR_MIN}\u2013${SIDEBAR_MAX}px; the right one needs at least ${RIGHTBAR_MIN}px (up to 70% of the viewport). 0 means "not set \u2014 keep the native default".`,
  live: "In effect: left {left} / right {right}",
  liveNone: "(collapsed)",
  save: "Save and apply",
  reset: "Forget",
  saving: "Saving\u2026",
  saved: "Saved and applied.",
  loading: "Connecting to the DSH layout\u2026",
  unavailable: "The DSH layout store is unavailable, so this deployment cannot adjust sidebar widths.",
  autoHint: "Dragging the divider is recorded automatically \u2014 no need to come back here. Collapsing a sidebar is never recorded."
};
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
function acquireLayoutStore(ctx, onReady, onUnavailable, timeoutMs = 3e4) {
  const deadline = Date.now() + timeoutMs;
  const timer = setInterval(() => {
    let instance;
    try {
      const entries = ctx.slots.entries?.("root") ?? [];
      const entry = entries[0] ?? ctx.slots.entriesOfSlot?.("root")?.[0];
      const handle = entry?.store;
      instance = typeof handle?.create === "function" ? handle.create() : void 0;
    } catch (error) {
      clearInterval(timer);
      onUnavailable(error);
      return;
    }
    const usable = instance !== void 0 && instance.actions !== void 0 && typeof instance.getSnapshot === "function" && typeof instance.subscribe === "function";
    if (usable) {
      clearInterval(timer);
      onReady(instance);
      return;
    }
    if (Date.now() > deadline) {
      clearInterval(timer);
      onUnavailable();
    }
  }, 200);
  return () => clearInterval(timer);
}
function readWidths(instance) {
  const info = instance.getSnapshot().layoutInfo;
  return { left: info.sidebar, right: info.rightbar ?? 0, viewport: info.viewportWidth };
}
function applyWidths(instance, config, expected) {
  if (config.enabled === false) return readWidths(instance);
  const { left, right, viewport } = readWidths(instance);
  const narrow = (viewport || window.innerWidth || 0) < SIDEBAR_AUTO_COLLAPSE;
  const wantLeft = Number(config.sidebarWidth) || 0;
  if (wantLeft > 0 && !narrow && left > 0) {
    const target = clamp(wantLeft, SIDEBAR_MIN, SIDEBAR_MAX);
    if (left !== target) {
      instance.actions.setSidebar(target);
      expected.sidebar = readWidths(instance).left;
    }
  }
  const wantRight = Number(config.rightbarWidth) || 0;
  if (wantRight > 0) {
    const target = Math.max(RIGHTBAR_MIN, Math.round(wantRight));
    if (right !== target) {
      instance.actions.setRightbar(target);
      expected.rightbar = readWidths(instance).right;
    }
  }
  return readWidths(instance);
}
function useScope(scope) {
  return import_react2.default.useSyncExternalStore(
    (listener) => scope.subscribe(listener),
    () => scope.getSnapshot(),
    () => scope.getSnapshot()
  );
}
function SidebarWidthSettings({ scope, holder, t }) {
  const snapshot = useScope(scope);
  const [draft, setDraft] = import_react2.default.useState(null);
  const [busy, setBusy] = import_react2.default.useState(false);
  const [failure, setFailure] = import_react2.default.useState("");
  const [note, setNote] = import_react2.default.useState("");
  const [live, setLive] = import_react2.default.useState({ left: 0, right: 0 });
  const [, forceTick] = import_react2.default.useState(0);
  const instance = holder?.instance;
  import_react2.default.useEffect(() => {
    const timer = setInterval(() => {
      const current = holder?.instance;
      if (current !== void 0) {
        const { left, right } = readWidths(current);
        setLive({ left, right });
      }
      forceTick((n) => n + 1);
    }, 500);
    return () => clearInterval(timer);
  }, [holder]);
  const saved = snapshot?.value ?? {};
  const value = {
    sidebarWidth: draft?.sidebarWidth ?? saved.sidebarWidth ?? 0,
    rightbarWidth: draft?.rightbarWidth ?? saved.rightbarWidth ?? 0
  };
  const patch = (key, next) => setDraft((old) => ({ ...old ?? value, [key]: next }));
  const save = async () => {
    setFailure("");
    setNote("");
    setBusy(true);
    try {
      const sidebar = clamp(Math.max(0, Number(value.sidebarWidth) || 0), 0, 2e3);
      const rightbar = clamp(Math.max(0, Number(value.rightbarWidth) || 0), 0, 4e3);
      await scope.set("sidebarWidth", sidebar);
      await scope.set("rightbarWidth", rightbar);
      if (holder?.instance !== void 0) {
        applyWidths(holder.instance, { ...saved, sidebarWidth: sidebar, rightbarWidth: rightbar }, {});
      }
      setDraft(null);
      setNote(t("saved"));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setFailure("");
    setNote("");
    setBusy(true);
    try {
      await scope.set("sidebarWidth", 0);
      await scope.set("rightbarWidth", 0);
      setDraft(null);
      setNote(t("saved"));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const fmt = (px) => px > 0 ? `${px}px` : t("liveNone");
  if (snapshot?.status === "loading") return h("p", { className: "sw-muted" }, t("loading"));
  if (snapshot?.status !== "ready" || instance === void 0) {
    return h("p", { className: "sw-error" }, t("unavailable"));
  }
  return h(
    "div",
    { className: "sw" },
    h("h2", { className: "sw-title" }, t("title")),
    h("p", { className: "sw-muted" }, t("intro")),
    h("p", { className: "sw-live" }, t("live", { left: fmt(live.left), right: fmt(live.right) })),
    h(
      "div",
      { className: "sw-form" },
      h(
        "label",
        null,
        t("sidebarLabel"),
        h("input", {
          className: "sw-input",
          type: "number",
          min: 0,
          max: 2e3,
          value: String(value.sidebarWidth),
          onChange: (event) => patch("sidebarWidth", Number(event.target.value) || 0)
        })
      ),
      h(
        "label",
        null,
        t("rightbarLabel"),
        h("input", {
          className: "sw-input",
          type: "number",
          min: 0,
          max: 4e3,
          value: String(value.rightbarWidth),
          onChange: (event) => patch("rightbarWidth", Number(event.target.value) || 0)
        })
      )
    ),
    h("p", { className: "sw-hint" }, t("hint")),
    h("p", { className: "sw-hint" }, t("autoHint")),
    failure ? h("p", { className: "sw-error" }, failure) : null,
    note ? h("p", { className: "sw-ok" }, note) : null,
    h(
      "div",
      { className: "sw-actions" },
      h("button", { className: "sw-primary", onClick: save, disabled: busy }, busy ? t("saving") : t("save")),
      h("button", { className: "sw-secondary", onClick: reset, disabled: busy }, t("reset"))
    )
  );
}
var inject = ["slots", "locale", "configForms"];
function apply(ctx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "sidebar-width: dictionaries");
    const t = ctx.locale.bind(NS);
    const scope = ctx.configForms.get(SETTINGS_NAMESPACE);
    const readConfig = () => scope.getSnapshot()?.value ?? {};
    const expected = { sidebar: void 0, rightbar: void 0 };
    const lastSeen = { sidebar: void 0, rightbar: void 0 };
    let recordTimer = null;
    let recordPending = {};
    const holder = { instance: void 0 };
    const flushRecord = () => {
      recordTimer = null;
      const pending = recordPending;
      recordPending = {};
      const saved = readConfig();
      if (pending.sidebar !== void 0 && pending.sidebar !== saved.sidebarWidth) {
        void scope.set("sidebarWidth", pending.sidebar);
      }
      if (pending.rightbar !== void 0 && pending.rightbar !== saved.rightbarWidth) {
        void scope.set("rightbarWidth", pending.rightbar);
      }
    };
    const onStoreChange = () => {
      if (holder.instance === void 0) return;
      const info = holder.instance.getSnapshot().layoutInfo;
      const saved = readConfig();
      if (info.sidebar > 0 && info.sidebar !== lastSeen.sidebar && info.sidebar !== expected.sidebar && info.sidebar !== saved.sidebarWidth) {
        recordPending.sidebar = info.sidebar;
        expected.sidebar = info.sidebar;
      }
      if ((info.rightbar ?? 0) > 0 && info.rightbar !== lastSeen.rightbar && info.rightbar !== expected.rightbar && info.rightbar !== saved.rightbarWidth) {
        recordPending.rightbar = info.rightbar;
        expected.rightbar = info.rightbar;
      }
      lastSeen.sidebar = info.sidebar;
      if ((info.rightbar ?? 0) > 0) lastSeen.rightbar = info.rightbar;
      if (Object.keys(recordPending).length > 0) {
        if (recordTimer !== null) clearTimeout(recordTimer);
        recordTimer = setTimeout(flushRecord, RECORD_DEBOUNCE_MS);
      }
    };
    const stopDiscovery = acquireLayoutStore(
      ctx,
      (ready) => {
        holder.instance = ready;
        applyWidths(holder.instance, readConfig(), expected);
        const info = holder.instance.getSnapshot().layoutInfo;
        lastSeen.sidebar = info.sidebar;
        if ((info.rightbar ?? 0) > 0) lastSeen.rightbar = info.rightbar;
        const unsubscribe = holder.instance.subscribe(onStoreChange);
        const offConfig = scope.subscribe(() => {
          const config = readConfig();
          if (config.enabled === false) return;
          applyWidths(holder.instance, config, expected);
        });
        ctx.effect(
          () => () => {
            unsubscribe();
            offConfig();
            if (recordTimer !== null) clearTimeout(recordTimer);
          },
          "sidebar-width: layout subscription"
        );
      },
      (error) => {
        console.warn("[dsh-sidebar-width] \u672A\u63A5\u5165 DSH \u5E03\u5C40 store\uFF0C\u4FA7\u680F\u5BBD\u5EA6\u4E0D\u505A\u4EFB\u4F55\u6539\u52A8", error ?? "");
      }
    );
    ctx.effect(() => stopDiscovery, "sidebar-width: layout discovery");
    registerKitTab(ctx, {
      effectName: "sidebar-width: settings tab",
      tab: () => ctx.slots.inject(
        KIT_TAB_SLOT,
        () => ctx.slots.register(
          {
            name: KIT_TAB_SLOT,
            id: "sidebar-width",
            order: 80,
            label: () => t("tab"),
            locale: NS,
            inject: () => ({ scope, t, holder })
          },
          SidebarWidthSettings
        )
      )
    });
  } catch (error) {
    console.warn("[dsh-sidebar-width] client apply failed", error);
  }
}
return module.exports; } });
