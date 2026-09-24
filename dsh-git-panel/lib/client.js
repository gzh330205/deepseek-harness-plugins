window.__ModuleLoader__.load({ id: "dsh-git-panel", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
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

// src/client/styles.css
var styles_default = "/* dsh-git-panel\uFF1A\u53F3\u4FA7\u680F Git \u9762\u677F\u6837\u5F0F\u3002\n   \u989C\u8272/\u5B57\u53F7\u6CBF\u7528 DSH \u4E3B\u9898\u53D8\u91CF\uFF08--dsw-*\uFF09\uFF0C\u6CA1\u6709\u53D8\u91CF\u65F6\u56DE\u843D\u5230\u4E2D\u6027\u8272\uFF0C\n   \u56E0\u6B64\u6D45\u8272/\u6DF1\u8272\u4E3B\u9898\u90FD\u80FD\u76F4\u63A5\u8DDF\u968F\uFF0C\u4E0D\u9700\u8981\u63D2\u4EF6\u81EA\u5DF1\u5224\u65AD\u4E3B\u9898\u3002 */\n\n.dgp {\n  --dgp-line: var(--dsw-alias-border-l3, rgba(128, 128, 128, 0.25));\n  --dgp-line-soft: var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.16));\n  --dgp-fg: var(--dsw-alias-label-primary, #1f2328);\n  --dgp-fg-2: var(--dsw-alias-label-secondary, #57606a);\n  --dgp-fg-3: var(--dsw-alias-label-tertiary, #8b949e);\n  --dgp-hover: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12));\n  --dgp-add: var(--dsw-alias-file-diff-added-marker, #2da44e);\n  --dgp-del: var(--dsw-alias-file-diff-deleted-marker, #cf222e);\n  --dgp-warn: var(--dsw-alias-state-warn-primary, #bf8700);\n  --dgp-ok: var(--dsw-alias-state-success-primary, #1a7f37);\n  --dgp-info: var(--dsw-alias-brand-primary, #0969da);\n  --dgp-lane-0: var(--dsw-static-blue-400, #4a8cff);\n  --dgp-lane-1: var(--dsw-alias-state-success-primary, #2da44e);\n  --dgp-lane-2: var(--dsw-static-amber-500, #d29922);\n  --dgp-lane-3: var(--dsw-static-red-400, #f85149);\n  --dgp-lane-4: var(--dsw-static-neutral-600, #8b949e);\n  box-sizing: border-box;\n  display: flex;\n  flex: auto;\n  flex-direction: column;\n  min-height: 0;\n  width: 100%;\n  color: var(--dgp-fg);\n  font-size: var(--dsh-content-font-size-secondary, 13px);\n}\n\n.dgp *,\n.dgp *::before,\n.dgp *::after {\n  box-sizing: border-box;\n}\n\n/* \u9ED8\u8BA4\u53BB\u6389\u6240\u6709\u6309\u94AE\u7684\u5916\u89C2\uFF0C\u518D\u53EA\u7ED9\u771F\u6B63\u9700\u8981\u300C\u6309\u94AE\u611F\u300D\u7684\u4F4D\u7F6E\u52A0\u56DE\u6765\u3002\n   \u7528 `:where(button)` \u628A\u4F18\u5148\u7EA7\u538B\u5230\u4E0E `.dgp-xxx` \u540C\u7EA7\uFF080,1,0\uFF09\uFF0C\u4E8E\u662F\u6BCF\u6761\u5177\u4F53\u89C4\u5219\u90FD\u80FD\n   \u51ED\u6E90\u7801\u987A\u5E8F\u8986\u76D6\u5B83\uFF1B\u4E0D\u8981\u5199\u6210 `.dgp button:not(...)` \u9ED1\u540D\u5355\u2014\u2014\u65B0\u589E\u884C\u5185\u63A7\u4EF6\u5C31\u4F1A\u6F0F\u3002 */\n.dgp :where(button) {\n  background: none;\n  border: none;\n  color: inherit;\n  cursor: pointer;\n  font: inherit;\n  padding: 0;\n}\n\n.dgp :where(button):disabled {\n  cursor: default;\n  opacity: 0.5;\n}\n\n/* \u2500\u2500 \u4E2D\u5FC3\u7A97\u53E3\u5DEE\u5F02\u9875\uFF08root `main` \u5E2D\u4F4D\uFF09 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-page {\n  background: var(--dsw-alias-bg-base, #fff);\n  height: 100%;\n  min-height: 0;\n  overflow: hidden;\n}\n\n.dgp-pagehead {\n  align-items: center;\n  border-bottom: 0.5px solid var(--dgp-line-soft);\n  display: flex;\n  flex: none;\n  gap: 8px;\n  min-height: 38px;\n  padding: 0 8px;\n}\n\n.dgp-pagetitle {\n  flex: none;\n  font-weight: 600;\n  max-width: 60%;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-pagestat {\n  flex: none;\n}\n\n.dgp-pagecount {\n  flex: none;\n  font-variant-numeric: tabular-nums;\n}\n\n.dgp-pagesub {\n  color: var(--dgp-fg-3);\n  flex: none;\n  font-size: 0.92em;\n  padding: 4px 10px 2px;\n  overflow-wrap: anywhere;\n}\n\n.dgp-pagebody {\n  display: flex;\n  flex: auto;\n  flex-direction: column;\n  min-height: 0;\n  overflow: auto;\n}\n\n/* \u4E2D\u5FC3\u5217\u6BD4\u4FA7\u680F\u5BBD\u5F97\u591A\uFF1A\u884C\u53F7\u680F\u7ED9\u5BBD\u4E00\u70B9\uFF0C\u5DE6\u53F3\u5404\u7559\u4E00\u70B9\u8FB9\u8DDD\u3002 */\n.dgp-page .dgp-line {\n  grid-template-columns: 4em 4em 1.2em minmax(0, 1fr);\n}\n\n.dgp-page .dgp-text {\n  padding-right: 24px;\n}\n\n.dgp-page .dgp-diff {\n  font-size: 12.5px;\n  padding-left: 4px;\n}\n\n/* \u2500\u2500 \u5934\u90E8 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n/* \u5934\u90E8\u5C3A\u5BF8\u5BF9\u9F50\u5BBF\u4E3B\u5185\u5EFA\u300C\u6587\u4EF6\u300D\u9875\uFF08dsh-client-ui-sidebar-files\uFF09\uFF1A\n   height 38px\u3001\u5DE6\u5185\u8FB9\u8DDD 16px\u3001\u5206\u9694\u7EBF\u7528 border-l3\u3002\u7B2C\u4E00\u884C + \u5206\u652F\u884C\u5171\u7528\u4E00\u6761\u4E0B\u8FB9\u6846\u3002 */\n.dgp-head {\n  align-items: center;\n  display: flex;\n  flex: none;\n  gap: 4px;\n  height: 38px;\n  padding: 0 6px 0 16px;\n}\n\n.dgp-reponame {\n  align-items: center;\n  display: flex;\n  flex: auto;\n  gap: 5px;\n  min-width: 0;\n  font-weight: 600;\n}\n\n.dgp-branchrow {\n  align-items: center;\n  border-bottom: 0.5px solid var(--dgp-line);\n  color: var(--dgp-fg-2);\n  display: flex;\n  flex: none;\n  gap: 6px;\n  height: 26px;\n  min-width: 0;\n  padding: 0 6px 0 16px;\n}\n\n.dgp-branch {\n  color: var(--dgp-fg);\n  font-weight: 500;\n  max-width: 45%;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-ahead {\n  color: var(--dgp-ok);\n  font-variant-numeric: tabular-nums;\n}\n\n.dgp-behind {\n  color: var(--dgp-info);\n  font-variant-numeric: tabular-nums;\n}\n\n/* \u2500\u2500 \u901A\u7528\u5C0F\u4EF6 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-meta {\n  color: var(--dgp-fg-3);\n  font-size: 0.92em;\n  min-width: 0;\n}\n\n.dgp-ellipsis {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-iconbtn {\n  align-items: center;\n  background: none;\n  border: none;\n  border-radius: 4px;\n  color: var(--dgp-fg-2);\n  cursor: pointer;\n  display: inline-flex;\n  flex: none;\n  justify-content: center;\n  padding: 3px;\n}\n\n.dgp-iconbtn:hover:not(:disabled) {\n  background: var(--dgp-hover);\n  color: var(--dgp-fg);\n}\n\n.dgp-iconbtn:disabled {\n  cursor: default;\n  opacity: 0.45;\n}\n\n.dgp-linkbtn {\n  background: none;\n  border: none;\n  color: var(--dgp-info);\n  cursor: pointer;\n  font-size: 0.92em;\n  padding: 0 2px;\n}\n\n.dgp-linkbtn:disabled {\n  opacity: 0.5;\n}\n\n/* \u6709\u6309\u94AE\u5916\u89C2\u7684\u5730\u65B9\uFF1A\u63D0\u4EA4\u6846\u3001\u8BE6\u60C5\u52A8\u4F5C\u3001\u8868\u5355\u52A8\u4F5C\u3001\u65B0\u5EFA\u5206\u652F\u3001\u52A0\u8F7D\u66F4\u591A\u3002 */\n.dgp-primary,\n.dgp-more,\n.dgp-commitrow button,\n.dgp-detailactions button,\n.dgp-formactions button,\n.dgp-branchnew button {\n  background: var(--dsw-alias-button-tool-bar-fill, rgba(128, 128, 128, 0.12));\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 5px;\n  color: var(--dgp-fg);\n  padding: 3px 8px;\n}\n\n.dgp-primary:hover:not(:disabled),\n.dgp-more:hover:not(:disabled),\n.dgp-commitrow button:hover:not(:disabled),\n.dgp-detailactions button:hover:not(:disabled),\n.dgp-formactions button:hover:not(:disabled),\n.dgp-branchnew button:hover:not(:disabled) {\n  background: var(--dgp-hover);\n}\n\n.dgp-primary {\n  background: var(--dsw-alias-button-primary-fill, var(--dgp-info));\n  border-color: transparent;\n  color: var(--dsw-alias-label-primary-foreground, #fff);\n  font-weight: 500;\n}\n\n.dgp-primary:hover:not(:disabled) {\n  background: var(--dsw-alias-button-primary-hover, var(--dgp-info));\n}\n\n.dgp-dangerbtn {\n  color: var(--dgp-del);\n}\n\n.dgp-primary.dgp-dangerbtn {\n  color: var(--dsw-alias-label-primary-foreground, #fff);\n}\n\n.dgp-more {\n  align-self: center;\n  flex: none;\n  margin: 6px;\n}\n\n.dgp-input {\n  background: var(--dsw-alias-bg-layer-2, transparent);\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 5px;\n  color: var(--dgp-fg);\n  flex: auto;\n  font: inherit;\n  min-width: 0;\n  padding: 3px 6px;\n}\n\n/* \u2500\u2500 \u63D0\u793A\u533A \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-hint {\n  align-items: center;\n  background: var(--dsw-alias-bg-mask-2, rgba(128, 128, 128, 0.08));\n  border-radius: 5px;\n  color: var(--dgp-fg-2);\n  display: flex;\n  flex: none;\n  gap: 6px;\n  margin: 4px 8px;\n  padding: 5px 7px;\n}\n\n.dgp-hint-warn {\n  background: color-mix(in srgb, var(--dgp-warn) 14%, transparent);\n  color: var(--dgp-warn);\n}\n\n.dgp-error {\n  align-items: flex-start;\n  background: color-mix(in srgb, var(--dgp-del) 12%, transparent);\n  border-radius: 5px;\n  color: var(--dgp-del);\n  display: flex;\n  flex: none;\n  font-size: 0.95em;\n  gap: 5px;\n  margin: 4px 8px;\n  padding: 5px 7px;\n}\n\n.dgp-errortext {\n  flex: auto;\n  min-width: 0;\n  overflow-wrap: anywhere;\n}\n\n.dgp-notice {\n  background: color-mix(in srgb, var(--dgp-ok) 12%, transparent);\n  border-radius: 5px;\n  color: var(--dgp-ok);\n  flex: none;\n  font-size: 0.95em;\n  margin: 4px 8px;\n  padding: 5px 7px;\n  overflow-wrap: anywhere;\n}\n\n.dgp-busy {\n  color: var(--dgp-fg-3);\n  flex: none;\n  font-size: 0.92em;\n  padding: 2px 8px;\n}\n\n.dgp-empty {\n  align-items: center;\n  color: var(--dgp-fg-3);\n  display: flex;\n  flex: none;\n  flex-direction: column;\n  gap: 6px;\n  padding: 16px 12px;\n  text-align: center;\n}\n\n.dgp-truncated {\n  color: var(--dgp-warn);\n  font-size: 0.92em;\n  padding: 6px 8px;\n}\n\n/* \u2500\u2500 \u5B50\u9875\u7B7E \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n/* \u4E0E\u5BBF\u4E3B\u9762\u677F\u5185\u7684\u9875\u7B7E\u540C\u6B3E\uFF1A13px/500\uFF0C\u672A\u9009\u4E2D tertiary\uFF0C\u9009\u4E2D business-primary\uFF0C\n   \u4E0B\u5212\u7EBF 2px \u8D34\u5728\u5206\u9694\u7EBF\u4E0A\uFF1B\u5DE6\u5185\u8FB9\u8DDD\u4E0E\u5934\u90E8\u6587\u5B57\u5BF9\u9F50\u3002 */\n.dgp-tabs {\n  border-bottom: 0.5px solid var(--dgp-line);\n  display: flex;\n  flex: none;\n  gap: 24px;\n  padding: 0 6px 0 16px;\n}\n\n.dgp-tab {\n  align-items: center;\n  background: none;\n  border: none;\n  color: var(--dgp-fg-3);\n  cursor: pointer;\n  display: inline-flex;\n  font-size: 13px;\n  font-weight: 500;\n  gap: 4px;\n  line-height: 16px;\n  padding: 10px 0 9px;\n  position: relative;\n}\n\n.dgp-tab::after {\n  background: none;\n  border-radius: 2px;\n  bottom: -1px;\n  content: '';\n  height: 2px;\n  left: 0;\n  position: absolute;\n  right: 0;\n}\n\n.dgp-tab-on {\n  color: var(--dsw-alias-state-business-primary, var(--dgp-info));\n}\n\n.dgp-tab-on::after {\n  background: var(--dsw-alias-state-business-primary, var(--dgp-info));\n}\n\n.dgp-tab:hover {\n  color: var(--dgp-fg-2);\n}\n\n/* \u9009\u4E2D\u6001\u989C\u8272\u7531\u4E0A\u9762\u7684 `.dgp-tab-on` \u7ED9\u51FA\uFF0C\u8FD9\u91CC\u53EA\u8865 hover \u65F6\u4E0D\u538B\u6389\u5B83\u3002 */\n.dgp-tab-on:hover {\n  color: var(--dsw-alias-state-business-primary, var(--dgp-info));\n}\n\n/* \u8BA1\u6570\u8DDF\u968F\u5BBF\u4E3B\u4E60\u60EF\uFF1A\u7EAF\u6570\u5B57\u3001\u4E0D\u586B\u5E95\u8272\uFF08\u4FA7\u680F\u4F1A\u8BDD/\u5DE5\u4F5C\u533A\u8BA1\u6570\u5C31\u662F\u8FD9\u4E2A\u6837\u5B50\uFF09\u3002 */\n.dgp-tabcount {\n  color: inherit;\n  font-size: 12px;\n  font-variant-numeric: tabular-nums;\n  opacity: 0.72;\n  padding: 0 0 0 2px;\n}\n\n/* \u4E0E\u5185\u5EFA\u6587\u4EF6\u5217\u8868\u540C\u6837\u7684\u5185\u7F29\uFF1Abody \u5DE6 8px + \u884C\u5185 10px\uFF0C\u9996\u5B57\u843D\u5728 18px\u3002 */\n.dgp-body {\n  display: flex;\n  flex: auto;\n  flex-direction: column;\n  margin-right: 2px;\n  min-height: 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n  padding: 8px 0 8px 8px;\n  scrollbar-gutter: stable;\n}\n\n.dgp-pane {\n  display: flex;\n  flex-direction: column;\n  min-height: 0;\n  padding-bottom: 8px;\n}\n\n/* \u2500\u2500 \u663E\u793A\u6A21\u5F0F\u5207\u6362\uFF08\u53D8\u66F4\u9875\u9876\u90E8\uFF09 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-viewbar {\n  align-items: center;\n  display: flex;\n  flex: none;\n  flex-wrap: wrap;\n  gap: 4px 6px;\n  padding: 5px 8px 1px;\n}\n\n/* \u5C55\u5F00/\u6298\u53E0\u9760\u53F3\uFF1B\u7A84\u680F\u653E\u4E0D\u4E0B\u65F6\u968F\u6574\u884C\u6362\u884C\uFF0C\u4E0D\u6324\u538B\u524D\u9762\u7684\u5206\u6BB5\u63A7\u4EF6\u3002 */\n.dgp-treeactions {\n  gap: 8px;\n  margin-left: auto;\n}\n\n.dgp-segmented {\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 5px;\n  display: inline-flex;\n  overflow: hidden;\n}\n\n.dgp-segment {\n  background: none;\n  border: none;\n  color: var(--dgp-fg-2);\n  cursor: pointer;\n  font-size: 0.92em;\n  padding: 2px 8px;\n}\n\n.dgp-segment + .dgp-segment {\n  border-left: 0.5px solid var(--dgp-line);\n}\n\n.dgp-segment:hover {\n  background: var(--dgp-hover);\n}\n\n.dgp-segment-on {\n  background: var(--dsw-alias-interactive-bg-hover-accent, color-mix(in srgb, var(--dgp-info) 16%, transparent));\n  color: var(--dgp-fg);\n  font-weight: 500;\n}\n\n/* \u2500\u2500 \u53D8\u66F4\u5217\u8868 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-group {\n  display: flex;\n  flex-direction: column;\n  flex: none;\n}\n\n.dgp-grouphead {\n  align-items: center;\n  color: var(--dgp-fg-2);\n  display: flex;\n  flex: none;\n  gap: 6px;\n  justify-content: space-between;\n  padding: 4px 8px 2px;\n}\n\n.dgp-grouptoggle {\n  align-items: center;\n  background: none;\n  border: none;\n  color: inherit;\n  cursor: pointer;\n  display: inline-flex;\n  gap: 4px;\n  padding: 0;\n  font-weight: 500;\n}\n\n.dgp-grouptitle {\n  font-weight: 500;\n}\n\n.dgp-grouptone {\n  color: inherit;\n}\n\n.dgp-groupcount {\n  color: var(--dgp-fg-3);\n  font-weight: 400;\n}\n\n.dgp-rows {\n  display: flex;\n  flex-direction: column;\n}\n\n.dgp-row {\n  align-items: center;\n  border-radius: 8px;\n  display: flex;\n  gap: 6px;\n  min-height: 26px;\n  padding: 4px 10px;\n}\n\n.dgp-row:hover {\n  background: var(--dgp-hover);\n}\n\n/* \u4E2D\u95F4\u7A97\u53E3\u6B63\u5728\u663E\u793A\u7684\u6587\u4EF6\uFF1A\u884C\u4FDD\u6301\u9AD8\u4EAE\uFF0C\u65B9\u4FBF\u5BF9\u7167\u3002 */\n.dgp-row-on,\n.dgp-row-on:hover {\n  background: var(--dsw-alias-interactive-bg-hover-accent, color-mix(in srgb, var(--dgp-info) 14%, transparent));\n}\n\n/* \u56FA\u5B9A 16px\uFF0C\u548C\u5BBF\u4E3B\u300C\u6587\u4EF6\u300D\u5217\u8868\u7684\u56FE\u6807\u4F4D\u540C\u5BBD\uFF1A\u8FD9\u6837\u6587\u4EF6\u540D\u7684\u8D77\u70B9\uFF08530 + 16 + 6 = 552\uFF09\n   \u4E0E\u5185\u5EFA\u6587\u4EF6\u5217\u8868\u5B8C\u5168\u91CD\u5408\u3002 */\n.dgp-letter {\n  flex: none;\n  font-family: var(--ds-font-family-code, ui-monospace, monospace);\n  font-size: 0.95em;\n  font-weight: 600;\n  text-align: center;\n  width: 16px;\n}\n\n.dgp-tone-add {\n  color: var(--dgp-add);\n}\n\n.dgp-tone-del {\n  color: var(--dgp-del);\n}\n\n.dgp-tone-mod {\n  color: var(--dgp-warn);\n}\n\n.dgp-tone-move {\n  color: var(--dgp-info);\n}\n\n.dgp-tone-conflict {\n  color: var(--dgp-del);\n}\n\n.dgp-name {\n  align-items: baseline;\n  background: none;\n  border: none;\n  color: inherit;\n  cursor: pointer;\n  display: flex;\n  flex: auto;\n  gap: 6px;\n  min-width: 0;\n  padding: 0;\n  text-align: left;\n}\n\n.dgp-name-main {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-name-dir,\n.dgp-name-from {\n  color: var(--dgp-fg-3);\n  flex: none;\n  font-size: 0.88em;\n  max-width: 45%;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-stat {\n  display: inline-flex;\n  flex: none;\n  font-family: var(--ds-font-family-code, ui-monospace, monospace);\n  font-size: 0.88em;\n  gap: 4px;\n}\n\n.dgp-stat-add {\n  color: var(--dgp-add);\n}\n\n.dgp-stat-del {\n  color: var(--dgp-del);\n}\n\n.dgp-rowactions {\n  display: inline-flex;\n  flex: none;\n  gap: 1px;\n  align-items: center;\n}\n\n/* \u2500\u2500 \u76EE\u5F55\u884C\uFF08\u76EE\u5F55\u6A21\u5F0F\uFF09 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-dirrow {\n  gap: 4px;\n}\n\n.dgp-dirtoggle {\n  align-items: center;\n  background: none;\n  border: none;\n  color: var(--dgp-fg-2);\n  cursor: pointer;\n  display: inline-flex;\n  flex: auto;\n  gap: 3px;\n  min-width: 0;\n  padding: 0;\n  text-align: left;\n}\n\n.dgp-dirname {\n  color: var(--dgp-fg);\n  font-weight: 500;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-dircount {\n  flex: none;\n}\n\n/* \u2500\u2500 \u63D0\u4EA4\u6846 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-commitbox {\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 6px;\n  display: flex;\n  flex-direction: column;\n  flex: none;\n  gap: 4px;\n  margin: 6px 8px;\n  padding: 5px;\n}\n\n.dgp-commitmsg {\n  background: none;\n  border: none;\n  color: var(--dgp-fg);\n  font: inherit;\n  min-height: 34px;\n  outline: none;\n  resize: vertical;\n  width: 100%;\n}\n\n.dgp-commitrow {\n  align-items: center;\n  display: flex;\n  gap: 8px;\n  justify-content: space-between;\n}\n\n.dgp-check {\n  align-items: center;\n  color: var(--dgp-fg-2);\n  display: inline-flex;\n  font-size: 0.92em;\n  gap: 4px;\n  cursor: pointer;\n}\n\n/* \u2500\u2500 \u5DEE\u5F02\u8BE6\u60C5 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-detailhead {\n  align-items: center;\n  border-bottom: 0.5px solid var(--dgp-line);\n  display: flex;\n  flex: none;\n  gap: 5px;\n  min-height: 38px;\n  padding: 0 6px 0 16px;\n}\n\n.dgp-detailpath {\n  flex: auto;\n  font-weight: 600;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-detaildir {\n  color: var(--dgp-fg-3);\n  font-size: 0.9em;\n  padding: 3px 8px 0;\n  overflow-wrap: anywhere;\n}\n\n.dgp-detailactions {\n  display: flex;\n  flex: none;\n  gap: 6px;\n  padding: 8px;\n}\n\n.dgp-chip {\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 4px;\n  color: var(--dgp-fg-2);\n  flex: none;\n  font-size: 0.85em;\n  padding: 0 4px;\n}\n\n.dgp-chip-on {\n  border-color: var(--dgp-ok);\n  color: var(--dgp-ok);\n}\n\n.dgp-diff {\n  display: flex;\n  flex-direction: column;\n  flex: none;\n  font: var(--dsw-font-markdown-code-block, 12px/1.6 var(--ds-font-family-code, ui-monospace, monospace));\n  min-width: 0;\n  overflow-x: auto;\n  padding: 4px 0 8px;\n}\n\n.dgp-difffile {\n  display: flex;\n  flex-direction: column;\n  min-width: max-content;\n}\n\n.dgp-difffile-head {\n  align-items: center;\n  background: none;\n  border: none;\n  color: var(--dgp-fg-2);\n  cursor: pointer;\n  display: flex;\n  flex: none;\n  gap: 6px;\n  padding: 3px 8px;\n  text-align: left;\n  position: sticky;\n  left: 0;\n}\n\n.dgp-difffile-path {\n  flex: auto;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-line {\n  display: grid;\n  grid-template-columns: 3.2em 3.2em 1.1em minmax(0, 1fr);\n  line-height: 20px;\n  min-height: 20px;\n  white-space: pre;\n}\n\n.dgp-line-hunk {\n  background: color-mix(in srgb, var(--dgp-info) 10%, transparent);\n  color: var(--dgp-fg-2);\n  display: block;\n  padding: 2px 8px;\n}\n\n.dgp-line-note {\n  color: var(--dgp-fg-3);\n  display: block;\n  font-size: 0.92em;\n  padding: 1px 8px;\n}\n\n.dgp-line-add {\n  --dgp-gutter: var(--dsw-alias-file-diff-added-gutter, color-mix(in srgb, var(--dgp-add) 18%, transparent));\n  background: var(--dsw-alias-file-diff-added-bg, color-mix(in srgb, var(--dgp-add) 12%, transparent));\n}\n\n.dgp-line-del {\n  --dgp-gutter: var(--dsw-alias-file-diff-deleted-gutter, color-mix(in srgb, var(--dgp-del) 18%, transparent));\n  background: var(--dsw-alias-file-diff-deleted-bg, color-mix(in srgb, var(--dgp-del) 12%, transparent));\n}\n\n.dgp-ln {\n  color: var(--dgp-fg-3);\n  padding-right: 6px;\n  text-align: right;\n  user-select: none;\n}\n\n.dgp-line-add .dgp-ln,\n.dgp-line-del .dgp-ln {\n  background: var(--dgp-gutter);\n}\n\n.dgp-line-add .dgp-sign {\n  color: var(--dgp-add);\n}\n\n.dgp-line-del .dgp-sign {\n  color: var(--dgp-del);\n}\n\n.dgp-sign {\n  text-align: center;\n  user-select: none;\n}\n\n.dgp-text {\n  padding-right: 12px;\n}\n\n.dgp-line-ctx .dgp-text {\n  color: var(--dgp-fg-2);\n}\n\n.dgp-note {\n  color: var(--dgp-fg-3);\n}\n\n/* \u2500\u2500 \u5386\u53F2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-historybar {\n  align-items: center;\n  display: flex;\n  flex: none;\n  gap: 4px;\n  padding: 4px 6px;\n}\n\n.dgp-branchbtn {\n  align-items: center;\n  background: none;\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 5px;\n  color: var(--dgp-fg);\n  cursor: pointer;\n  display: inline-flex;\n  flex: auto;\n  gap: 5px;\n  min-width: 0;\n  padding: 3px 6px;\n}\n\n.dgp-branchbtn:hover {\n  background: var(--dgp-hover);\n}\n\n.dgp-clearbtn {\n  color: var(--dgp-fg-3);\n  flex: none;\n  padding: 0 2px;\n}\n\n.dgp-branchpop {\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 6px;\n  display: flex;\n  flex-direction: column;\n  flex: none;\n  margin: 0 8px 4px;\n  max-height: 320px;\n  overflow: hidden;\n}\n\n.dgp-branchpop-head {\n  align-items: center;\n  display: flex;\n  flex: none;\n  gap: 4px;\n  padding: 5px;\n}\n\n.dgp-branchlist {\n  flex: auto;\n  overflow-y: auto;\n  padding-bottom: 4px;\n}\n\n.dgp-branchgroup {\n  color: var(--dgp-fg-3);\n  font-size: 0.85em;\n  padding: 4px 8px 1px;\n}\n\n.dgp-branchitem {\n  align-items: center;\n  background: none;\n  border: none;\n  color: var(--dgp-fg);\n  cursor: pointer;\n  display: flex;\n  gap: 6px;\n  justify-content: space-between;\n  padding: 3px 8px;\n  text-align: left;\n  width: 100%;\n}\n\n.dgp-branchitem:hover:not(:disabled) {\n  background: var(--dgp-hover);\n}\n\n.dgp-branchitem-on {\n  color: var(--dgp-info);\n  font-weight: 600;\n}\n\n.dgp-branchname {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-branchmeta {\n  color: var(--dgp-fg-3);\n  flex: none;\n  font-family: var(--ds-font-family-code, ui-monospace, monospace);\n  font-size: 0.85em;\n}\n\n.dgp-branchnew {\n  align-items: center;\n  border-top: 0.5px solid var(--dgp-line-soft);\n  display: flex;\n  flex: none;\n  gap: 4px;\n  padding: 5px;\n}\n\n.dgp-commitlist {\n  display: flex;\n  flex-direction: column;\n  flex: none;\n}\n\n/* min-height \u5FC5\u987B\u7B49\u4E8E HistoryView.tsx \u7684 ROW_HEIGHT\uFF08validate.mjs \u65AD\u8A00\uFF09\u3002\n   \u7EB5\u5411\u5185\u8FB9\u8DDD\u653E\u5728 .dgp-commitinfo \u4E0A\u800C\u4E0D\u662F\u884C\u4E0A\uFF1A\u884C\u4E00\u65E6\u6709\u7EB5\u5411\u5185\u8FB9\u8DDD\uFF0C\u63D0\u4EA4\u56FE\u5C31\u94FA\u4E0D\u6EE1\n   \u6574\u884C\uFF0C\u76F8\u90BB\u4E24\u884C\u4E4B\u95F4\u4F1A\u9732\u51FA\u65AD\u53E3\uFF08validate.mjs \u4E5F\u4F1A\u62E6\u8FD9\u4E2A\uFF09\u3002 */\n.dgp-commititem {\n  align-items: center;\n  background: none;\n  border: none;\n  color: inherit;\n  cursor: pointer;\n  display: flex;\n  gap: 4px;\n  min-height: 46px;\n  padding: 0 8px 0 2px;\n  text-align: left;\n  width: 100%;\n}\n\n.dgp-commititem:hover {\n  background: var(--dgp-hover);\n}\n\n.dgp-graph {\n  align-self: stretch;\n  display: block;\n  flex: none;\n  position: relative;\n}\n\n.dgp-graphlanes {\n  display: block;\n  height: 100%;\n  inset: 0;\n  overflow: visible;\n  position: absolute;\n  width: 100%;\n}\n\n.dgp-lane {\n  fill: none;\n  stroke-width: 1.6;\n}\n\n.dgp-lane-0 { stroke: var(--dgp-lane-0); }\n.dgp-lane-1 { stroke: var(--dgp-lane-1); }\n.dgp-lane-2 { stroke: var(--dgp-lane-2); }\n.dgp-lane-3 { stroke: var(--dgp-lane-3); }\n.dgp-lane-4 { stroke: var(--dgp-lane-4); }\n\n.dgp-lane-fill-0 { background-color: var(--dgp-lane-0); }\n.dgp-lane-fill-1 { background-color: var(--dgp-lane-1); }\n.dgp-lane-fill-2 { background-color: var(--dgp-lane-2); }\n.dgp-lane-fill-3 { background-color: var(--dgp-lane-3); }\n.dgp-lane-fill-4 { background-color: var(--dgp-lane-4); }\n\n/* \u5706\u70B9\u662F HTML \u5143\u7D20\uFF08\u4E0D\u662F svg circle\uFF09\uFF1A\u6CF3\u9053\u88AB\u7EB5\u5411\u62C9\u4F38\u65F6\u5B83\u4ECD\u7136\u662F\u6B63\u5706\u3002 */\n.dgp-dot {\n  border-radius: 50%;\n  box-shadow: 0 0 0 1.2px var(--dsw-alias-bg-base, #fff);\n  height: 7.2px;\n  position: absolute;\n  top: 50%;\n  transform: translate(-50%, -50%);\n  width: 7.2px;\n}\n\n.dgp-commitinfo {\n  display: flex;\n  flex: auto;\n  flex-direction: column;\n  gap: 2px;\n  min-width: 0;\n  padding: 6px 0;\n}\n\n.dgp-subjectline {\n  align-items: center;\n  display: flex;\n  gap: 6px;\n  min-width: 0;\n}\n\n/* \u4E3B\u9898\u5148\u88AB\u538B\u7F29\uFF08\u7701\u51FA\u7A7A\u95F4\u7ED9 refs \u5FBD\u6807\uFF09\uFF0C\u5FBD\u6807\u4E0D\u88AB\u538B\u7F29\u3002 */\n.dgp-commitsubject {\n  flex: 0 1 auto;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-commitmeta {\n  align-items: center;\n  color: var(--dgp-fg-3);\n  display: flex;\n  font-size: 0.88em;\n  gap: 6px;\n  min-width: 0;\n}\n\n.dgp-hash {\n  color: var(--dgp-info);\n  flex: none;\n  font-family: var(--ds-font-family-code, ui-monospace, monospace);\n  font-size: 0.9em;\n}\n\n.dgp-commitwhen {\n  flex: none;\n}\n\n.dgp-decor {\n  display: flex;\n  flex: none;\n  gap: 3px;\n  min-width: 0;\n  overflow: hidden;\n}\n\n.dgp-decoritem {\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 4px;\n  color: var(--dgp-fg-2);\n  font-size: 0.82em;\n  max-width: 100%;\n  overflow: hidden;\n  padding: 0 4px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-decor-head {\n  border-color: var(--dgp-ok);\n  color: var(--dgp-ok);\n}\n\n.dgp-decor-tag {\n  border-color: var(--dgp-warn);\n  color: var(--dgp-warn);\n}\n\n.dgp-commitbody {\n  display: flex;\n  flex-direction: column;\n  flex: none;\n  gap: 2px;\n  padding: 6px 8px;\n}\n\n.dgp-commitmsgtext {\n  font: inherit;\n  margin: 2px 0 0;\n  max-height: 160px;\n  overflow: auto;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n  color: var(--dgp-fg-2);\n}\n\n.dgp-inlinediff {\n  border-left: 2px solid var(--dgp-line);\n  margin: 0 0 4px 14px;\n  max-height: 420px;\n  overflow: auto;\n}\n\n/* \u2500\u2500 \u5DE5\u4F5C\u6811 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n\n.dgp-wt {\n  border-bottom: 0.5px solid var(--dgp-line-soft);\n  display: flex;\n  flex-direction: column;\n  flex: none;\n  gap: 2px;\n  padding: 5px 8px;\n}\n\n.dgp-wthead {\n  align-items: center;\n  display: flex;\n  gap: 5px;\n  min-width: 0;\n}\n\n.dgp-wtname {\n  flex: auto;\n  font-weight: 600;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dgp-wtmeta {\n  align-items: center;\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px;\n}\n\n.dgp-badge {\n  border: 0.5px solid var(--dgp-line);\n  border-radius: 4px;\n  color: var(--dgp-fg-2);\n  font-size: 0.82em;\n  padding: 0 4px;\n}\n\n.dgp-badge-on {\n  border-color: var(--dgp-info);\n  color: var(--dgp-info);\n}\n\n.dgp-badge-warn {\n  border-color: var(--dgp-warn);\n  color: var(--dgp-warn);\n}\n\n.dgp-badge-ok {\n  border-color: var(--dgp-ok);\n  color: var(--dgp-ok);\n}\n\n.dgp-confirm {\n  background: var(--dsw-alias-bg-mask-2, rgba(128, 128, 128, 0.08));\n  border-radius: 5px;\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n  margin-top: 4px;\n  padding: 6px;\n}\n\n.dgp-confirmtext {\n  overflow-wrap: anywhere;\n}\n\n.dgp-form {\n  border-bottom: 0.5px solid var(--dgp-line-soft);\n  display: flex;\n  flex-direction: column;\n  flex: none;\n  gap: 6px;\n  padding: 6px 8px;\n}\n\n.dgp-field {\n  align-items: center;\n  display: flex;\n  gap: 6px;\n}\n\n.dgp-field > span {\n  color: var(--dgp-fg-2);\n  flex: none;\n  width: 4.6em;\n}\n\n.dgp-radio {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n}\n\n.dgp-formactions {\n  display: flex;\n  gap: 6px;\n}\n";

// src/client/constants.ts
var NS = "gitPanel";
var TAB_ID = "dsh-git-panel";
var TAB_KIND = "git";
var ROUTE = "/dsh-git";
var POLL_INTERVAL_MS = 5e3;
var HISTORY_PAGE_SIZE = 40;

// src/client/locales.ts
var zh = {
  title: "Git",
  guideTitle: "Git \u53D8\u66F4",
  guideDescription: "\u67E5\u770B\u5F85\u63D0\u4EA4\u7684\u53D8\u66F4\u3001\u63D0\u4EA4\u5386\u53F2\u4E0E\u5DE5\u4F5C\u6811",
  "tab.changes": "\u53D8\u66F4",
  "tab.history": "\u5386\u53F2",
  "tab.worktrees": "\u5DE5\u4F5C\u6811",
  loading: "\u6B63\u5728\u8BFB\u53D6 Git \u4FE1\u606F\u2026",
  loadingDiff: "\u6B63\u5728\u8BFB\u53D6\u5DEE\u5F02\u2026",
  working: "\u6B63\u5728\u6267\u884C\u2026",
  refresh: "\u5237\u65B0",
  close: "\u5173\u95ED",
  cancel: "\u53D6\u6D88",
  back: "\u8FD4\u56DE",
  dismiss: "\u5173\u95ED\u63D0\u793A",
  copied: "\u8DEF\u5F84\u5DF2\u590D\u5236\u3002",
  needCwd: "\u8FD8\u6CA1\u6709\u786E\u5B9A\u5DE5\u4F5C\u533A\u76EE\u5F55\uFF0C\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u4F1A\u8BDD\u3002",
  notARepo: "\u5F53\u524D\u5DE5\u4F5C\u533A\u4E0D\u662F Git \u4ED3\u5E93\u3002",
  notARepoHint: "\u5728\u9879\u76EE\u6839\u6267\u884C git init \u540E\u5237\u65B0\u5373\u53EF\u3002",
  openFileUnavailable: "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u5728\u5185\u7F6E\u9884\u89C8\u91CC\u6253\u5F00\u6587\u4EF6\u3002",
  detachedHead: "detached HEAD",
  unbornBranch: "{branch}\uFF08\u8FD8\u6CA1\u6709\u63D0\u4EA4\uFF09",
  badgeWorktree: "worktree",
  stateInProgress: "\u8FDB\u884C\u4E2D\u7684 {state} \u64CD\u4F5C",
  abortMerge: "\u653E\u5F03\u5408\u5E76",
  mergeAborted: "\u5DF2\u653E\u5F03\u672C\u6B21\u5408\u5E76\u3002",
  "kind.modified": "\u5DF2\u4FEE\u6539",
  "kind.added": "\u5DF2\u65B0\u589E",
  "kind.deleted": "\u5DF2\u5220\u9664",
  "kind.renamed": "\u5DF2\u91CD\u547D\u540D",
  "kind.copied": "\u5DF2\u590D\u5236",
  "kind.typechange": "\u7C7B\u578B\u53D8\u66F4",
  "kind.conflicted": "\u51B2\u7A81",
  "kind.untracked": "\u672A\u8DDF\u8E2A",
  "kind.ignored": "\u5DF2\u5FFD\u7565",
  "kind.unknown": "\u53D8\u5316",
  viewMode: "\u663E\u793A",
  openMode: "\u6253\u5F00",
  openCenter: "\u4E2D\u95F4",
  openInline: "\u4FA7\u680F",
  openCenterHint: "\u70B9\u6587\u4EF6\u65F6\u5728\u4E2D\u95F4\u7A97\u53E3\u6253\u5F00\u5DEE\u5F02\uFF08\u53EF\u5173\u95ED\u8FD4\u56DE\u5BF9\u8BDD\uFF09",
  openInlineHint: "\u70B9\u6587\u4EF6\u65F6\u5728\u4FA7\u680F\u5185\u8054\u663E\u793A\u5DEE\u5F02",
  openInCenter: "\u5728\u4E2D\u95F4\u7A97\u53E3\u6253\u5F00",
  centerClose: "\u5173\u95ED\uFF0C\u8FD4\u56DE\u5BF9\u8BDD",
  centerNoTarget: "\u6CA1\u6709\u6B63\u5728\u67E5\u770B\u7684\u6587\u4EF6\uFF1A\u5728\u53F3\u4FA7\u680F\u300C\u53D8\u66F4\u300D\u91CC\u70B9\u4E00\u4E2A\u6587\u4EF6\u5373\u53EF\u3002",
  centerPrev: "\u4E0A\u4E00\u4E2A\u6587\u4EF6",
  centerNext: "\u4E0B\u4E00\u4E2A\u6587\u4EF6",
  centerPosition: "{index} / {total}",
  viewFlat: "\u5217\u8868",
  viewTree: "\u76EE\u5F55",
  viewFlatHint: "\u4E00\u884C\u4E00\u4E2A\u6587\u4EF6\uFF0C\u884C\u5185\u663E\u793A\u76EE\u5F55\u524D\u7F00",
  viewTreeHint: "\u6309\u76EE\u5F55\u6298\u53E0\uFF0C\u76EE\u5F55\u884C\u6C47\u603B\u6587\u4EF6\u6570\u4E0E\u589E\u5220\u884C\u6570",
  dirFiles: "{count} \u4E2A",
  expandAll: "\u5C55\u5F00",
  collapseAll: "\u6298\u53E0",
  expandAllHint: "\u5C55\u5F00\u5168\u90E8\u76EE\u5F55",
  collapseAllHint: "\u6298\u53E0\u5168\u90E8\u76EE\u5F55\uFF08\u53EA\u4FDD\u7559\u76EE\u5F55\u884C\uFF09",
  groupConflicts: "\u51B2\u7A81",
  groupStaged: "\u5DF2\u6682\u5B58",
  groupUntracked: "\u672A\u8DDF\u8E2A",
  groupUnstaged: "\u672A\u6682\u5B58",
  staged: "\u5DF2\u6682\u5B58",
  unstaged: "\u672A\u6682\u5B58",
  untracked: "\u672A\u8DDF\u8E2A",
  stage: "\u6682\u5B58",
  unstage: "\u53D6\u6D88\u6682\u5B58",
  stageAll: "\u5168\u90E8\u6682\u5B58",
  unstageAll: "\u5168\u90E8\u53D6\u6D88",
  discard: "\u653E\u5F03\u66F4\u6539",
  deleteUntracked: "\u5220\u9664\u8BE5\u672A\u8DDF\u8E2A\u6587\u4EF6",
  showDiff: "\u67E5\u770B\u5DEE\u5F02",
  openFile: "\u5728\u5185\u7F6E\u9884\u89C8\u4E2D\u6253\u5F00",
  fileHistory: "\u67E5\u770B\u8BE5\u6587\u4EF6\u7684\u5386\u53F2",
  commit: "\u63D0\u4EA4",
  amend: "\u4FEE\u6539\u4E0A\u4E00\u6B21\u63D0\u4EA4",
  amendConfirm: "\u518D\u6B21\u70B9\u51FB\u786E\u8BA4 amend",
  commitPlaceholder: "\u63D0\u4EA4\u4FE1\u606F\uFF08\u5DF2\u6682\u5B58 {count} \u4E2A\u6587\u4EF6\uFF0CCtrl+Enter \u63D0\u4EA4\uFF09",
  commitDone: "\u5DF2\u63D0\u4EA4\u3002",
  cleanWorktree: "\u5DE5\u4F5C\u533A\u5E72\u51C0\uFF0C\u6CA1\u6709\u5F85\u63D0\u4EA4\u7684\u53D8\u66F4\u3002",
  noTrackedChanges: "\u53EA\u6709\u672A\u8DDF\u8E2A\u6587\u4EF6\u3002",
  changesTruncated: "\u53D8\u66F4\u8FC7\u591A\uFF0C\u53EA\u663E\u793A\u524D {total} \u6761\u4E2D\u7684\u4E00\u90E8\u5206\u3002",
  confirmDiscard: "\u653E\u5F03 {path} \u7684\u672A\u6682\u5B58\u6539\u52A8\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
  confirmDeleteUntracked: "\u5220\u9664\u672A\u8DDF\u8E2A\u6587\u4EF6 {path}\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
  unbornHint: "\u8FD9\u4E2A\u4ED3\u5E93\u8FD8\u6CA1\u6709\u4EFB\u4F55\u63D0\u4EA4\uFF1A\u5148\u6682\u5B58\u6587\u4EF6\u518D\u63D0\u4EA4\u5373\u53EF\u3002",
  noDiff: "\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5DEE\u5F02\uFF08\u53EF\u80FD\u5DF2\u88AB\u6682\u5B58\u3001\u8FD8\u539F\u6216\u5220\u7A7A\uFF09\u3002",
  noDiffUntracked: "\u672A\u8DDF\u8E2A\u6587\u4EF6\u6CA1\u6709\u53EF\u6BD4\u8F83\u7684\u57FA\u7EBF\u3002",
  noContentDiff: "\u8BE5\u6587\u4EF6\u6CA1\u6709\u6587\u672C\u5DEE\u5F02\uFF08\u53EF\u80FD\u53EA\u6709\u6A21\u5F0F\u6216\u5C5E\u6027\u53D8\u5316\uFF09\u3002",
  binaryFile: "\u4E8C\u8FDB\u5236\u6587\u4EF6\uFF0C\u4E0D\u663E\u793A\u5185\u5BB9\u3002",
  newFileNote: "\u65B0\u589E\u6587\u4EF6",
  deletedFileNote: "\u5220\u9664\u6587\u4EF6",
  diffTooLong: "\u5DEE\u5F02\u8FC7\u957F\uFF0C\u53EA\u6E32\u67D3\u524D {lines} \u884C\u3002",
  diffTruncated: "\u5DEE\u5F02\u8D85\u8FC7\u5355\u6B21\u4F20\u8F93\u4E0A\u9650\uFF0C\u5DF2\u622A\u65AD\u3002",
  headRef: "HEAD",
  switchBranch: "\u5207\u6362\u5206\u652F",
  backToHead: "\u56DE\u5230 HEAD",
  branchLocal: "\u672C\u5730\u5206\u652F",
  branchRemote: "\u8FDC\u7A0B\u5206\u652F",
  branchTags: "\u6807\u7B7E",
  filterBranches: "\u7B5B\u9009\u5206\u652F\u2026",
  newBranchPlaceholder: "\u65B0\u5206\u652F\u540D",
  createBranch: "\u521B\u5EFA\u5E76\u5207\u6362",
  checkoutConfirm: "\u5207\u6362\u5230 {ref}\uFF1F\uFF08\u8981\u6C42\u5DE5\u4F5C\u533A\u5E72\u51C0\uFF09",
  createBranchConfirm: "\u4ECE {base} \u521B\u5EFA\u5E76\u5207\u6362\u5230\u65B0\u5206\u652F {ref}\uFF1F",
  checkoutDone: "\u5DF2\u5207\u6362\u5230 {ref}\u3002",
  pathFilter: "\u53EA\u770B {path} \u7684\u5386\u53F2",
  clearFilter: "\u6E05\u9664\u7B5B\u9009",
  noCommits: "\u6CA1\u6709\u63D0\u4EA4\u8BB0\u5F55\u3002",
  loadMore: "\u52A0\u8F7D\u66F4\u591A",
  filesChanged: "{count} \u4E2A\u6587\u4EF6",
  mergeCommit: "\u5408\u5E76\u63D0\u4EA4\uFF08\u6587\u4EF6\u53D8\u5316\u6309\u4E0E\u7B2C\u4E00\u7236\u63D0\u4EA4\u6BD4\u8F83\uFF09",
  binary: "\u4E8C\u8FDB\u5236",
  worktreeRootLabel: "\u5DE5\u4F5C\u6811\u6839\u76EE\u5F55",
  newWorktree: "\u65B0\u5EFA\u5DE5\u4F5C\u6811",
  prune: "\u6E05\u7406\u5931\u6548\u767B\u8BB0",
  worktreeName: "\u540D\u79F0",
  worktreeNamePlaceholder: "\u4F8B\u5982 fix-login",
  worktreeBase: "\u57FA\u7EBF",
  worktreeBaseHead: "\u5F53\u524D HEAD",
  worktreeMode: "\u5F62\u6001",
  modeDetached: "detached\uFF08\u4E0D\u5EFA\u5206\u652F\uFF09",
  modeBranch: "\u65B0\u5EFA\u5206\u652F",
  branchName: "\u5206\u652F\u540D",
  branchNamePlaceholder: "\u4F8B\u5982 dsh/fix-login",
  create: "\u521B\u5EFA",
  creating: "\u521B\u5EFA\u4E2D\u2026",
  removeWorktree: "\u5220\u9664\u5DE5\u4F5C\u6811",
  removeWorktreeConfirm: "\u5220\u9664\u5DE5\u4F5C\u6811 {path}\uFF1F",
  exportPatch: "\u5148\u5BFC\u51FA\u8865\u4E01\uFF08\u542B\u672A\u63D0\u4EA4\u6539\u52A8\uFF09",
  forceRemove: "\u5F3A\u5236\u5220\u9664\uFF08\u4E22\u5F03\u672A\u63D0\u4EA4\u6539\u52A8\uFF09",
  removing: "\u5220\u9664\u4E2D\u2026",
  confirmRemove: "\u786E\u8BA4\u5220\u9664",
  worktreeHint: "\u5DE5\u4F5C\u6811\u662F\u540C\u4E00\u4ED3\u5E93\u7684\u53E6\u4E00\u4EFD\u68C0\u51FA\uFF1A\u9002\u5408\u9694\u79BB\u5E76\u884C\u4EFB\u52A1\u3002\u5408\u5E76\u56DE\u4E3B\u5E72\u8BF7\u7528 git \u547D\u4EE4\u6216\u8BA9 agent \u5904\u7406\u2014\u2014\u672C\u9762\u677F\u4E0D\u4F1A\u81EA\u52A8\u5408\u5E76\u3002",
  worktreeIsolationHint: "\u9ED8\u8BA4 detached\uFF1A\u4E0D\u5360\u7528\u5206\u652F\u540D\uFF0C\u968F\u65F6\u53EF\u5220\uFF1B\u9009\u300C\u65B0\u5EFA\u5206\u652F\u300D\u5219\u76EE\u5F55\u540D\u4E0E\u5206\u652F\u540D\u4E00\u81F4\u3002",
  noWorktrees: "\u8FD8\u6CA1\u6709\u989D\u5916\u7684\u5DE5\u4F5C\u6811\u3002",
  worktreeCreated: "\u5DF2\u521B\u5EFA\u5DE5\u4F5C\u6811\uFF1A{path}",
  worktreeRemoved: "\u5DE5\u4F5C\u6811\u5DF2\u5220\u9664\u3002",
  worktreeRemovedBranchKept: "\u5DE5\u4F5C\u6811\u5DF2\u5220\u9664\uFF0C\u5206\u652F {branch} \u4ECD\u4FDD\u7559\u3002",
  patchExported: "\u8865\u4E01\u5DF2\u5BFC\u51FA\uFF1A{path}",
  pruneNothing: "\u6CA1\u6709\u9700\u8981\u6E05\u7406\u7684\u767B\u8BB0\u3002",
  pruneDone: "\u5DF2\u6E05\u7406\uFF1A{output}",
  worktreeTruncated: "\u5DE5\u4F5C\u6811\u8FC7\u591A\uFF0C\u53EA\u663E\u793A\u524D\u4E00\u90E8\u5206\uFF08\u5171 {total} \u4E2A\uFF09\u3002",
  detached: "detached",
  badgeCurrent: "\u5F53\u524D",
  badgeMain: "\u4E3B\u5DE5\u4F5C\u533A",
  badgeMissing: "\u76EE\u5F55\u5DF2\u4E0D\u5B58\u5728",
  badgeLocked: "\u5DF2\u9501\u5B9A",
  badgePrunable: "\u53EF\u6E05\u7406",
  badgeDirty: "\u672A\u63D0\u4EA4 {count}",
  badgeUnknown: "\u72B6\u6001\u672A\u77E5",
  badgeMerged: "\u5DF2\u5408\u5E76\u4E14\u5E72\u51C0",
  copyPath: "\u590D\u5236\u8DEF\u5F84"
};
var en = {
  title: "Git",
  guideTitle: "Git changes",
  guideDescription: "Pending changes with diffs, commit history and worktrees",
  "tab.changes": "Changes",
  "tab.history": "History",
  "tab.worktrees": "Worktrees",
  loading: "Reading Git information\u2026",
  loadingDiff: "Loading diff\u2026",
  working: "Working\u2026",
  refresh: "Refresh",
  close: "Close",
  cancel: "Cancel",
  back: "Back",
  dismiss: "Dismiss",
  copied: "Path copied.",
  needCwd: "No workspace directory yet \u2014 open a session first.",
  notARepo: "This workspace is not a Git repository.",
  notARepoHint: "Run git init in the project root and refresh.",
  openFileUnavailable: "Opening files in the built-in preview is unavailable here.",
  detachedHead: "detached HEAD",
  unbornBranch: "{branch} (no commits yet)",
  badgeWorktree: "worktree",
  stateInProgress: "{state} in progress",
  abortMerge: "Abort merge",
  mergeAborted: "Merge aborted.",
  "kind.modified": "modified",
  "kind.added": "added",
  "kind.deleted": "deleted",
  "kind.renamed": "renamed",
  "kind.copied": "copied",
  "kind.typechange": "type changed",
  "kind.conflicted": "conflicted",
  "kind.untracked": "untracked",
  "kind.ignored": "ignored",
  "kind.unknown": "changed",
  viewMode: "View",
  openMode: "Open",
  openCenter: "Center",
  openInline: "Sidebar",
  openCenterHint: "Open the diff in the center window (closable, returns to the conversation)",
  openInlineHint: "Show the diff inline in the sidebar",
  openInCenter: "Open in the center window",
  centerClose: "Close and return to the conversation",
  centerNoTarget: "Nothing to show: pick a file in the sidebar Changes tab.",
  centerPrev: "Previous file",
  centerNext: "Next file",
  centerPosition: "{index} / {total}",
  viewFlat: "List",
  viewTree: "Tree",
  viewFlatHint: "One row per file, with the directory shown inline",
  viewTreeHint: "Collapse by directory; directory rows total their files and line counts",
  dirFiles: "{count}",
  expandAll: "Expand",
  collapseAll: "Collapse",
  expandAllHint: "Expand every directory",
  collapseAllHint: "Collapse every directory (directory rows only)",
  groupConflicts: "Conflicts",
  groupStaged: "Staged",
  groupUntracked: "Untracked",
  groupUnstaged: "Changes",
  staged: "Staged",
  unstaged: "Unstaged",
  untracked: "Untracked",
  stage: "Stage",
  unstage: "Unstage",
  stageAll: "Stage all",
  unstageAll: "Unstage all",
  discard: "Discard changes",
  deleteUntracked: "Delete this untracked file",
  showDiff: "Show diff",
  openFile: "Open in built-in preview",
  fileHistory: "History of this file",
  commit: "Commit",
  amend: "Amend last commit",
  amendConfirm: "Click again to confirm amend",
  commitPlaceholder: "Commit message ({count} staged files, Ctrl+Enter to commit)",
  commitDone: "Committed.",
  cleanWorktree: "The working tree is clean.",
  noTrackedChanges: "Only untracked files.",
  changesTruncated: "Too many changes \u2014 showing part of {total}.",
  confirmDiscard: "Discard unstaged changes in {path}? This cannot be undone.",
  confirmDeleteUntracked: "Delete untracked file {path}? This cannot be undone.",
  unbornHint: "This repository has no commits yet: stage files and commit.",
  noDiff: "No diff to show (it may be staged, reverted or emptied).",
  noDiffUntracked: "An untracked file has no baseline to compare against.",
  noContentDiff: "No textual difference (mode or attribute change only).",
  binaryFile: "Binary file \u2014 content not shown.",
  newFileNote: "new file",
  deletedFileNote: "deleted file",
  diffTooLong: "Diff too long \u2014 rendering the first {lines} lines only.",
  diffTruncated: "Diff exceeded the transfer limit and was truncated.",
  headRef: "HEAD",
  switchBranch: "Switch branch",
  backToHead: "Back to HEAD",
  branchLocal: "Local",
  branchRemote: "Remote",
  branchTags: "Tags",
  filterBranches: "Filter\u2026",
  newBranchPlaceholder: "New branch name",
  createBranch: "Create and switch",
  checkoutConfirm: "Switch to {ref}? (requires a clean working tree)",
  createBranchConfirm: "Create and switch to {ref} from {base}?",
  checkoutDone: "Switched to {ref}.",
  pathFilter: "History of {path}",
  clearFilter: "Clear filter",
  noCommits: "No commits.",
  loadMore: "Load more",
  filesChanged: "{count} files",
  mergeCommit: "Merge commit (files compared against the first parent)",
  binary: "binary",
  worktreeRootLabel: "Worktree root",
  newWorktree: "New worktree",
  prune: "Prune stale entries",
  worktreeName: "Name",
  worktreeNamePlaceholder: "e.g. fix-login",
  worktreeBase: "Base",
  worktreeBaseHead: "current HEAD",
  worktreeMode: "Mode",
  modeDetached: "detached (no branch)",
  modeBranch: "new branch",
  branchName: "Branch name",
  branchNamePlaceholder: "e.g. dsh/fix-login",
  create: "Create",
  creating: "Creating\u2026",
  removeWorktree: "Remove worktree",
  removeWorktreeConfirm: "Remove worktree {path}?",
  exportPatch: "Export a patch first (includes uncommitted work)",
  forceRemove: "Force remove (discards uncommitted work)",
  removing: "Removing\u2026",
  confirmRemove: "Confirm removal",
  worktreeHint: "A worktree is another checkout of the same repository \u2014 good for isolating parallel work. Merge it back with git or the agent; this panel never merges automatically.",
  worktreeIsolationHint: "detached by default: no branch is taken, safe to delete; choosing a branch makes the directory name match the branch.",
  noWorktrees: "No extra worktrees yet.",
  worktreeCreated: "Worktree created: {path}",
  worktreeRemoved: "Worktree removed.",
  worktreeRemovedBranchKept: "Worktree removed; branch {branch} was kept.",
  patchExported: "Patch exported: {path}",
  pruneNothing: "Nothing to prune.",
  pruneDone: "Pruned: {output}",
  worktreeTruncated: "Too many worktrees \u2014 showing part of {total}.",
  detached: "detached",
  badgeCurrent: "current",
  badgeMain: "main",
  badgeMissing: "missing",
  badgeLocked: "locked",
  badgePrunable: "prunable",
  badgeDirty: "{count} uncommitted",
  badgeUnknown: "unknown state",
  badgeMerged: "merged & clean",
  copyPath: "Copy path"
};

// src/client/api.ts
var ApiError = class extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
};
async function request(path, init) {
  let response;
  try {
    response = await fetch(`${ROUTE}${path}`, {
      headers: { accept: "application/json", ...init?.body === void 0 ? {} : { "content-type": "application/json" } },
      ...init
    });
  } catch {
    throw new ApiError("\u65E0\u6CD5\u8FDE\u63A5 DSH Host \u7684 Git \u63A5\u53E3\u3002", 0);
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const record = payload ?? {};
  if (response.ok !== true || record.ok !== true) {
    throw new ApiError(record.error ?? `HTTP ${response.status}`, response.status);
  }
  return record;
}
var query = (params) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
};
var post = (action, body) => request(`/${action}`, { method: "POST", body: JSON.stringify(body) });
function createApi() {
  return {
    snapshot: (root) => request(`/snapshot?${query({ root })}`),
    branches: (root) => request(`/branches?${query({ root, limit: 300 })}`),
    history: (root, options = {}) => request(`/history?${query({ root, limit: options.limit, skip: options.skip, ref: options.ref, path: options.path })}`),
    commit: (root, hash, path, orig) => request(`/commit?${query({ root, hash, path, orig })}`),
    diff: (root, options) => request(`/diff?${query({
      root,
      path: options.path,
      orig: options.orig,
      staged: options.staged === true ? 1 : void 0,
      untracked: options.untracked === true ? 1 : void 0,
      context: options.context
    })}`),
    worktrees: (root) => request(`/worktrees?${query({ root })}`)
  };
}
function createActions() {
  return {
    stage: (root, paths) => post("stage", { root, paths }),
    stageAll: (root) => post("stageAll", { root }),
    unstage: (root, paths) => post("unstage", { root, paths }),
    unstageAll: (root) => post("unstageAll", { root }),
    discard: (root, tracked, untracked) => post("discard", { root, tracked, untracked }),
    commit: (root, message, options = {}) => post("commit", { root, message, amend: options.amend === true, signOff: options.signOff === true, confirmAmend: options.amend === true ? true : void 0 }),
    checkout: (root, ref, newBranch) => post("checkout", { root, ref, newBranch }),
    abortMerge: (root) => post("abortMerge", { root }),
    worktreeAdd: (root, request2) => post("worktreeAdd", { root, ...request2 }),
    worktreeRemove: (root, request2) => post("worktreeRemove", { root, ...request2 }),
    worktreePrune: (root) => post("worktreePrune", { root })
  };
}
function errText(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/client/components/GitPanel.tsx
var import_react6 = __toESM(require("react"), 1);

// src/client/format.ts
function basename(path) {
  const normalized = String(path ?? "").replace(/[\\/]+$/, "");
  const at = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return at >= 0 ? normalized.slice(at + 1) : normalized;
}
function dirname(path) {
  const normalized = String(path ?? "").replace(/[\\/]+$/, "");
  const at = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return at > 0 ? normalized.slice(0, at) : "";
}
function absolutePath(repoRoot, relative) {
  const root = String(repoRoot ?? "").replace(/[\\/]+$/, "");
  const rest = String(relative ?? "").replace(/^[\\/]+/, "");
  if (rest === "") return root;
  if (/^[A-Za-z]:/.test(rest) || rest.startsWith("/")) return rest;
  return `${root}/${rest}`;
}
function fileAddressFor(sessionId, path) {
  const encode = (segment) => encodeURIComponent(segment).replace(/%3A/gi, ":");
  const normalized = String(path ?? "").replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
  const encoded = normalized.split("/").map(encode).join("/");
  return `dsh-resource://file/session/${encode(sessionId)}/${encoded}`;
}
function relativeTime(iso, now = Date.now()) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso === "" ? "" : iso;
  const delta = Math.max(0, now - time);
  const minute = 6e4;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "\u521A\u521A";
  if (delta < hour) return `${Math.floor(delta / minute)} \u5206\u949F\u524D`;
  if (delta < day) return `${Math.floor(delta / hour)} \u5C0F\u65F6\u524D`;
  if (delta < 30 * day) return `${Math.floor(delta / day)} \u5929\u524D`;
  return iso.slice(0, 10);
}
function fullTime(iso) {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return iso;
  const date = new Date(time);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// src/client/diff-target.ts
var state = null;
var listeners = /* @__PURE__ */ new Set();
function emit() {
  for (const listener of [...listeners]) listener();
}
function getDiffTarget() {
  return state;
}
function subscribeDiffTarget(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function setDiffTarget(next) {
  state = next;
  emit();
}
function stepDiffTarget(offset) {
  if (state === null || state.items.length === 0) return;
  const total = state.items.length;
  const index = ((state.index + offset) % total + total) % total;
  if (index === state.index) return;
  state = { ...state, index };
  emit();
}
function currentDiffItem() {
  if (state === null || state.items.length === 0) return null;
  return state.items[state.index] ?? state.items[0] ?? null;
}

// src/client/use-diff.ts
var import_react = __toESM(require("react"), 1);
function useFileDiff(api, target, contextLines) {
  const [diff, setDiff] = import_react.default.useState(null);
  const [loading, setLoading] = import_react.default.useState(false);
  const [error, setError] = import_react.default.useState("");
  import_react.default.useEffect(() => {
    if (target === null) {
      setDiff(null);
      setError("");
      setLoading(false);
      return void 0;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await api.diff(target.root, {
          path: target.path,
          orig: target.origPath,
          staged: target.staged,
          untracked: target.untracked,
          context: contextLines
        });
        if (!cancelled) setDiff(response.diff);
      } catch (cause) {
        if (!cancelled) {
          setDiff(null);
          setError(errText(cause));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, target?.root, target?.path, target?.origPath, target?.staged, target?.untracked, target?.fingerprint, contextLines]);
  return { diff, loading, error };
}

// src/client/components/ChangesView.tsx
var import_react3 = __toESM(require("react"), 1);

// src/shared/git-status.js
var UNMODIFIED = ".";
function kindLetter(kind) {
  switch (kind) {
    case "modified":
      return "M";
    case "typechange":
      return "T";
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "copied":
      return "C";
    case "conflicted":
      return "U";
    case "untracked":
      return "?";
    case "ignored":
      return "!";
    default:
      return "\xB7";
  }
}
function kindTone(kind) {
  switch (kind) {
    case "added":
    case "untracked":
      return "add";
    case "deleted":
      return "del";
    case "conflicted":
      return "conflict";
    case "renamed":
    case "copied":
    case "typechange":
      return "move";
    default:
      return "mod";
  }
}
function isStaged(entry) {
  return entry.untracked !== true && entry.conflicted !== true && entry.index !== UNMODIFIED && entry.index !== "?" && entry.index !== "!";
}
function isUnstaged(entry) {
  if (entry.conflicted === true) return true;
  if (entry.untracked === true) return true;
  return entry.worktree !== UNMODIFIED && entry.worktree !== "?" && entry.worktree !== "!";
}
function groupChanges(entries) {
  const conflicts = [];
  const staged = [];
  const untracked = [];
  const unstaged = [];
  for (const entry of entries) {
    if (entry.conflicted === true) {
      conflicts.push(entry);
      continue;
    }
    if (isStaged(entry)) staged.push(entry);
    if (entry.untracked === true) untracked.push(entry);
    else if (isUnstaged(entry)) unstaged.push(entry);
  }
  return { conflicts, staged, untracked, unstaged };
}
function statBadge(entry) {
  if (entry.binary === true) return null;
  const additions = typeof entry.additions === "number" ? entry.additions : null;
  const deletions = typeof entry.deletions === "number" ? entry.deletions : null;
  if (additions === null && deletions === null) return null;
  return { additions: additions ?? 0, deletions: deletions ?? 0 };
}

// src/shared/change-tree.js
function makeDirectory(name, path) {
  return {
    type: "dir",
    name,
    path,
    children: [],
    files: 0,
    staged: { additions: 0, deletions: 0, binary: false, unknown: true },
    worktree: { additions: 0, deletions: 0, binary: false, unknown: true }
  };
}
var compareNames = (left, right) => left.name.localeCompare(right.name, void 0, { numeric: true, sensitivity: "base" });
function mergeStats(target, stat) {
  if (stat === null || stat === void 0) return;
  const known = typeof stat.additions === "number" || typeof stat.deletions === "number" || stat.binary === true;
  if (!known) return;
  target.unknown = false;
  if (typeof stat.additions === "number") target.additions += stat.additions;
  if (typeof stat.deletions === "number") target.deletions += stat.deletions;
  if (stat.binary === true) target.binary = true;
}
function aggregate(node) {
  if (node.type === "file") return node;
  for (const child of node.children) {
    aggregate(child);
    if (child.type === "file") {
      node.files += 1;
      mergeStats(node.staged, child.entry?.stats?.staged);
      mergeStats(node.worktree, child.entry?.stats?.worktree);
    } else {
      node.files += child.files;
      for (const side of ["staged", "worktree"]) {
        if (child[side].unknown === false) {
          node[side].unknown = false;
          node[side].additions += child[side].additions;
          node[side].deletions += child[side].deletions;
          node[side].binary = node[side].binary || child[side].binary;
        }
      }
    }
  }
  return node;
}
function normalize(node, isRoot) {
  if (node.type === "file") return node;
  node.children = node.children.map((child) => normalize(child, false));
  node.children.sort((left, right) => left.type === right.type ? compareNames(left, right) : left.type === "dir" ? -1 : 1);
  while (!isRoot && node.children.length === 1 && node.children[0].type === "dir") {
    const only = node.children[0];
    node.name = `${node.name}/${only.name}`;
    node.path = only.path;
    node.children = only.children;
    node.files = only.files;
    node.staged = only.staged;
    node.worktree = only.worktree;
  }
  return node;
}
function buildChangeTree(entries) {
  const root = makeDirectory("", "");
  for (const entry of entries ?? []) {
    const path = String(entry?.path ?? "");
    if (path === "") continue;
    const segments = path.split("/").filter((segment) => segment !== "");
    if (segments.length === 0) continue;
    let node = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      let child = node.children.find((candidate) => candidate.type === "dir" && candidate.name === segment);
      if (child === void 0) {
        child = makeDirectory(segment, node.path === "" ? segment : `${node.path}/${segment}`);
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({ type: "file", name: segments[segments.length - 1], path, entry });
  }
  aggregate(root);
  return normalize(root, true);
}
function collectDirectoryPaths(node) {
  if (node === null || node === void 0 || node.type !== "dir") return [];
  const paths = [];
  for (const child of node.children ?? []) {
    if (child.type !== "dir") continue;
    paths.push(child.path);
    paths.push(...collectDirectoryPaths(child));
  }
  return paths;
}

// src/client/components/DiffView.tsx
var import_react2 = __toESM(require("react"), 1);

// src/client/components/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var base = (size, className) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className,
  "aria-hidden": true
});
function IconGit({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "4", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "12", r: "2" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 6v4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 12 4.5 8.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "4", cy: "4.5", r: "1.6" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4 6.1v3.2" })
  ] });
}
function IconBranch({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "4.5", cy: "4", r: "1.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "4.5", cy: "12", r: "1.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "11.5", cy: "6", r: "1.8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.5 5.8v4.4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M11.5 7.8c0 2-1.6 3.4-4 3.4H6.3" })
  ] });
}
function IconWorktree({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "1.8", y: "2.5", width: "5", height: "4", rx: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "9.2", y: "9.5", width: "5", height: "4", rx: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.3 6.5v3.2c0 .8.6 1.4 1.4 1.4h3.5" })
  ] });
}
function IconRefresh({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13 8a5 5 0 1 1-1.6-3.7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13 2.5V5h-2.6" })
  ] });
}
function IconPlus({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...base(size, className), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 3.5v9M3.5 8h9" }) });
}
function IconMinus({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...base(size, className), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3.5 8h9" }) });
}
function IconUndo({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 8a5 5 0 1 0 1.6-3.7" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 2.5V5h2.6" })
  ] });
}
function IconChevron({ size = 16, className, open = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...base(size, className), style: { transform: open ? "rotate(90deg)" : void 0, transition: "transform .12s ease" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6 3.5 10.5 8 6 12.5" }) });
}
function IconChevronLeft({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...base(size, className), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M10 3.5 5.5 8 10 12.5" }) });
}
function IconBack({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...base(size, className), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9.5 3.5 5 8l4.5 4.5" }) });
}
function IconExternal({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 3.5H3.5v9h9v-3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9.5 3.5h3v3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12.5 3.5 7.5 8.5" })
  ] });
}
function IconTrash({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 4.5h10" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M4.5 4.5V13h7V4.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 4.5V3h3v1.5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.8 7v3.5M9.2 7v3.5" })
  ] });
}
function IconWarning({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 2.5 14 13H2z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 6.5v3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 11.3v.2" })
  ] });
}
function IconExpand({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9.5 2.5h4v4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M13.5 2.5 8 8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.5 13.5h-4v-4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.5 13.5 8 8" })
  ] });
}
function IconCopy({ size = 16, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...base(size, className), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "5.5", y: "2.5", width: "7", height: "8", rx: "1" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3.5 5.5v8h7" })
  ] });
}

