window.__ModuleLoader__.load({ id: "dsh-plugin-kit", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
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
var import_react = __toESM(require("react"), 1);
var NS = "settings.pluginKit";
var TABS_KEY = "settings.pluginKit.tab";
var h = import_react.default.createElement;
var CSS_ID = "dsh-plugin-kit/settings.css";
var CSS = `
.ps-suite{max-width:760px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:12px}
.ps-heading{margin:0;font-size:18px;font-weight:600}
.ps-intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:1.55}
.ps-tabs{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:flex-end;gap:22px;margin-top:2px;display:flex;flex-wrap:wrap}
.ps-tab{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;padding:7px 1px 9px;font-size:13px;line-height:20px;position:relative}
.ps-tab:hover,.ps-tab[data-active=true]{color:var(--dsw-alias-label-primary)}
.ps-tab[data-active=true]:after,.ps-tab:focus-visible:after{background:var(--dsw-alias-label-primary);content:"";border-radius:2px 2px 0 0;height:2px;position:absolute;bottom:-1px;left:0;right:0}
.ps-tab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;color:var(--dsw-alias-label-primary);border-radius:2px}
.ps-panel{min-width:0;padding-top:2px}
.ps-empty{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}
`;
if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css="${CSS_ID}"]`) === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-plugin-kit";
  tag.dataset.pluginCss = CSS_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
var zh = {
  nav: "\u63D2\u4EF6\u5408\u96C6",
  title: "\u63D2\u4EF6\u5408\u96C6",
  intro: "\u672C\u90E8\u7F72\u5B89\u88C5\u7684\u63D2\u4EF6\u628A\u81EA\u5DF1\u7684\u8BBE\u7F6E\u9875\u8D21\u732E\u5230\u8FD9\u91CC\uFF0C\u96C6\u4E2D\u5728\u4E00\u4E2A\u5206\u533A\u91CC\u7BA1\u7406\u3002",
  tabs: "\u63D2\u4EF6\u9875\u7B7E",
  empty: "\u672C\u90E8\u7F72\u6CA1\u6709\u53EF\u7528\u7684\u63D2\u4EF6\u914D\u7F6E\u9875\u3002"
};
var en = {
  nav: "Plugin Kit",
  title: "Plugin Kit",
  intro: "Plugins installed in this deployment contribute their settings pages here, grouped into a single section.",
  tabs: "Plugin tabs",
  empty: "This deployment exposes no plugin configuration pages."
};
var inject = ["slots", "locale"];
function resolveLabel(label) {
  return typeof label === "function" ? label() : label;
}
function PluginKitSection({ t, renderSlot, useTabs, tabs: fallbackTabs }) {
  const tabsId = import_react.default.useId();
  const tabRefs = import_react.default.useRef([]);
  const rows = typeof useTabs === "function" ? useTabs((value) => value) : fallbackTabs ?? [];
  const [requestedId, setActiveId] = import_react.default.useState();
  const [visitedIds, setVisitedIds] = import_react.default.useState(() => /* @__PURE__ */ new Set());
  const active = rows.find((row) => row.id === requestedId)?.id ?? rows[0]?.id;
  import_react.default.useEffect(() => {
    if (active === void 0) return;
    setVisitedIds((previous) => {
      if (previous.has(active)) return previous;
      return /* @__PURE__ */ new Set([...previous, active]);
    });
  }, [active]);
  const heading = h("h2", { className: "ps-heading" }, t("title"));
  const intro = h("p", { className: "ps-intro" }, t("intro"));
  if (rows.length === 0) {
    return h("div", { className: "ps-suite" }, heading, intro, h("p", { className: "ps-empty" }, t("empty")));
  }
  const tabBar = h(
    "div",
    { className: "ps-tabs", role: "tablist", "aria-label": t("tabs") },
    rows.map((row, index) => {
      const selected = row.id === active;
      return h("button", {
        key: row.id,
        ref: (element) => {
          tabRefs.current[index] = element;
        },
        id: `${tabsId}-tab-${row.id}`,
        type: "button",
        role: "tab",
        className: "ps-tab",
        "aria-selected": selected,
        "aria-controls": `${tabsId}-panel-${row.id}`,
        "data-active": selected ? "true" : void 0,
        tabIndex: selected ? 0 : -1,
        onClick: () => {
          setActiveId(row.id);
        },
        onKeyDown: (event) => {
          let nextIndex;
          switch (event.key) {
            case "ArrowRight":
              nextIndex = (index + 1) % rows.length;
              break;
            case "ArrowLeft":
              nextIndex = (index - 1 + rows.length) % rows.length;
              break;
            case "Home":
              nextIndex = 0;
              break;
            case "End":
              nextIndex = rows.length - 1;
              break;
            default:
              return;
          }
          event.preventDefault();
          const nextRow = rows[nextIndex];
          const nextTab = tabRefs.current[nextIndex];
          setActiveId(nextRow.id);
          if (nextTab) nextTab.focus();
        }
      }, row.label);
    })
  );
  const panels = rows.filter((row) => row.id === active || visitedIds.has(row.id)).map((row) => {
    const selected = row.id === active;
    return h("div", {
      key: row.id,
      id: `${tabsId}-panel-${row.id}`,
      className: "ps-panel",
      role: "tabpanel",
      "aria-labelledby": `${tabsId}-tab-${row.id}`,
      hidden: !selected
    }, renderSlot(TABS_KEY, {}, { only: row.id }));
  });
  return h("div", { className: "ps-suite" }, heading, intro, tabBar, panels);
}
function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-plugin-kit: section dictionaries");
  let tabsVersion = -1;
  let tabsRevision = -1;
  let tabs = [];
  const tabsSource = {
    getSnapshot: () => {
      const version = ctx.slots.getVersion(TABS_KEY);
      const revision = ctx.locale.getSnapshot().revision;
      if (version !== tabsVersion || revision !== tabsRevision) {
        tabsVersion = version;
        tabsRevision = revision;
        tabs = ctx.slots.entries(TABS_KEY).map((entry) => ({
          id: entry.options.id ?? "",
          order: entry.options.order ?? 0,
          label: resolveLabel(entry.options.label) ?? ""
        })).sort((a, b) => a.order - b.order);
      }
      return tabs;
    },
    subscribe: (listener) => {
      const offLedger = ctx.slots.subscribe(TABS_KEY, listener);
      const offLocale = ctx.locale.subscribe(listener);
      return () => {
        offLedger();
        offLocale();
      };
    }
  };
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "plugin-kit",
    order: 18,
    label: () => t("nav"),
    locale: NS,
    inject: () => ({ tabs: tabsSource.getSnapshot(), hooks: { tabs: tabsSource } }),
    children: {
      [TABS_KEY]: { kind: "list", scope: "root" }
    }
  }, PluginKitSection));
}
return module.exports; } });