// src/client/components/DiffView.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var MAX_RENDER_LINES = 3e3;
var SIGN = { add: "+", del: "-", ctx: " ", note: "" };
function lineClass(line) {
  if (line.type === "note") return "dgp-line dgp-line-note";
  return `dgp-line dgp-line-${line.type}`;
}
function lineCount(file) {
  return file.hunks.reduce((sum, hunk) => sum + hunk.lines.length + 1, 0);
}
function HunkView({ hunk, budget }) {
  if (budget.left <= 0) return null;
  const lines = [];
  budget.left -= 1;
  lines.push(
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-line dgp-line-hunk", title: hunk.section, children: hunk.header }, "header")
  );
  for (let index = 0; index < hunk.lines.length; index += 1) {
    if (budget.left <= 0) break;
    const line = hunk.lines[index];
    budget.left -= 1;
    if (line.type === "note") {
      lines.push(
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: lineClass(line), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-note", children: line.text }) }, index)
      );
      continue;
    }
    lines.push(
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: lineClass(line), children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-ln", children: line.oldNumber ?? "" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-ln", children: line.newNumber ?? "" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-sign", children: SIGN[line.type] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-text", children: line.text === "" ? "\xA0" : line.text })
      ] }, index)
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: lines });
}
function DiffView(props) {
  const { files, t } = props;
  const [collapsed, setCollapsed] = import_react2.default.useState({});
  if (files.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: props.emptyHint ?? t("noDiff") });
  }
  const budget = { left: MAX_RENDER_LINES };
  const showHeaders = props.showFileHeaders === true || files.length > 1;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-diff", children: [
    files.map((file, index) => {
      const key = `${file.path}:${index}`;
      const isCollapsed = collapsed[key] === true;
      const total = lineCount(file);
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dgp-difffile", children: [
        showHeaders && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "button",
          {
            type: "button",
            className: "dgp-difffile-head",
            onClick: () => setCollapsed((current) => ({ ...current, [key]: !isCollapsed })),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(IconChevron, { size: 12, open: !isCollapsed }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-difffile-path", title: file.path, children: file.renameFrom !== "" && file.renameFrom !== file.path ? `${file.renameFrom} \u2192 ${file.path}` : file.path }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-stat-add", children: [
                "+",
                file.additions
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dgp-stat-del", children: [
                "\u2212",
                file.deletions
              ] })
            ]
          }
        ),
        !isCollapsed && file.binary && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: file.binaryNote || t("binaryFile") }),
        !isCollapsed && !file.binary && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          file.newFile && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-line dgp-line-note", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-note", children: t("newFileNote") }) }),
          file.deletedFile && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-line dgp-line-note", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dgp-note", children: t("deletedFileNote") }) }),
          file.hunks.map((hunk, hunkIndex) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(HunkView, { hunk, budget }, hunkIndex)),
          !file.binary && total === 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-empty", children: t("noContentDiff") })
        ] })
      ] }, key);
    }),
    budget.left <= 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-truncated", children: t("diffTooLong", { lines: MAX_RENDER_LINES }) }),
    props.truncated === true && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dgp-truncated", children: t("diffTruncated") })
  ] });
}

// src/client/components/ChangesView.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var VIEW_STORAGE_KEY = "dsh-git-panel/changes-view";
var OPEN_STORAGE_KEY = "dsh-git-panel/diff-open-target";
function readStoredViewMode() {
  try {
    if (typeof window === "undefined" || window.localStorage === void 0) return "flat";
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "tree" ? "tree" : "flat";
  } catch {
    return "flat";
  }
}
function storeViewMode(mode) {
  try {
    if (typeof window === "undefined" || window.localStorage === void 0) return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
  }
}
function readStoredOpenTarget() {
  try {
    if (typeof window === "undefined" || window.localStorage === void 0) return "center";
    return window.localStorage.getItem(OPEN_STORAGE_KEY) === "inline" ? "inline" : "center";
  } catch {
    return "center";
  }
}
function storeOpenTarget(target) {
  try {
    if (typeof window === "undefined" || window.localStorage === void 0) return;
    window.localStorage.setItem(OPEN_STORAGE_KEY, target);
  } catch {
  }
}
var EMPTY_TREE = buildChangeTree([]);
function StatBadge({ entry, side }) {
  const stat = entry.stats?.[side] ?? null;
  if (stat === null) return null;
  const badge = statBadge(stat);
  if (badge === null) return stat.binary ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-meta", children: "bin" }) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-stat", children: [
    badge.additions > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-stat-add", children: [
      "+",
      badge.additions
    ] }),
    badge.deletions > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-stat-del", children: [
      "\u2212",
      badge.deletions
    ] })
  ] });
}
function AggregateBadge({ stats }) {
  if (stats.unknown === true) return null;
  if (stats.binary === true && stats.additions === 0 && stats.deletions === 0) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-meta", children: "bin" });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-stat", children: [
    stats.additions > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-stat-add", children: [
      "+",
      stats.additions
    ] }),
    stats.deletions > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-stat-del", children: [
      "\u2212",
      stats.deletions
    ] })
  ] });
}
function ChangeRow(props) {
  const { entry, side, t } = props;
  const directory = dirname(entry.path);
  const renamed = entry.origPath !== void 0 && entry.origPath !== entry.path;
  const indent = props.depth === void 0 ? void 0 : { paddingLeft: 10 + props.depth * 12 };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `dgp-row${props.active === true ? " dgp-row-on" : ""}`, style: indent, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `dgp-letter dgp-tone-${kindTone(entry.kind)}`, title: t(`kind.${entry.kind}`), children: kindLetter(entry.kind) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: "dgp-name", onClick: props.onOpen, title: entry.path, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-name-main", children: basename(entry.path) }),
      props.hideDirectory !== true && directory !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-name-dir", children: directory }),
      renamed && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-name-from", children: [
        "\u2190 ",
        entry.origPath
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(StatBadge, { entry, side }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-rowactions", children: props.actions })
  ] });
}
function TreeNodes(props) {
  const { nodes, depth, side, t } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: nodes.map((node) => {
    if (node.type === "file") return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react3.default.Fragment, { children: props.renderFile(node.entry, depth) }, node.path);
    const open = props.collapsed[node.path] !== true;
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react3.default.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-row dgp-dirrow", style: { paddingLeft: 6 + depth * 12 }, title: node.path, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: "dgp-dirtoggle", onClick: () => props.toggle(node.path), children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconChevron, { size: 12, open }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-dirname", children: node.name })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-meta dgp-dircount", children: t("dirFiles", { count: node.files }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(AggregateBadge, { stats: node[side] })
      ] }),
      open && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        TreeNodes,
        {
          nodes: node.children,
          depth: depth + 1,
          side,
          t,
          collapsed: props.collapsed,
          toggle: props.toggle,
          renderFile: props.renderFile
        }
      )
    ] }, node.path);
  }) });
}
function ChangeTree(props) {
  if (props.mode !== "tree") {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: props.entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react3.default.Fragment, { children: props.renderFile(entry, 0) }, entry.path)) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    TreeNodes,
    {
      nodes: props.tree.children,
      depth: 0,
      side: props.side,
      t: props.t,
      collapsed: props.collapsed,
      toggle: props.onToggle,
      renderFile: props.renderFile
    }
  ) });
}
function Group(props) {
  const [open, setOpen] = import_react3.default.useState(true);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dgp-group", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-grouphead", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: "dgp-grouptoggle", onClick: () => setOpen((value) => !value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconChevron, { size: 12, open }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `dgp-grouptitle${props.tone === void 0 ? "" : ` dgp-tone-${props.tone}`}`, children: props.title }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-groupcount", children: props.count })
      ] }),
      props.action
    ] }),
    open && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-rows", children: props.children })
  ] });
}
function CommitBox(props) {
  const [message, setMessage] = import_react3.default.useState("");
  const [amend, setAmend] = import_react3.default.useState(false);
  const [confirming, setConfirming] = import_react3.default.useState(false);
  const { t } = props;
  import_react3.default.useEffect(() => {
    if (props.stagedCount === 0) {
      setMessage("");
      setAmend(false);
      setConfirming(false);
    }
  }, [props.stagedCount]);
  const submit = () => {
    if (message.trim() === "") return;
    if (amend && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    props.onCommit(message, amend);
    setMessage("");
    setAmend(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-commitbox", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "textarea",
      {
        className: "dgp-commitmsg",
        placeholder: t("commitPlaceholder", { count: props.stagedCount }),
        value: message,
        rows: 2,
        onChange: (event) => {
          setMessage(event.target.value);
          setConfirming(false);
        },
        onKeyDown: (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-commitrow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: "dgp-check", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "input",
          {
            type: "checkbox",
            checked: amend,
            onChange: (event) => {
              setAmend(event.target.checked);
              setConfirming(false);
            }
          }
        ),
        t("amend")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          className: `dgp-primary${confirming ? " dgp-dangerbtn" : ""}`,
          disabled: message.trim() === "" || props.busy !== "",
          onClick: submit,
          children: confirming ? t("amendConfirm") : t("commit")
        }
      )
    ] })
  ] });
}
function ChangesView(props) {
  const { snapshot, selection, t } = props;
  const [mode, setMode] = import_react3.default.useState(readStoredViewMode);
  const [openTarget, setOpenTarget] = import_react3.default.useState(readStoredOpenTarget);
  const switchMode = import_react3.default.useCallback((next) => {
    setMode(next);
    storeViewMode(next);
  }, []);
  const switchOpenTarget = import_react3.default.useCallback((next) => {
    setOpenTarget(next);
    storeOpenTarget(next);
  }, []);
  const { groups, trees } = import_react3.default.useMemo(() => {
    const next = groupChanges(snapshot.changes);
    if (mode !== "tree") return { groups: next, trees: null };
    return {
      groups: next,
      trees: {
        conflicts: buildChangeTree(next.conflicts),
        staged: buildChangeTree(next.staged),
        untracked: buildChangeTree(next.untracked),
        unstaged: buildChangeTree(next.unstaged)
      }
    };
  }, [mode, snapshot.changes]);
  const [collapsed, setCollapsed] = import_react3.default.useState({});
  const toggleDirectory = import_react3.default.useCallback((path) => {
    setCollapsed((current) => ({ ...current, [path]: current[path] !== true }));
  }, []);
  const directoryPaths = import_react3.default.useMemo(() => {
    if (trees === null) return [];
    return [.../* @__PURE__ */ new Set([
      ...collectDirectoryPaths(trees.conflicts),
      ...collectDirectoryPaths(trees.staged),
      ...collectDirectoryPaths(trees.untracked),
      ...collectDirectoryPaths(trees.unstaged)
    ])];
  }, [trees]);
  const collapsedCount = directoryPaths.filter((path) => collapsed[path] === true).length;
  const expandAll = import_react3.default.useCallback(() => setCollapsed({}), []);
  const collapseAll = import_react3.default.useCallback(() => setCollapsed(Object.fromEntries(directoryPaths.map((path) => [path, true]))), [directoryPaths]);
  const toItem = import_react3.default.useCallback(
    (entry, side) => ({
      path: entry.path,
      origPath: entry.origPath,
      staged: side === "staged",
      untracked: side === "worktree" && entry.untracked === true,
      kind: entry.kind
    }),
    []
  );
  const openEntry = import_react3.default.useCallback(
    (entries, entry, side) => {
      if (openTarget === "center" && props.centerAvailable && props.onOpenInCenter !== void 0) {
        const index = entries.indexOf(entry);
        props.onOpenInCenter(entries.map((candidate) => toItem(candidate, side)), index < 0 ? 0 : index);
        return;
      }
      props.onSelect({
        path: entry.path,
        origPath: entry.origPath,
        staged: side === "staged",
        untracked: side === "worktree" && entry.untracked === true,
        kind: entry.kind
      });
    },
    [openTarget, props, toItem]
  );
  const onlyUntracked = groups.untracked.length > 0 && groups.staged.length === 0 && groups.unstaged.length === 0 && groups.conflicts.length === 0;
  if (selection !== null) {
    const entry = snapshot.changes.find((item) => item.path === selection.path);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-pane", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-detailhead", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-iconbtn", onClick: () => props.onSelect(null), title: t("back"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconBack, { size: 14 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-detailpath", title: selection.path, children: basename(selection.path) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `dgp-chip${selection.staged ? " dgp-chip-on" : ""}`, children: selection.staged ? t("staged") : selection.untracked ? t("untracked") : t("unstaged") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-rowactions", children: [
          props.centerAvailable && props.onOpenInCenter !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "dgp-iconbtn",
              title: t("openInCenter"),
              onClick: () => {
                const entry2 = snapshot.changes.find((item) => item.path === selection.path);
                const side = selection.staged ? "staged" : "worktree";
                const entries = selection.staged ? groups.staged : selection.untracked ? groups.untracked : groups.unstaged;
                const index = entry2 === void 0 ? 0 : Math.max(0, entries.indexOf(entry2));
                props.onOpenInCenter?.((entries.length === 0 ? [entry2].filter(Boolean) : entries).map((item) => toItem(item, side)), index);
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconExpand, { size: 14 })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-iconbtn", onClick: () => props.onOpenFile(selection.path), title: t("openFile"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconExternal, { size: 14 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-iconbtn", onClick: () => props.onShowFileHistory(selection.path), title: t("fileHistory"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconUndo, { size: 14 }) })
        ] })
      ] }),
      dirname(selection.path) !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-detaildir", children: dirname(selection.path) }),
      props.diffError !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-error", children: props.diffError }),
      props.diffLoading && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-empty", children: t("loadingDiff") }),
      !props.diffLoading && props.diff !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        DiffView,
        {
          files: props.diff.file === null ? [] : [props.diff.file],
          truncated: props.diff.truncated,
          emptyHint: props.diff.untracked ? t("noDiffUntracked") : t("noDiff"),
          t
        }
      ),
      entry !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-detailactions", children: selection.staged ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", title: t("unstage"), disabled: props.busy !== "", onClick: () => props.onUnstage([selection.path]), children: t("unstage") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", title: t("stage"), disabled: props.busy !== "", onClick: () => props.onStage([selection.path]), children: t("stage") }) })
    ] });
  }
  const renderRow = (side, entries, entry, depth, actions) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    ChangeRow,
    {
      entry,
      side,
      t,
      depth: mode === "tree" ? depth : void 0,
      hideDirectory: mode === "tree",
      active: props.activePath !== void 0 && props.activePath === entry.path,
      onOpen: () => openEntry(entries, entry, side),
      actions
    }
  );
  const stageButton = (entry) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("stage"), disabled: props.busy !== "", onClick: () => props.onStage([entry.path]), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconPlus, { size: 13 }) });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-pane", children: [
    snapshot.repo?.unborn === true && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-hint", children: t("unbornHint") }),
    snapshot.repo !== null && snapshot.repo.state !== "clean" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-hint dgp-hint-warn", children: t("stateInProgress", { state: snapshot.repo.state }) }),
    snapshot.counts.staged > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(CommitBox, { t, stagedCount: snapshot.counts.staged, busy: props.busy, onCommit: props.onCommit }),
    snapshot.changes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dgp-viewbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-meta", children: t("viewMode") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-segmented", role: "group", "aria-label": t("viewMode"), children: ["flat", "tree"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          className: `dgp-segment${mode === item ? " dgp-segment-on" : ""}`,
          "aria-pressed": mode === item,
          title: item === "flat" ? t("viewFlatHint") : t("viewTreeHint"),
          onClick: () => switchMode(item),
          children: item === "flat" ? t("viewFlat") : t("viewTree")
        },
        item
      )) }),
      mode === "tree" && directoryPaths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dgp-rowactions dgp-treeactions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-linkbtn", disabled: collapsedCount === 0, onClick: expandAll, title: t("expandAllHint"), children: t("expandAll") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "dgp-linkbtn",
            disabled: collapsedCount === directoryPaths.length,
            onClick: collapseAll,
            title: t("collapseAllHint"),
            children: t("collapseAll")
          }
        )
      ] }),
      props.centerAvailable && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dgp-meta", children: t("openMode") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-segmented", role: "group", "aria-label": t("openMode"), children: ["center", "inline"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: `dgp-segment${openTarget === item ? " dgp-segment-on" : ""}`,
            "aria-pressed": openTarget === item,
            title: item === "center" ? t("openCenterHint") : t("openInlineHint"),
            onClick: () => switchOpenTarget(item),
            children: item === "center" ? t("openCenter") : t("openInline")
          },
          item
        )) })
      ] })
    ] }),
    snapshot.changes.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-empty", children: onlyUntracked ? t("noTrackedChanges") : t("cleanWorktree") }),
    groups.conflicts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Group, { title: t("groupConflicts"), count: groups.conflicts.length, tone: "conflict", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      ChangeTree,
      {
        entries: groups.conflicts,
        tree: trees?.conflicts ?? EMPTY_TREE,
        mode,
        side: "worktree",
        t,
        collapsed,
        onToggle: toggleDirectory,
        renderFile: (entry, depth) => renderRow("worktree", groups.conflicts, entry, depth, stageButton(entry))
      }
    ) }),
    groups.staged.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      Group,
      {
        title: t("groupStaged"),
        count: groups.staged.length,
        action: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-linkbtn", disabled: props.busy !== "", onClick: props.onUnstageAll, children: t("unstageAll") }),
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ChangeTree,
          {
            entries: groups.staged,
            tree: trees?.staged ?? EMPTY_TREE,
            mode,
            side: "staged",
            t,
            collapsed,
            onToggle: toggleDirectory,
            renderFile: (entry, depth) => renderRow(
              "staged",
              groups.staged,
              entry,
              depth,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("unstage"), disabled: props.busy !== "", onClick: () => props.onUnstage([entry.path]), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconMinus, { size: 13 }) })
            )
          }
        )
      }
    ),
    groups.untracked.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Group, { title: t("groupUntracked"), count: groups.untracked.length, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      ChangeTree,
      {
        entries: groups.untracked,
        tree: trees?.untracked ?? EMPTY_TREE,
        mode,
        side: "worktree",
        t,
        collapsed,
        onToggle: toggleDirectory,
        renderFile: (entry, depth) => renderRow(
          "worktree",
          groups.untracked,
          entry,
          depth,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
            stageButton(entry),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "dgp-iconbtn dgp-dangerbtn",
                title: t("deleteUntracked"),
                disabled: props.busy !== "",
                onClick: () => props.onDiscard(entry),
                children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconUndo, { size: 13 })
              }
            )
          ] })
        )
      }
    ) }),
    groups.unstaged.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      Group,
      {
        title: t("groupUnstaged"),
        count: groups.unstaged.length,
        action: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dgp-linkbtn", disabled: props.busy !== "", onClick: props.onStageAll, children: t("stageAll") }),
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ChangeTree,
          {
            entries: groups.unstaged,
            tree: trees?.unstaged ?? EMPTY_TREE,
            mode,
            side: "worktree",
            t,
            collapsed,
            onToggle: toggleDirectory,
            renderFile: (entry, depth) => renderRow(
              "worktree",
              groups.unstaged,
              entry,
              depth,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
                stageButton(entry),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "dgp-iconbtn dgp-dangerbtn",
                    title: t("discard"),
                    disabled: props.busy !== "",
                    onClick: () => props.onDiscard(entry),
                    children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(IconUndo, { size: 13 })
                  }
                )
              ] })
            )
          }
        )
      }
    ),
    snapshot.truncated && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dgp-truncated", children: t("changesTruncated", { total: snapshot.totalChanges ?? snapshot.changes.length }) })
  ] });
}

// src/client/components/HistoryView.tsx
var import_react4 = __toESM(require("react"), 1);

// src/shared/graph.js
var MAX_LANES = 6;
var LANE_PALETTE = 5;
function firstFree(columns, skip) {
  for (let i = 0; i < columns.length; i += 1) {
    if (columns[i] == null && i !== skip) return i;
  }
  return -1;
}
function compact(columns) {
  const next = columns.slice();
  while (next.length > 0 && next[next.length - 1] == null) next.pop();
  return next;
}
function layoutGraph(commits, options = {}) {
  const maxLanes = Math.max(1, Number(options.maxLanes) || MAX_LANES);
  const clamp = (lane) => lane >= maxLanes ? maxLanes - 1 : lane;
  const rows = [];
  let columns = [];
  for (const commit of commits ?? []) {
    const hash = String(commit?.hash ?? "");
    if (hash === "") continue;
    const before = columns.slice();
    let lane = before.indexOf(hash);
    const created = lane === -1;
    if (created) {
      lane = firstFree(before, -1);
      if (lane === -1) lane = before.length;
    }
    const merging = [];
    for (let i = 0; i < before.length; i += 1) {
      if (i !== lane && before[i] === hash) merging.push(i);
    }
    const parents = Array.isArray(commit?.parents) ? commit.parents.filter((parent) => typeof parent === "string" && parent !== "") : [];
    const after = before.slice();
    after[lane] = null;
    for (const index of merging) after[index] = null;
    let downTo = -1;
    if (parents.length > 0) {
      const existing = after.indexOf(parents[0]);
      if (existing !== -1) {
        downTo = existing;
      } else {
        after[lane] = parents[0];
        downTo = lane;
      }
    }
    const forks = [];
    for (let i = 1; i < parents.length; i += 1) {
      const parent = parents[i];
      const existing = after.indexOf(parent);
      if (existing !== -1) {
        forks.push(existing);
        continue;
      }
      let slot = firstFree(after, lane);
      if (slot === -1) slot = after.length;
      after[slot] = parent;
      forks.push(slot);
    }
    const next = compact(after);
    const strokes = [];
    for (let i = 0; i < before.length; i += 1) {
      if (before[i] == null || i === lane) continue;
      if (next[i] != null) strokes.push({ x1: i, y1: 0, x2: i, y2: 1, color: clamp(i) });
      else strokes.push({ x1: i, y1: 0, x2: lane, y2: 0.5, color: clamp(i) });
    }
    if (!created) strokes.push({ x1: lane, y1: 0, x2: lane, y2: 0.5, color: clamp(lane) });
    if (downTo !== -1) strokes.push({ x1: lane, y1: 0.5, x2: downTo, y2: 1, color: clamp(downTo) });
    for (const slot of forks) {
      if (slot === lane || slot === downTo) continue;
      strokes.push({ x1: lane, y1: 0.5, x2: slot, y2: 1, color: clamp(slot) });
    }
    const lanesUsed = Math.max(
      before.length,
      next.length,
      lane + 1,
      downTo + 1,
      ...forks.map((slot) => slot + 1),
      1
    );
    rows.push({
      hash,
      lane: clamp(lane),
      created,
      laneCount: Math.min(lanesUsed, maxLanes),
      color: clamp(lane) % LANE_PALETTE,
      strokes: strokes.map((stroke) => ({
        x1: clamp(stroke.x1),
        x2: clamp(stroke.x2),
        y1: stroke.y1,
        y2: stroke.y2,
        color: stroke.color % LANE_PALETTE
      }))
    });
    columns = next;
  }
  return rows;
}
function withGraph(commits, options = {}) {
  const rows = layoutGraph(commits, options);
  const lanes = rows.reduce((max, row) => Math.max(max, row.laneCount), 1);
  return {
    lanes: Math.min(lanes, Math.max(1, Number(options.maxLanes) || MAX_LANES)),
    commits: rows.map((row, index) => ({ ...commits[index], graph: row }))
  };
}

// src/client/components/HistoryView.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var ROW_HEIGHT = 46;
var LANE_WIDTH = 12;
var GRAPH_INSET = 6;
function Graph({ rows, lanes }) {
  const width = lanes * LANE_WIDTH + GRAPH_INSET * 2;
  const lane = (rows[0]?.lane ?? 0) * LANE_WIDTH + GRAPH_INSET;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dgp-graph", style: { width }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("svg", { className: "dgp-graphlanes", width, height: "100%", viewBox: `0 0 ${width} ${ROW_HEIGHT}`, preserveAspectRatio: "none", "aria-hidden": true, children: rows.map(
      (row, index) => row.strokes.map((stroke, strokeIndex) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "path",
        {
          className: `dgp-lane dgp-lane-${stroke.color}`,
          vectorEffect: "non-scaling-stroke",
          d: `M ${stroke.x1 * LANE_WIDTH + GRAPH_INSET} ${stroke.y1 * ROW_HEIGHT} L ${stroke.x2 * LANE_WIDTH + GRAPH_INSET} ${stroke.y2 * ROW_HEIGHT}`
        },
        `${index}-${strokeIndex}`
      ))
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `dgp-dot dgp-lane-fill-${rows[0]?.color ?? 0}`, style: { left: lane } })
  ] });
}
function DecorationBadges({ commit }) {
  if (commit.decorations.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-decor", children: commit.decorations.map((decoration) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `dgp-decoritem dgp-decor-${decoration.kind}`, title: decoration.name, children: decoration.name }, `${decoration.kind}:${decoration.name}`)) });
}
function BranchPicker(props) {
  const [filter, setFilter] = import_react4.default.useState("");
  const [newBranch, setNewBranch] = import_react4.default.useState("");
  const { t } = props;
  const match = (ref) => filter === "" || ref.name.toLowerCase().includes(filter.toLowerCase());
  const groups = [
    { title: t("branchLocal"), items: (props.branches?.local ?? []).filter(match) },
    { title: t("branchRemote"), items: (props.branches?.remote ?? []).filter(match).slice(0, 80) },
    { title: t("branchTags"), items: (props.branches?.tags ?? []).filter(match).slice(0, 80) }
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-branchpop", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-branchpop-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: "dgp-input", placeholder: t("filterBranches"), value: filter, onChange: (event) => setFilter(event.target.value), autoFocus: true }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("refresh"), onClick: props.onReload, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconRefresh, { size: 13 }) })
    ] }),
    props.loading && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-empty", children: t("loading") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-branchlist", children: groups.map(
      (group) => group.items.length === 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-branchgroup", children: group.title }),
        group.items.map((ref) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          "button",
          {
            type: "button",
            className: `dgp-branchitem${ref.head ? " dgp-branchitem-on" : ""}`,
            disabled: props.busy !== "",
            title: ref.subject,
            onClick: () => props.onCheckout(ref.kind === "remote" ? ref.fullName : ref.name),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-branchname", children: ref.name }),
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-branchmeta", children: ref.commit })
            ]
          },
          ref.fullName
        ))
      ] }, group.title)
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-branchnew", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { className: "dgp-input", placeholder: t("newBranchPlaceholder"), value: newBranch, onChange: (event) => setNewBranch(event.target.value) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          disabled: newBranch.trim() === "" || props.busy !== "",
          onClick: () => props.onCheckout("HEAD", newBranch.trim()),
          children: t("createBranch")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-linkbtn", onClick: props.onClose, children: t("close") })
  ] });
}
function HistoryView(props) {
  const { api, actions, t, root } = props;
  const callbacks = import_react4.default.useRef(props);
  callbacks.current = props;
  const [commits, setCommits] = import_react4.default.useState([]);
  const [hasMore, setHasMore] = import_react4.default.useState(false);
  const [loading, setLoading] = import_react4.default.useState(false);
  const [loadingMore, setLoadingMore] = import_react4.default.useState(false);
  const [error, setError] = import_react4.default.useState("");
  const [ref, setRef] = import_react4.default.useState("");
  const [unborn, setUnborn] = import_react4.default.useState(false);
  const [branches, setBranches] = import_react4.default.useState(null);
  const [branchesLoading, setBranchesLoading] = import_react4.default.useState(false);
  const [pickerOpen, setPickerOpen] = import_react4.default.useState(false);
  const [detail, setDetail] = import_react4.default.useState(null);
  const [detailLoading, setDetailLoading] = import_react4.default.useState(false);
  const [detailDiffPath, setDetailDiffPath] = import_react4.default.useState("");
  const [detailDiffError, setDetailDiffError] = import_react4.default.useState("");
  const load = import_react4.default.useCallback(
    async (options) => {
      if (options.append) setLoadingMore(true);
      else setLoading(true);
      try {
        const response = await api.history(root, { limit: HISTORY_PAGE_SIZE, skip: options.skip, ref, path: props.pathFilter });
        setUnborn(response.history.unborn === true);
        setCommits((current) => options.append ? [...current, ...response.history.commits] : response.history.commits);
        setHasMore(response.history.hasMore === true);
        setError("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        if (!options.append) setCommits([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [api, root, ref, props.pathFilter]
  );
  import_react4.default.useEffect(() => {
    void load({ skip: 0, append: false });
  }, [load]);
  const loadBranches = import_react4.default.useCallback(async () => {
    setBranchesLoading(true);
    try {
      const response = await api.branches(root);
      setBranches({ local: response.local, remote: response.remote, tags: response.tags, truncated: response.truncated, total: response.total });
    } catch (cause) {
      callbacks.current.onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBranchesLoading(false);
    }
  }, [api, root]);
  import_react4.default.useEffect(() => {
    if (pickerOpen && branches === null) void loadBranches();
  }, [pickerOpen, branches, loadBranches]);
  const graph = import_react4.default.useMemo(() => withGraph(commits), [commits]);
  const openDetail = async (hash) => {
    setDetailLoading(true);
    setDetailDiffPath("");
    setDetailDiffError("");
    try {
      const result = await api.commit(root, hash);
      setDetail({ result, hash });
    } catch (cause) {
      callbacks.current.onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDetailLoading(false);
    }
  };
  const openDetailDiff = async (path, orig) => {
    if (detail === null) return;
    if (detailDiffPath === path) {
      setDetailDiffPath("");
      return;
    }
    setDetailLoading(true);
    setDetailDiffError("");
    try {
      const response = await api.commit(root, detail.hash, path, orig);
      setDetail({ result: { detail: detail.result.detail, diff: response.diff }, hash: detail.hash });
      setDetailDiffPath(path);
    } catch (cause) {
      setDetailDiffError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDetailLoading(false);
    }
  };
  const checkout = async (target, newBranch) => {
    const confirmText = newBranch === void 0 ? t("checkoutConfirm", { ref: target }) : t("createBranchConfirm", { ref: newBranch, base: target });
    if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(confirmText)) return;
    callbacks.current.setBusy("checkout");
    try {
      const snapshot = await actions.checkout(root, target, newBranch);
      callbacks.current.onSnapshot(snapshot);
      callbacks.current.onNotice(t("checkoutDone", { ref: newBranch ?? target }));
      setPickerOpen(false);
      setBranches(null);
      void load({ skip: 0, append: false });
    } catch (cause) {
      callbacks.current.onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      callbacks.current.setBusy("");
    }
  };
  if (detail !== null) {
    const files = detail.result.detail.files;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-pane", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-detailhead", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-iconbtn", onClick: () => setDetail(null), title: t("back"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconBack, { size: 14 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-hash", children: detail.result.detail.commit.shortHash }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-detailpath", title: detail.result.detail.commit.subject, children: detail.result.detail.commit.subject })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-commitbody", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-meta", children: [
          detail.result.detail.commit.author,
          " \xB7 ",
          fullTime(detail.result.detail.commit.authoredAt)
        ] }),
        detail.result.detail.merge && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-meta", children: t("mergeCommit") }),
        detail.result.detail.commit.body !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("pre", { className: "dgp-commitmsgtext", children: detail.result.detail.commit.body })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-grouphead", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-grouptitle", children: t("filesChanged", { count: detail.result.detail.totalFiles }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-rows", children: files.map((file) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-letter dgp-tone-mod", children: file.status.slice(0, 1).toUpperCase() }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dgp-name", onClick: () => void openDetailDiff(file.path, file.origPath), title: file.path, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-name-main", children: basename(file.path) }),
            dirname(file.path) !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-name-dir", children: dirname(file.path) }),
            file.origPath !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dgp-name-from", children: [
              "\u2190 ",
              file.origPath
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dgp-stat", children: [
            file.additions !== null && file.additions > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dgp-stat-add", children: [
              "+",
              file.additions
            ] }),
            file.deletions !== null && file.deletions > 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dgp-stat-del", children: [
              "\u2212",
              file.deletions
            ] }),
            file.binary && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-meta", children: t("binary") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-rowactions", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("openFile"), onClick: () => props.onOpenFile(file.path), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconExternal, { size: 13 }) }) })
        ] }),
        detailDiffPath === file.path && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-inlinediff", children: [
          detailDiffError !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-error", children: detailDiffError }),
          detailLoading && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-empty", children: t("loadingDiff") }),
          !detailLoading && detail.result.diff !== null && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DiffView, { files: detail.result.diff.files, truncated: detail.result.diff.truncated, t })
        ] })
      ] }, `${file.path}:${file.origPath ?? ""}`)) })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-pane", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-historybar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dgp-branchbtn", onClick: () => setPickerOpen((value) => !value), title: t("switchBranch"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconBranch, { size: 13 }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-ellipsis", children: ref === "" ? t("headRef") : ref }),
        ref !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "span",
          {
            className: "dgp-clearbtn",
            role: "button",
            tabIndex: 0,
            title: t("backToHead"),
            onClick: (event) => {
              event.stopPropagation();
              setRef("");
            },
            children: "\xD7"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("refresh"), onClick: () => void load({ skip: 0, append: false }), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(IconRefresh, { size: 13 }) })
    ] }),
    pickerOpen && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      BranchPicker,
      {
        t,
        branches,
        loading: branchesLoading,
        current: ref,
        busy: props.busy,
        onCheckout: (target, newBranch) => void checkout(target, newBranch),
        onReload: () => void loadBranches(),
        onClose: () => setPickerOpen(false)
      }
    ),
    props.pathFilter !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dgp-hint", children: [
      t("pathFilter", { path: props.pathFilter }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-linkbtn", onClick: props.onClearPathFilter, children: t("clearFilter") })
    ] }),
    error !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-error", children: error }),
    loading && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-empty", children: t("loading") }),
    !loading && unborn && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-empty", children: t("unbornHint") }),
    !loading && !unborn && commits.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-empty", children: t("noCommits") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dgp-commitlist", children: graph.commits.map((commit) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("button", { type: "button", className: "dgp-commititem", onClick: () => void openDetail(commit.hash), title: commit.subject, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Graph, { rows: [commit.graph], lanes: graph.lanes }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dgp-commitinfo", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dgp-subjectline", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-commitsubject", children: commit.subject }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(DecorationBadges, { commit })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "dgp-commitmeta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-hash", children: commit.shortHash }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-ellipsis", children: commit.author }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dgp-commitwhen", children: relativeTime(commit.authoredAt) })
        ] })
      ] })
    ] }, commit.hash)) }),
    hasMore && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "dgp-more", disabled: loadingMore, onClick: () => void load({ skip: commits.length, append: true }), children: loadingMore ? t("loading") : t("loadMore") })
  ] });
}

// src/client/components/WorktreeView.tsx
var import_react5 = __toESM(require("react"), 1);
var import_jsx_runtime5 = require("react/jsx-runtime");
function badgesFor(info, t) {
  const badges = [];
  if (info.current) badges.push(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-badge dgp-badge-on", children: t("badgeCurrent") }, "cur"));
  if (info.main) badges.push(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-badge", children: t("badgeMain") }, "main"));
  if (!info.exists) badges.push(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-badge dgp-badge-warn", children: t("badgeMissing") }, "missing"));
  if (info.locked) badges.push(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-badge", title: info.lockReason, children: t("badgeLocked") }, "locked"));
  if (info.prunable) badges.push(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-badge dgp-badge-warn", title: info.pruneReason, children: t("badgePrunable") }, "prunable"));
  if (info.dirty === true) badges.push(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-badge dgp-badge-warn", children: t("badgeDirty", { count: info.dirtyCount ?? 0 }) }, "dirty"));
  if (info.dirty === null) badges.push(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-badge dgp-badge-warn", children: t("badgeUnknown") }, "unknown"));
  if (info.merged) badges.push(/* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-badge dgp-badge-ok", children: t("badgeMerged") }, "merged"));
  return badges;
}
function WorktreeView(props) {
  const { api, actions, t, root } = props;
  const callbacks = import_react5.default.useRef(props);
  callbacks.current = props;
  const [data, setData] = import_react5.default.useState(null);
  const [loading, setLoading] = import_react5.default.useState(false);
  const [error, setError] = import_react5.default.useState("");
  const [formOpen, setFormOpen] = import_react5.default.useState(false);
  const [label, setLabel] = import_react5.default.useState("");
  const [baseRef, setBaseRef] = import_react5.default.useState("HEAD");
  const [mode, setMode] = import_react5.default.useState("detached");
  const [branch, setBranch] = import_react5.default.useState("");
  const [branches, setBranches] = import_react5.default.useState(null);
  const [removing, setRemoving] = import_react5.default.useState(null);
  const [force, setForce] = import_react5.default.useState(false);
  const [exportPatch, setExportPatch] = import_react5.default.useState(true);
  const [localBusy, setLocalBusy] = import_react5.default.useState("");
  const applyResult = (response) => {
    setData({
      repo: response.repo ?? null,
      worktrees: response.worktrees ?? [],
      worktreeTotal: response.worktreeTotal ?? 0,
      worktreeTruncated: response.worktreeTruncated === true,
      suggestedRoot: response.suggestedRoot ?? "",
      defaultBranchPrefix: response.defaultBranchPrefix ?? "",
      configuredRoot: response.configuredRoot ?? ""
    });
  };
  const reload = import_react5.default.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.worktrees(root);
      applyResult(response);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [api, root]);
  import_react5.default.useEffect(() => {
    void reload();
  }, [reload]);
  import_react5.default.useEffect(() => {
    if (!formOpen || branches !== null) return;
    void (async () => {
      try {
        const response = await api.branches(root);
        setBranches({ local: response.local, remote: response.remote, tags: response.tags, truncated: response.truncated, total: response.total });
      } catch {
      }
    })();
  }, [formOpen, branches, api, root]);
  const create = async () => {
    setLocalBusy("create");
    try {
      const response = await actions.worktreeAdd(root, {
        dirName: label.trim() === "" ? void 0 : label.trim(),
        baseRef,
        mode,
        branch: mode === "branch" && branch.trim() !== "" ? branch.trim() : void 0
      });
      applyResult(response);
      callbacks.current.onSnapshot(response);
      const createdPath = response.created?.path ?? "";
      callbacks.current.onNotice(t("worktreeCreated", { path: createdPath }));
      setFormOpen(false);
      setLabel("");
      setBranch("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLocalBusy("");
      callbacks.current.setBusy("");
    }
  };
  const remove = async () => {
    if (removing === null) return;
    setLocalBusy("remove");
    try {
      const response = await actions.worktreeRemove(root, { path: removing.path, force, exportPatch });
      applyResult(response);
      callbacks.current.onSnapshot(response);
      const patch = response.removedWorktree?.patchPath ?? "";
      const retained = response.removedWorktree?.retainedBranch ?? "";
      callbacks.current.onNotice(
        retained === "" ? t("worktreeRemoved") : t("worktreeRemovedBranchKept", { branch: retained })
      );
      if (patch !== "") callbacks.current.onNotice(t("patchExported", { path: patch }));
      setRemoving(null);
      setForce(false);
      setExportPatch(true);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLocalBusy("");
      callbacks.current.setBusy("");
    }
  };
  const prune = async () => {
    setLocalBusy("prune");
    try {
      const response = await actions.worktreePrune(root);
      applyResult(response);
      callbacks.current.onNotice(response.pruneOutput === "" ? t("pruneNothing") : t("pruneDone", { output: response.pruneOutput }));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLocalBusy("");
      callbacks.current.setBusy("");
    }
  };
  const copyPath = async (path) => {
    try {
      await navigator.clipboard.writeText(path);
      callbacks.current.onNotice(t("copied"));
    } catch {
      callbacks.current.onNotice(path);
    }
  };
  const busy = props.busy !== "" || localBusy !== "";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-pane", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-historybar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-ellipsis dgp-meta", title: data?.suggestedRoot ?? "", children: [
        t("worktreeRootLabel"),
        ": ",
        data?.suggestedRoot ?? "\u2026"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-rowactions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("prune"), disabled: busy, onClick: () => void prune(), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconWorktree, { size: 13 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("refresh"), disabled: loading, onClick: () => void reload(), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconRefresh, { size: 13 }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("newWorktree"), disabled: busy, onClick: () => setFormOpen((value) => !value), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconPlus, { size: 13 }) })
      ] })
    ] }),
    formOpen && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-form", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("worktreeName") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            className: "dgp-input",
            placeholder: t("worktreeNamePlaceholder"),
            value: label,
            onChange: (event) => {
              setLabel(event.target.value);
              if (mode === "branch" && branch === "") setBranch(`${data?.defaultBranchPrefix ?? ""}${event.target.value.trim().replace(/[^\w./-]+/g, "-")}`);
            }
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("worktreeBase") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("select", { className: "dgp-input", value: baseRef, onChange: (event) => setBaseRef(event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: "HEAD", children: t("worktreeBaseHead") }),
          (branches?.local ?? []).map((ref) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: ref.fullName, children: ref.name }, ref.fullName)),
          (branches?.tags ?? []).slice(0, 50).map((ref) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("option", { value: ref.fullName, children: [
            "tag: ",
            ref.name
          ] }, ref.fullName))
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("worktreeMode") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-radio", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-check", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "radio", checked: mode === "detached", onChange: () => setMode("detached") }),
            t("modeDetached")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-check", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "radio", checked: mode === "branch", onChange: () => setMode("branch") }),
            t("modeBranch")
          ] })
        ] })
      ] }),
      mode === "branch" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("branchName") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { className: "dgp-input", placeholder: t("branchNamePlaceholder"), value: branch, onChange: (event) => setBranch(event.target.value) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-formactions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-primary", disabled: busy, onClick: () => void create(), children: localBusy === "create" ? t("creating") : t("create") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", disabled: busy, onClick: () => setFormOpen(false), children: t("cancel") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-hint", children: t("worktreeIsolationHint") })
    ] }),
    error !== "" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-error", children: error }),
    loading && data === null && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-empty", children: t("loading") }),
    data !== null && data.worktrees.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-empty", children: t("noWorktrees") }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-rows", children: (data?.worktrees ?? []).map((info) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-wt", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-wthead", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconBranch, { size: 13 }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-wtname", title: info.path, children: basename(info.path) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-hash", children: info.head }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "dgp-rowactions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("copyPath"), onClick: () => void copyPath(info.path), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconCopy, { size: 13 }) }),
          !info.main && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              className: "dgp-iconbtn dgp-dangerbtn",
              title: t("removeWorktree"),
              disabled: busy,
              onClick: () => {
                setRemoving(info);
                setForce(false);
                setExportPatch(info.dirty === true || info.merged === false);
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(IconTrash, { size: 13 })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-wtmeta", children: [
        info.detached ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-chip", children: t("detached") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dgp-chip dgp-chip-on", children: info.branch }),
        badgesFor(info, t)
      ] }),
      dirname(info.path) !== "" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-meta dgp-ellipsis", children: info.path }),
      removing !== null && removing.path === info.path && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-confirm", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-confirmtext", children: t("removeWorktreeConfirm", { path: info.path }) }),
        (info.dirty === true || info.merged === false) && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-check", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: exportPatch, onChange: (event) => setExportPatch(event.target.checked) }),
          t("exportPatch")
        ] }),
        info.dirty === true && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dgp-check", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("input", { type: "checkbox", checked: force, onChange: (event) => setForce(event.target.checked) }),
          t("forceRemove")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "dgp-formactions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "dgp-dangerbtn dgp-primary", disabled: busy, onClick: () => void remove(), children: localBusy === "remove" ? t("removing") : t("confirmRemove") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", disabled: busy, onClick: () => setRemoving(null), children: t("cancel") })
        ] })
      ] })
    ] }, info.path)) }),
    data !== null && data.worktreeTruncated && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-truncated", children: t("worktreeTruncated", { total: data.worktreeTotal }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "dgp-hint", children: t("worktreeHint") })
  ] });
}

// src/client/components/GitPanel.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var NO_SUBSCRIPTION = () => void 0;
function GitPanel(props) {
  const { api, actions, t } = props;
  const useSessions = props.useSessions ?? NO_SUBSCRIPTION;
  const useTabInfo = props.useTabInfo;
  const tabInfo = typeof useTabInfo === "function" ? useTabInfo() : void 0;
  const visible = tabInfo?.tab?.visible !== false;
  const openResource = tabInfo?.tab?.actions?.openResource;
  const sessionCwd = useSessions((state2) => {
    const byId = state2?.byId;
    return props.sessionId === void 0 ? void 0 : byId?.[props.sessionId]?.cwd;
  });
  const [root, setRoot] = import_react6.default.useState("");
  const [snapshot, setSnapshot] = import_react6.default.useState(null);
  const [error, setError] = import_react6.default.useState("");
  const [notice, setNotice] = import_react6.default.useState("");
  const [busy, setBusy] = import_react6.default.useState("");
  const [tab, setTab] = import_react6.default.useState("changes");
  const [selection, setSelection] = import_react6.default.useState(null);
  const [historyPath, setHistoryPath] = import_react6.default.useState("");
  const [refreshing, setRefreshing] = import_react6.default.useState(false);
  import_react6.default.useEffect(() => {
    if (typeof sessionCwd === "string" && sessionCwd !== "") setRoot((current) => current === "" ? sessionCwd : current);
  }, [sessionCwd]);
  const inflight = import_react6.default.useRef(false);
  const refresh = import_react6.default.useCallback(
    async (silent) => {
      if (root === "" || inflight.current) return;
      inflight.current = true;
      if (!silent) setRefreshing(true);
      try {
        const next = await api.snapshot(root);
        setSnapshot(next);
        if (!silent) setError("");
      } catch (cause) {
        if (!silent) setError(errText(cause));
      } finally {
        inflight.current = false;
        if (!silent) setRefreshing(false);
      }
    },
    [api, root]
  );
  import_react6.default.useEffect(() => {
    if (root === "") return void 0;
    void refresh(false);
    return void 0;
  }, [root, refresh]);
  import_react6.default.useEffect(() => {
    if (root === "" || !visible) return void 0;
    const timer = setInterval(() => void refresh(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [root, visible, refresh]);
  import_react6.default.useEffect(() => {
    if (notice === "") return void 0;
    const timer = setTimeout(() => setNotice(""), 6e3);
    return () => clearTimeout(timer);
  }, [notice]);
  const selectionFingerprint = import_react6.default.useMemo(() => {
    if (selection === null) return "";
    const entry = snapshot?.changes.find((item) => item.path === selection.path);
    if (entry === void 0) return "gone";
    return `${entry.index}${entry.worktree}${entry.untracked === true ? "u" : ""}${entry.origPath ?? ""}`;
  }, [selection, snapshot]);
  const centerTarget = import_react6.default.useSyncExternalStore(subscribeDiffTarget, getDiffTarget, getDiffTarget);
  const activeDiffPath = centerTarget === null ? void 0 : centerTarget.items[centerTarget.index]?.path;
  const inlineTarget = selection === null || snapshot?.repo == null ? null : {
    root,
    path: selection.path,
    origPath: selection.origPath,
    staged: selection.staged,
    untracked: selection.untracked,
    fingerprint: selectionFingerprint
  };
  const { diff, loading: diffLoading, error: diffError } = useFileDiff(api, inlineTarget, snapshot?.contextLines ?? 3);
  const applySnapshot = (next) => {
    if (next !== null && typeof next === "object" && "changes" in next) {
      setSnapshot(next);
    }
  };
  const run = async (label, task, success) => {
    setBusy(label);
    setError("");
    try {
      const result = await task();
      applySnapshot(result);
      if (success !== void 0) setNotice(success);
    } catch (cause) {
      setError(errText(cause));
    } finally {
      setBusy("");
    }
  };
  const openFile = (relative) => {
    if (openResource === void 0 || snapshot?.repo == null || props.sessionId === void 0) {
      setNotice(t("openFileUnavailable"));
      return;
    }
    try {
      openResource(fileAddressFor(props.sessionId, absolutePath(snapshot.repo.repoRoot, relative)));
    } catch (cause) {
      setError(errText(cause));
    }
  };
  if (root === "") {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-empty", children: t("needCwd") }) });
  }
  if (snapshot === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-empty", children: error === "" ? t("loading") : error }) });
  }
  const repo = snapshot.repo;
  if (repo === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-reponame", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-ellipsis", children: basename(root) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("refresh"), onClick: () => void refresh(false), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconRefresh, { size: 13 }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-empty", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconWarning, { size: 16 }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { children: snapshot.reason ?? t("notARepo") }),
        snapshot.gitMissing !== true && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-meta", children: root })
      ] })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-reponame", title: repo.repoRoot, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-ellipsis", children: repo.name }),
        repo.isWorktree && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-badge", children: t("badgeWorktree") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("refresh"), disabled: refreshing, onClick: () => void refresh(false), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconRefresh, { size: 13 }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-branchrow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-branch", title: repo.upstream === "" ? repo.branch : `${repo.branch} \u2192 ${repo.upstream}`, children: repo.detached ? t("detachedHead") : repo.unborn ? t("unbornBranch", { branch: repo.branch }) : repo.branch }),
      repo.upstream !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-meta dgp-ellipsis", children: repo.upstream }),
      repo.ahead > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-ahead", children: [
        "\u2191",
        repo.ahead
      ] }),
      repo.behind > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dgp-behind", children: [
        "\u2193",
        repo.behind
      ] })
    ] }),
    repo.state !== "clean" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-hint dgp-hint-warn", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t("stateInProgress", { state: repo.state }) }),
      repo.state === "merge" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-linkbtn", disabled: busy !== "", onClick: () => void run("abortMerge", () => actions.abortMerge(root), t("mergeAborted")), children: t("abortMerge") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("nav", { className: "dgp-tabs", children: ["changes", "history", "worktrees"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
      "button",
      {
        type: "button",
        className: `dgp-tab${tab === item ? " dgp-tab-on" : ""}`,
        onClick: () => {
          setTab(item);
          if (item !== "changes") setSelection(null);
        },
        children: [
          t(`tab.${item}`),
          item === "changes" && snapshot.counts.total > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-tabcount", children: snapshot.counts.total })
        ]
      },
      item
    )) }),
    error !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-error", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(IconWarning, { size: 13 }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dgp-errortext", children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("dismiss"), onClick: () => setError(""), children: "\xD7" })
    ] }),
    notice !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-notice", children: notice }),
    busy !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "dgp-busy", children: t("working") }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dgp-body", children: [
      tab === "changes" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        ChangesView,
        {
          snapshot,
          selection,
          diff,
          diffLoading,
          diffError,
          busy,
          t,
          onSelect: setSelection,
          onStage: (paths) => void run("stage", () => actions.stage(root, paths)),
          onUnstage: (paths) => void run("unstage", () => actions.unstage(root, paths)),
          onStageAll: () => void run("stageAll", () => actions.stageAll(root)),
          onUnstageAll: () => void run("unstageAll", () => actions.unstageAll(root)),
          onDiscard: (entry) => {
            const message = entry.untracked === true ? t("confirmDeleteUntracked", { path: entry.path }) : t("confirmDiscard", { path: entry.path });
            if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(message)) return;
            void run(
              "discard",
              () => entry.untracked === true ? actions.discard(root, [], [entry.path]) : actions.discard(root, [entry.path], [])
            );
          },
          onCommit: (message, amend) => void run("commit", () => actions.commit(root, message, { amend }), t("commitDone")),
          onOpenFile: openFile,
          onShowFileHistory: (path) => {
            setHistoryPath(path);
            setSelection(null);
            setTab("history");
          },
          centerAvailable: props.diffCenterAvailable === true && props.openDiffInCenter !== void 0,
          activePath: activeDiffPath,
          onOpenInCenter: (items, index) => {
            if (snapshot.repo === null || props.openDiffInCenter === void 0) return;
            props.openDiffInCenter({
              root,
              repoRoot: snapshot.repo.repoRoot,
              sessionId: props.sessionId,
              items,
              index,
              contextLines: snapshot.contextLines
            });
            setSelection(null);
          }
        }
      ),
      tab === "history" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        HistoryView,
        {
          root,
          api,
          actions,
          t,
          pathFilter: historyPath,
          onClearPathFilter: () => setHistoryPath(""),
          onOpenFile: openFile,
          onSnapshot: applySnapshot,
          onError: setError,
          onNotice: setNotice,
          setBusy,
          busy
        }
      ),
      tab === "worktrees" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        WorktreeView,
        {
          root,
          api,
          actions,
          t,
          onSnapshot: applySnapshot,
          onError: setError,
          onNotice: setNotice,
          setBusy,
          busy
        }
      )
    ] })
  ] });
}

// src/client/components/DiffPage.tsx
var import_react7 = __toESM(require("react"), 1);
var import_jsx_runtime7 = require("react/jsx-runtime");
function absolutePathFor(repoRoot, relative) {
  const root = String(repoRoot ?? "").replace(/[\\/]+$/, "");
  return relative === "" ? root : `${root}/${relative.replace(/^[\\/]+/, "")}`;
}
function DiffPage(props) {
  const { api, t } = props;
  const state2 = import_react7.default.useSyncExternalStore(subscribeDiffTarget, getDiffTarget, getDiffTarget);
  const item = currentDiffItem();
  const total = state2 === null ? 0 : state2.items.length;
  const index = state2 === null ? 0 : state2.index;
  const target = state2 === null || item === null ? null : {
    root: state2.root,
    path: item.path,
    origPath: item.origPath,
    staged: item.staged,
    untracked: item.untracked,
    fingerprint: `${item.staged ? "s" : "w"}:${item.untracked ? "u" : "-"}`
  };
  const { diff, loading, error } = useFileDiff(api, target, state2?.contextLines ?? 3);
  const canPreview = props.openPreview !== void 0 && state2 !== null && state2.sessionId !== void 0 && item !== null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp dgp-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-pagehead", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-iconbtn", onClick: props.close, title: t("centerClose"), "aria-label": t("centerClose"), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconBack, { size: 16 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-pagetitle", title: item === null ? "" : absolutePathFor(state2?.repoRoot ?? "", item.path), children: item === null ? t("centerNoTarget") : item.path }),
      item !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: `dgp-chip${item.staged ? " dgp-chip-on" : ""}`, children: item.staged ? t("staged") : item.untracked ? t("untracked") : t("unstaged") }),
      diff !== null && !diff.empty && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-stat dgp-pagestat", children: [
        diff.additions > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-stat-add", children: [
          "+",
          diff.additions
        ] }),
        diff.deletions > 0 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-stat-del", children: [
          "\u2212",
          diff.deletions
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "dgp-rowactions", children: [
        total > 1 && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("centerPrev"), "aria-label": t("centerPrev"), onClick: () => stepDiffTarget(-1), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconChevronLeft, { size: 15 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-meta dgp-pagecount", children: t("centerPosition", { index: index + 1, total }) }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "dgp-iconbtn", title: t("centerNext"), "aria-label": t("centerNext"), onClick: () => stepDiffTarget(1), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconChevron, { size: 15 }) })
        ] }),
        canPreview && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "button",
            className: "dgp-iconbtn",
            title: t("openFile"),
            onClick: () => props.openPreview?.(item, absolutePathFor(state2?.repoRoot ?? "", item.path)),
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconExternal, { size: 15 })
          }
        )
      ] })
    ] }),
    state2 !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-pagesub", children: [
      state2.repoRoot,
      item !== null && dirname(item.path) !== "" ? ` \xB7 ${dirname(item.path)}` : ""
    ] }),
    error !== "" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "dgp-error", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(IconWarning, { size: 13 }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "dgp-errortext", children: error })
    ] }),
    loading && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-empty", children: t("loadingDiff") }),
    !loading && diff !== null && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-pagebody", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      DiffView,
      {
        files: diff.file === null ? [] : [diff.file],
        truncated: diff.truncated,
        emptyHint: diff.untracked ? t("noDiffUntracked") : t("noDiff"),
        t
      }
    ) }),
    !loading && diff === null && error === "" && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "dgp-empty", children: t("centerNoTarget") })
  ] });
}

// src/client/index.ts
var DIFF_PANEL_ID = "git-diff";
if (typeof document !== "undefined") {
  const tagId = "dsh-git-panel/styles.css";
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-git-panel";
    tag.dataset.pluginCss = tagId;
    tag.textContent = styles_default;
    document.head.appendChild(tag);
  }
}
var inject = ["slots", "locale", "sidebarRightTabs"];
function apply(ctx) {
  try {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "git-panel: dictionaries");
    const t = ctx.locale.bind(NS);
    const api = createApi();
    const actions = createActions();
    ctx.effect(
      () => ctx.sidebarRightTabs.register({
        id: TAB_ID,
        kind: TAB_KIND,
        // 单实例页面：每个会话一块 Git 面板。
        keepMounted: true,
        title: () => t("title"),
        guide: [
          {
            id: "open",
            order: 20,
            title: () => t("guideTitle"),
            description: () => t("guideDescription"),
            icon: IconGit
          }
        ]
      }),
      "git-panel: tab type"
    );
    const layout = () => ctx.get?.("layout");
    const centerAvailable = () => typeof layout()?.selectPanel === "function";
    const selectPanel = (id) => {
      const service = layout();
      if (typeof service?.selectPanel !== "function") return;
      service.selectPanel(id);
    };
    const openDiffInCenter = (state2) => {
      if (!centerAvailable()) return;
      try {
        setDiffTarget(state2);
        selectPanel(DIFF_PANEL_ID);
      } catch (error) {
        setDiffTarget(null);
        console.warn("[git-panel] \u6253\u5F00\u4E2D\u95F4\u5DEE\u5F02\u9875\u5931\u8D25", error);
      }
    };
    const closeDiffInCenter = () => {
      try {
        selectPanel(null);
      } catch (error) {
        console.warn("[git-panel] \u5173\u95ED\u4E2D\u95F4\u5DEE\u5F02\u9875\u5931\u8D25", error);
      }
    };
    const openPreview = (item, absolute) => {
      const sessionId = getDiffTarget()?.sessionId;
      const sidebarRight = ctx.get?.("sidebarRight");
      if (sessionId === void 0 || typeof sidebarRight?.openResource !== "function") return;
      try {
        sidebarRight.openResource(fileAddressFor(sessionId, absolute));
      } catch (error) {
        console.warn("[git-panel] \u6253\u5F00\u6587\u4EF6\u9884\u89C8\u5931\u8D25", error);
      }
    };
    ctx.effect(
      () => ctx.slots.inject(
        "main",
        () => ctx.slots.register(
          { name: "main", key: DIFF_PANEL_ID, locale: NS, inject: () => ({ api, t, close: closeDiffInCenter, openPreview }) },
          DiffPage
        )
      ),
      "git-panel: center diff page"
    );
    ctx.effect(
      () => ctx.slots.inject(
        "sidebar.right.pane.tab",
        () => ctx.slots.register(
          {
            name: "sidebar.right.pane.tab",
            key: TAB_ID,
            locale: NS,
            inject: () => ({ api, actions, t, openDiffInCenter, diffCenterAvailable: centerAvailable() })
          },
          GitPanel
        )
      ),
      "git-panel: panel body"
    );
  } catch (error) {
    console.warn("[git-panel] client apply failed", error);
  }
}
return module.exports; } });
