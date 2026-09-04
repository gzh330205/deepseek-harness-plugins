window.__ModuleLoader__.load({ id: "dsh-workspace-category-manager", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
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
var styles_default = `
      .wcm{max-width:760px;display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary)}.wcm h2,.wcm h3,.wcm p{margin:0}.wcm-intro,.wcm-muted{font-size:13px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}.wcm-head,.wcm-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.wcm-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px;background:var(--dsw-alias-bg-layer-3)}.wcm-list{display:flex;flex-direction:column;gap:8px}.wcm-title{font-weight:600;font-size:14px}.wcm-meta{margin-top:3px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}.wcm-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.wcm button{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:5px 10px;color:var(--dsw-alias-label-primary);background:transparent}.wcm button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.wcm button:disabled{cursor:default;opacity:.5}.wcm-primary{color:#fff!important;background:var(--dsw-alias-brand-primary)!important;border-color:var(--dsw-alias-brand-primary)!important}.wcm-danger{color:var(--dsw-alias-state-error-primary)!important}.wcm-dot{width:10px;height:10px;border-radius:999px;display:inline-block;margin-right:7px}.wcm-select{box-sizing:border-box;min-width:210px;max-width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:6px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}.wcm-dialogMask{position:fixed;z-index:2000;inset:0;padding:24px;display:flex;justify-content:center;align-items:center;background:var(--dsw-alias-bg-mask-1)}.wcm-dialog{max-height:calc(100vh - 48px);width:min(520px,100%);overflow:auto;border-radius:16px;padding:18px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv3)}.wcm-dialogHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.wcm-close{font-size:20px!important;line-height:1;padding:3px 8px!important}.wcm-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wcm-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary)}.wcm-form input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:7px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.wcm-span{grid-column:1/-1}.wcm-error{font-size:12px;color:var(--dsw-alias-state-error-primary)}
      .wcm-sidebar{display:flex;flex-direction:column;min-height:0;gap:6px;padding:0 8px 12px}.wcm-sidebarHead{display:flex;align-items:center;justify-content:space-between;padding:4px 4px 2px;color:var(--dsw-alias-label-secondary);font-size:13px}.wcm-sidebarAdd{width:28px;height:28px;padding:0!important;border:0!important;border-radius:8px!important;font-size:18px!important;line-height:1!important}.wcm-group{margin:0;padding:0}.wcm-group>summary{display:flex;align-items:center;gap:6px;min-height:30px;cursor:pointer;list-style:none;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600;user-select:none}.wcm-group>summary::-webkit-details-marker{display:none}.wcm-group>summary::before{content:'\u203A';display:inline-block;color:var(--dsw-alias-label-tertiary);font-size:17px;line-height:1;transform:rotate(0deg);transition:transform .12s}.wcm-group[open]>summary::before{transform:rotate(90deg)}.wcm-groupDot{width:8px;height:8px;border-radius:50%;flex:none}.wcm-groupCount{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-weight:400}.wcm-projects{display:flex;flex-direction:column;gap:2px;padding:0 0 5px 14px}.wcm-project{display:flex;align-items:center;gap:7px;width:100%;min-width:0;padding:7px 8px;border:0!important;border-radius:7px!important;text-align:left;font-size:13px!important}.wcm-project:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-folder{color:var(--dsw-alias-label-tertiary);font-size:15px;line-height:1}.wcm-projectLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wcm-sidebarRail{padding:4px}.wcm-sidebarRail .wcm-sidebarHead{display:none}.wcm-sidebarRail .wcm-group>summary{justify-content:center;font-size:0}.wcm-sidebarRail .wcm-group>summary::before{display:none}.wcm-sidebarRail .wcm-groupCount{display:none}.wcm-sidebarRail .wcm-projects{padding:0}.wcm-sidebarRail .wcm-project{justify-content:center;padding:7px 0}.wcm-sidebarRail .wcm-projectLabel{display:none}.wcm-sidebarRail .wcm-folder{font-size:18px}


      .wcm-chips{display:flex;flex-wrap:wrap;gap:4px;padding:0 2px 4px}.wcm-chip{border:1px solid var(--dsw-alias-border-l2)!important;border-radius:999px!important;padding:3px 10px!important;font-size:12px!important;color:var(--dsw-alias-label-secondary)!important;background:transparent}.wcm-chip:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-chipOn{color:#fff!important;background:var(--dsw-alias-brand-primary)!important;border-color:var(--dsw-alias-brand-primary)!important}.wcm-projectRow{display:flex;flex-direction:column;min-width:0;position:relative;cursor:pointer;user-select:none}.wcm-projectLine{position:relative;display:flex;align-items:center;gap:2px;height:34px;box-sizing:border-box;min-width:0;border-radius:7px}.wcm-projectLine:hover{background:var(--dsw-alias-interactive-bg-hover)}.wcm-project{flex:1;min-width:0}.wcm-projectLabel{flex:1;min-width:0}.wcm-rowIconSlot{position:relative;flex:none;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center}.wcm-rowIcon{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary)}.wcm-rowChevron{position:absolute;inset:0;display:inline-flex;align-items:center;justify-content:center;visibility:hidden;color:var(--dsw-alias-label-secondary);transition:transform .12s}.wcm-folderRow:hover .wcm-rowChevron,.wcm-projectLine:hover .wcm-rowChevron{visibility:visible}.wcm-folderRow:hover .wcm-rowIcon,.wcm-projectLine:hover .wcm-rowIcon{visibility:hidden}.wcm-folderRow.wcm-open .wcm-rowChevron,.wcm-projectRow.wcm-open .wcm-rowChevron{transform:rotate(90deg)}.wcm-projectAdd{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px!important;height:24px!important;padding:0!important;border:0!important;border-radius:6px!important;opacity:0;color:var(--dsw-alias-label-secondary)!important;background:transparent!important}.wcm-projectLine:hover .wcm-projectAdd,.wcm-projectLine:focus-within .wcm-projectAdd{opacity:1}.wcm-projectAdd:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-sessions{display:flex;flex-direction:column;gap:1px;margin-left:10px;padding:2px 0 6px 8px;border-left:1px solid var(--dsw-alias-border-l2)}.wcm-session{display:flex;align-items:center;gap:2px;width:100%;height:34px;box-sizing:border-box;min-width:0;padding:0;border:0!important;border-radius:7px!important;text-align:left;font:inherit;font-size:13px!important;color:var(--dsw-alias-label-secondary)!important;background:transparent}.wcm-session:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-sessionStatus{flex:none;display:inline-flex;align-items:center;justify-content:center;width:14px}.wcm-sessionTitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wcm-session.wcm-current{color:var(--dsw-alias-label-primary)!important;background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-dot{position:relative;display:inline-block;flex:none}.wcm-dot:before{content:"";position:absolute;top:0;right:0;bottom:0;left:0;border-radius:50%;background:currentColor;opacity:.1}.wcm-dot:after{content:"";position:absolute;top:20%;right:20%;bottom:20%;left:20%;border-radius:50%;background:currentColor}.wcm-dot[data-state=done]{color:var(--dsw-alias-state-success-primary)}.wcm-dot[data-state=warning]{color:var(--dsw-alias-state-warn-primary)}.wcm-dot[data-state=error]{color:var(--dsw-alias-state-error-primary)}.wcm-dotMatrix{flex:none;color:var(--dsw-static-deepseek-450,#4f8cff)}.wcm-dotCell{fill:currentColor;opacity:.15;animation:wcm-state-chase 1s infinite}@keyframes wcm-state-chase{0%,12.4%{opacity:1}12.5%,24.9%{opacity:.6}25%,37.4%{opacity:.35}37.5%,to{opacity:.15}}.wcm-empty{margin:6px 8px;font-size:12px;color:var(--dsw-alias-label-tertiary)}.wcm-sidebarActions{position:relative;display:flex;align-items:center;gap:2px}.wcm-iconBtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0!important;border:0!important;border-radius:6px!important;color:var(--dsw-alias-label-secondary)!important;background:transparent}.wcm-iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-wsDot.wcm-wsBadge{position:absolute;top:0;right:0;width:8px;height:8px}.wcm-wsDot{position:relative;width:10px;height:10px;flex:none}.wcm-wsDot::before{content:"";position:absolute;top:0;right:0;bottom:0;left:0;border-radius:50%;background:currentColor;opacity:.14}.wcm-wsDot::after{content:"";position:absolute;top:25%;right:25%;bottom:25%;left:25%;border-radius:50%;background:currentColor}.wcm-ws-running{color:var(--dsw-static-deepseek-450,#4f8cff)}.wcm-ws-warning{color:var(--dsw-alias-state-warn-primary)}.wcm-ws-done{color:var(--dsw-alias-state-success-primary)}.wcm-projectRow.wcm-dragging{opacity:.55}.wcm-projectRow.wcm-dropBefore .wcm-projectLine{box-shadow:inset 0 2px 0 0 var(--dsw-alias-brand-primary)}.wcm-projectRow.wcm-dropAfter .wcm-projectLine{box-shadow:inset 0 -2px 0 0 var(--dsw-alias-brand-primary)}.wcm-folders{display:flex;flex-direction:column;gap:2px;padding:0 4px 8px 4px;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}.wcm-sidebar{flex:1;min-height:0}.wcm-folderWrap{display:flex;flex-direction:column;min-width:0}.wcm-folderRow{display:flex;align-items:center;gap:2px;height:34px;box-sizing:border-box;padding:0;border-radius:7px;cursor:pointer;user-select:none;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary);position:relative}.wcm-folderRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.wcm-folderLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wcm-folderCount{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}.wcm-folderDissolve{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px!important;height:24px!important;padding:0!important;border:0!important;border-radius:6px!important;opacity:0;color:var(--dsw-alias-label-tertiary)!important;background:transparent!important}.wcm-folderRow:hover .wcm-folderDissolve,.wcm-folderRow:focus-within .wcm-folderDissolve{opacity:1}.wcm-folderDissolve:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-state-error-primary)!important}.wcm-folderDissolveSlot{flex:none;width:24px}.wcm-folderProjects{display:flex;flex-direction:column;gap:2px;margin-left:13px;padding:0 0 4px 9px;border-left:1px solid var(--dsw-alias-border-l2)}.wcm-folderRow.wcm-dragging{opacity:.55}.wcm-folderRow.wcm-dropBefore{box-shadow:inset 0 2px 0 0 var(--dsw-alias-brand-primary)}.wcm-folderRow.wcm-dropAfter{box-shadow:inset 0 -2px 0 0 var(--dsw-alias-brand-primary)}.wcm-folderRow.wcm-dropInto{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}.wcm-menuMask{position:fixed;inset:0;z-index:1199}.wcm-menu{position:absolute;z-index:1200;top:calc(100% + 4px);right:0;min-width:180px;padding:4px;display:flex;flex-direction:column;gap:0;border:1px solid var(--dsw-alias-border-inverted);border-radius:10px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3)}.wcm-menuLabel{padding:4px 8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}.wcm-menuItem{display:flex;align-items:center;gap:8px;width:100%;min-height:26px;padding:3px 8px;border:0!important;border-radius:6px!important;font-size:12px!important;text-align:left;color:var(--dsw-alias-label-primary)!important;background:transparent}.wcm-menuItem:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-menuItemOn{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-menuText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wcm-menuCheck{flex:none;color:var(--dsw-alias-label-primary)}.wcm-menuDanger{color:var(--dsw-alias-state-error-primary)!important}.wcm-menuCompact{width:max-content;min-width:0;max-width:260px}.wcm-colorRow{display:flex;align-items:center;gap:8px}.wcm-actions{justify-content:flex-end}.wcm-dialog button{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:5px 10px;color:var(--dsw-alias-label-primary);background:transparent}.wcm-dialog button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.wcm-dialog button:disabled{cursor:default;opacity:.5}.wcm-form button{font:inherit;font-size:12px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:5px 10px;color:var(--dsw-alias-label-primary);background:transparent}.wcm-form button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.wcm-form button:disabled{cursor:default;opacity:.5}.wcm-randomColor{white-space:nowrap}.wcm-form-field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:10px}.wcm-selectFull{width:100%;min-width:0;box-sizing:border-box}.wcm-dirRow{display:flex;align-items:center;gap:6px}.wcm-dirInput{flex:1;min-width:0;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:7px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.wcm-dirInput::placeholder{color:var(--dsw-alias-label-tertiary)}.wcm-gap{height:2px}.wcm-groupList{display:flex;flex-direction:column;gap:2px;margin-top:4px}.wcm-groupOption{display:flex;align-items:center;gap:8px;width:100%;padding:6px 4px;border:0!important;border-radius:7px!important;font-size:13px!important;text-align:left;color:var(--dsw-alias-label-primary)!important;background:transparent!important}.wcm-groupOption:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-groupDot{width:10px;height:10px;border-radius:50%;flex:none}.wcm-groupName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wcm-projectMenuBtn,.wcm-sessionMenuBtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px!important;height:24px!important;padding:0!important;border:0!important;border-radius:6px!important;opacity:0;color:var(--dsw-alias-label-secondary)!important;background:transparent!important}.wcm-projectLine:hover .wcm-projectMenuBtn,.wcm-projectLine:focus-within .wcm-projectMenuBtn,.wcm-session:hover .wcm-sessionMenuBtn,.wcm-session:focus-within .wcm-sessionMenuBtn{opacity:1}.wcm-projectMenuBtn:hover,.wcm-sessionMenuBtn:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.wcm-session{position:relative;cursor:pointer;user-select:none}.wcm-renameInput{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:6px 8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}.wcm-sidebarRail .wcm-chips{display:none}.wcm-sidebarRail .wcm-folders{padding:0}.wcm-sidebarRail .wcm-folderRow{justify-content:center;padding:7px 0;font-size:0}.wcm-sidebarRail .wcm-rowChevron,.wcm-sidebarRail .wcm-folderLabel,.wcm-sidebarRail .wcm-folderCount,.wcm-sidebarRail .wcm-folderDissolve,.wcm-sidebarRail .wcm-folderDissolveSlot{display:none}.wcm-sidebarRail .wcm-rowIconSlot{width:22px;height:22px}.wcm-sidebarRail .wcm-projectAdd,.wcm-sidebarRail .wcm-projectMenuBtn,.wcm-sidebarRail .wcm-sessionMenuBtn{display:none}.wcm-sidebarRail .wcm-projectLine{justify-content:center;padding:7px 0}.wcm-sidebarRail .wcm-sessions{display:none}`;

// src/client/constants.ts
var NS = "settings.workspaceCategories";
var SETTINGS_NAMESPACE2 = "workspace-category-manager";

// src/client/api.ts
function createDshApi(ctx) {
  const workspaces = ctx.get("workspaces");
  const sessions = ctx.get("sessions");
  const uiWorkspace = () => ctx.get("uiWorkspace");
  const has = (obj, method) => obj !== void 0 && obj !== null && typeof obj[method] === "function";
  const hasUi = (method) => has(uiWorkspace(), method);
  const startSession = (workspaceId2) => {
    const uw = uiWorkspace();
    if (has(uw, "startSession")) return uw.startSession(workspaceId2);
    if (has(workspaces, "startSession")) return workspaces.startSession(workspaceId2);
    if (has(sessions, "create") && has(sessions, "open")) {
      const workspace = workspaces.list.getSnapshot().items.find((item) => item.workspaceId === workspaceId2);
      const snapshot = sessions.list.getSnapshot();
      const archived = workspaces.list.getSnapshot().archivedSessionIds ?? [];
      const blank = workspace === void 0 ? void 0 : snapshot.ids.map((id) => snapshot.byId[id]).find((s) => s !== void 0 && s.blank && s.cwd === workspace.path && workspace.sessionIds.includes(s.id) && !archived.includes(s.id));
      if (blank !== void 0) {
        sessions.open(blank.id);
        return Promise.resolve();
      }
      return sessions.create({ workspaceId: workspaceId2 }).then((sessionId) => {
        sessions.open(sessionId);
      });
    }
    return Promise.reject(new Error("startSession unavailable"));
  };
  const pickDirectory = () => {
    const uw = uiWorkspace();
    if (has(uw, "pickDirectory")) return uw.pickDirectory();
    if (has(workspaces, "pickDirectory")) return workspaces.pickDirectory();
    return Promise.reject(new Error("directory picking unavailable"));
  };
  return {
    startSession,
    pickDirectory,
    // Evaluated at render time — the button appears once the service is up.
    canPickDirectory: () => hasUi("pickDirectory") || has(workspaces, "pickDirectory"),
    openSession: (sessionId) => sessions.open(sessionId),
    forkSession: (opts) => sessions.fork(opts),
    sessionBinding: (sessionId) => sessions.binding(sessionId),
    createWorkspace: (input) => workspaces.create(input),
    renameWorkspace: (workspaceId2, title) => workspaces.rename(workspaceId2, title),
    deleteWorkspace: (workspaceId2) => workspaces.delete(workspaceId2),
    insertWorkspaceBefore: (workspaceId2, beforeWorkspaceId) => workspaces.insertBefore(workspaceId2, beforeWorkspaceId),
    archiveSession: (sessionId) => workspaces.archiveSession(sessionId),
    workspacesList: workspaces.list,
    sessionsList: sessions.list,
    settingsScope: ctx.get("settingsScope").bind({ namespace: SETTINGS_NAMESPACE2 })
  };
}

// src/client/components/CategorySection.tsx
var import_react4 = __toESM(require("react"), 1);
var import_react5 = require("react");

// src/client/utils.ts
var import_react = __toESM(require("react"), 1);
function useScope(scope) {
  return import_react.default.useSyncExternalStore((listener) => scope.subscribe(listener), () => scope.getSnapshot(), () => scope.getSnapshot());
}
function useWorkspaceSnapshot(list) {
  return import_react.default.useSyncExternalStore((listener) => list.subscribe(listener), () => list.getSnapshot(), () => list.getSnapshot());
}
function useSessionsSnapshot(list) {
  return import_react.default.useSyncExternalStore((listener) => list.subscribe(listener), () => list.getSnapshot(), () => list.getSnapshot());
}
function configOf(scope) {
  return scope.getSnapshot().value ?? { categories: [], assignments: {} };
}
var FOLDER_STATE_KEY = "dsh-workspace-category-manager:folderOpen";
var loadFolderState = () => {
  try {
    const raw = localStorage.getItem(FOLDER_STATE_KEY);
    if (raw === null) return {};
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};
var saveFolderState = (state) => {
  try {
    localStorage.setItem(FOLDER_STATE_KEY, JSON.stringify(state));
  } catch (error) {
  }
};
function errText2(error) {
  return error instanceof Error ? error.message : String(error);
}
function workspaceId(workspace) {
  return workspace.workspaceId;
}
function workspaceLabel(workspace) {
  return workspace.title || workspace.path?.replace(/.*[\\/]/, "") || workspace.workspaceId;
}

// src/client/components/dialogs.tsx
var import_react2 = __toESM(require("react"), 1);
var import_react3 = require("react");

// src/client/components/colors.ts
var idPattern = /^[a-z][a-z0-9-]{0,31}$/;
var colors2 = ["#4f8cff", "#16a085", "#8e5bd9", "#e67e22", "#df4d73", "#64748b"];

// src/client/components/dialogs.tsx
function Dialog({ title, close, children }) {
  return (0, import_react3.createElement)("div", { className: "wcm-dialogMask", onMouseDown: (event) => {
    if (event.currentTarget === event.target) close();
  } }, (0, import_react3.createElement)("section", { className: "wcm-dialog", role: "dialog", "aria-modal": true, "aria-label": title }, (0, import_react3.createElement)("header", { className: "wcm-dialogHead" }, (0, import_react3.createElement)("h3", null, title), (0, import_react3.createElement)("button", { className: "wcm-close", onClick: close }, "\xD7")), children));
}
function CategoryForm({ initial, save, cancel, lockedId = false }) {
  const [draft, setDraft] = import_react2.default.useState(initial);
  const [error, setError] = import_react2.default.useState("");
  const patch = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const randomColor = () => {
    const options = colors2.length > 1 ? colors2.filter((c) => c !== draft.color) : colors2;
    patch("color", options[Math.floor(Math.random() * options.length)]);
  };
  const submit = () => {
    const id = draft.id.trim();
    const name = draft.name.trim();
    if (!idPattern.test(id)) return setError("\u6807\u8BC6\u7B26\u5FC5\u987B\u662F\u5C0F\u5199 kebab-case\u3002");
    if (name === "") return setError("\u8BF7\u586B\u5199\u5206\u7C7B\u540D\u79F0\u3002");
    save({ ...draft, id, name });
  };
  return (0, import_react3.createElement)("div", { className: "wcm-form" }, (0, import_react3.createElement)("label", null, "\u6807\u8BC6\u7B26", (0, import_react3.createElement)("input", { value: draft.id, disabled: lockedId, placeholder: "client-projects", onChange: (event) => patch("id", event.target.value) })), (0, import_react3.createElement)("label", null, "\u5206\u7C7B\u540D\u79F0", (0, import_react3.createElement)("input", { value: draft.name, placeholder: "\u5BA2\u6237\u9879\u76EE", onChange: (event) => patch("name", event.target.value) })), (0, import_react3.createElement)("label", null, "\u989C\u8272", (0, import_react3.createElement)("div", { className: "wcm-colorRow" }, (0, import_react3.createElement)("input", { type: "color", value: draft.color, onChange: (event) => patch("color", event.target.value) }), (0, import_react3.createElement)("button", { type: "button", className: "wcm-randomColor", onClick: randomColor }, "\u968F\u673A"))), (0, import_react3.createElement)("div", { className: "wcm-span wcm-actions" }, (0, import_react3.createElement)("button", { onClick: cancel }, "\u53D6\u6D88"), (0, import_react3.createElement)("button", { className: "wcm-primary", onClick: submit }, "\u4FDD\u5B58")), error ? (0, import_react3.createElement)("p", { className: "wcm-error wcm-span" }, error) : null);
}
function Confirm({ title, text, close, confirm }) {
  return (0, import_react3.createElement)(Dialog, { title, close }, (0, import_react3.createElement)("p", { className: "wcm-muted" }, text), (0, import_react3.createElement)("div", { className: "wcm-actions" }, (0, import_react3.createElement)("button", { onClick: close }, "\u53D6\u6D88"), (0, import_react3.createElement)("button", { className: "wcm-danger", onClick: confirm }, "\u786E\u8BA4")));
}

// src/client/components/CategorySection.tsx
function CategorySection({ api, t }) {
  const scope = api.settingsScope;
  const settings = useScope(scope);
  const list = useWorkspaceSnapshot(api.workspacesList).items ?? [];
  const config = configOf(scope);
  const [dialog, setDialog] = import_react4.default.useState(null);
  const [failure, setFailure] = import_react4.default.useState("");
  const write = async (patch) => {
    try {
      setFailure("");
      for (const [key, value] of Object.entries(patch)) await scope.set(key, value);
    } catch (error) {
      setFailure(errText(error));
    }
  };
  const saveCategory = (category) => {
    const originalId = dialog?.kind === "edit" ? dialog.category.id : void 0;
    if (originalId !== void 0 && originalId !== category.id) return setFailure("\u5206\u7C7B\u6807\u8BC6\u7B26\u521B\u5EFA\u540E\u4E0D\u53EF\u4FEE\u6539\u3002");
    if (originalId === void 0 && config.categories.some((item) => item.id === category.id)) return setFailure("\u5206\u7C7B\u6807\u8BC6\u7B26\u5DF2\u5B58\u5728\u3002");
    write({ categories: originalId === void 0 ? [...config.categories, category] : config.categories.map((item) => item.id === category.id ? category : item) });
    setDialog(null);
  };
  const removeCategory = (category) => {
    const assignments = Object.fromEntries(Object.entries(config.assignments).filter(([, categoryId]) => categoryId !== category.id));
    write({ categories: config.categories.filter((item) => item.id !== category.id), assignments });
    setDialog(null);
  };
  const assign = (id, categoryId) => {
    const assignments = { ...config.assignments };
    if (categoryId === "") delete assignments[id];
    else assignments[id] = categoryId;
    write({ assignments });
  };
  if (settings.status === "loading") return (0, import_react5.createElement)("p", { className: "wcm-muted" }, t("loading"));
  if (settings.status !== "ready") return (0, import_react5.createElement)("p", { className: "wcm-error" }, t("unavailable"));
  return (0, import_react5.createElement)("div", { className: "wcm" }, (0, import_react5.createElement)("h2", null, t("title")), (0, import_react5.createElement)("p", { className: "wcm-intro" }, t("intro")), (0, import_react5.createElement)("p", { className: "wcm-muted" }, t("nonDestructive")), failure ? (0, import_react5.createElement)("p", { className: "wcm-error" }, failure) : null, (0, import_react5.createElement)("div", { className: "wcm-head" }, (0, import_react5.createElement)("h3", null, t("categoryTitle")), (0, import_react5.createElement)("button", { className: "wcm-primary", disabled: !settings.writable, onClick: () => setDialog({ kind: "add" }) }, t("addCategory"))), (0, import_react5.createElement)("div", { className: "wcm-list" }, config.categories.length === 0 ? (0, import_react5.createElement)("p", { className: "wcm-muted" }, t("emptyCategories")) : config.categories.map((category) => {
    const total = Object.values(config.assignments).filter((id) => id === category.id).length;
    return (0, import_react5.createElement)("article", { className: "wcm-card", key: category.id }, (0, import_react5.createElement)("div", { className: "wcm-row" }, (0, import_react5.createElement)("div", null, (0, import_react5.createElement)("div", { className: "wcm-title" }, (0, import_react5.createElement)("span", { className: "wcm-dot", style: { background: category.color } }), category.name), (0, import_react5.createElement)("div", { className: "wcm-meta" }, `${category.id} \xB7 ${t("assignedCount", { count: total })}`)), (0, import_react5.createElement)("div", { className: "wcm-actions", style: { marginTop: 0 } }, (0, import_react5.createElement)("button", { onClick: () => setDialog({ kind: "edit", category }) }, t("edit")), (0, import_react5.createElement)("button", { className: "wcm-danger", onClick: () => setDialog({ kind: "remove", category }) }, t("remove")))));
  })), (0, import_react5.createElement)("h3", null, t("workspaceTitle")), (0, import_react5.createElement)("div", { className: "wcm-list" }, list.length === 0 ? (0, import_react5.createElement)("p", { className: "wcm-muted" }, t("emptyWorkspaces")) : list.map((workspace) => {
    const id = workspaceId(workspace);
    return (0, import_react5.createElement)("article", { className: "wcm-card", key: id }, (0, import_react5.createElement)("div", { className: "wcm-row" }, (0, import_react5.createElement)("div", null, (0, import_react5.createElement)("div", { className: "wcm-title" }, workspaceLabel(workspace)), (0, import_react5.createElement)("div", { className: "wcm-meta" }, workspace.path)), (0, import_react5.createElement)("select", { className: "wcm-select", value: config.assignments[id] ?? "", disabled: !settings.writable, onChange: (event) => assign(id, event.target.value) }, (0, import_react5.createElement)("option", { value: "" }, t("uncategorized")), config.categories.map((category) => (0, import_react5.createElement)("option", { key: category.id, value: category.id }, category.name)))));
  })), dialog?.kind === "add" ? (0, import_react5.createElement)(Dialog, { title: t("addCategory"), close: () => setDialog(null) }, (0, import_react5.createElement)(CategoryForm, { initial: { id: "", name: "", color: colors[config.categories.length % colors.length] }, save: saveCategory, cancel: () => setDialog(null) })) : null, dialog?.kind === "edit" ? (0, import_react5.createElement)(Dialog, { title: t("editCategory"), close: () => setDialog(null) }, (0, import_react5.createElement)(CategoryForm, { initial: dialog.category, lockedId: true, save: saveCategory, cancel: () => setDialog(null) })) : null, dialog?.kind === "remove" ? (0, import_react5.createElement)(Confirm, { title: t("removeCategory"), text: t("removeConfirm", { name: dialog.category.name }), close: () => setDialog(null), confirm: () => removeCategory(dialog.category) }) : null);
}

// src/client/components/CategorySidebar.tsx
var import_react9 = __toESM(require("react"), 1);
var import_react10 = require("react");

// src/client/components/icons.tsx
var import_react6 = require("react");
var IconFolderClose16 = () => (0, import_react6.createElement)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { transform: "translate(1.5 2.429)", d: "M5.05582 0.518756L4.50669 0.86654L5.05582 0.518756ZM13 9.4837L13.65 9.4837L13.65 3.53962L13 3.53962L12.35 3.53962L12.35 9.4837L13 9.4837ZM11.3264 1.86603L11.3264 1.21603L6.52313 1.21603L6.52313 1.86603L6.52313 2.51603L11.3264 2.51603L11.3264 1.86603ZM5.58054 1.34727L6.12968 0.999489L5.60495 0.170972L5.05582 0.518756L4.50669 0.86654L5.03141 1.69506L5.58054 1.34727ZM4.11323 1.23058e-13L4.11323 -0.65L1.67359 -0.65L1.67359 5.00699e-14L1.67359 0.65L4.11323 0.65L4.11323 1.23058e-13ZM0 1.67359L-0.65 1.67359L-0.65 9.4837L0 9.4837L0.65 9.4837L0.65 1.67359L0 1.67359ZM11.3264 11.1573L11.3264 10.5073L1.67359 10.5073L1.67359 11.1573L1.67359 11.8073L11.3264 11.8073L11.3264 11.1573ZM0 9.4837L-0.65 9.4837C-0.65 10.767 0.390308 11.8073 1.67359 11.8073L1.67359 11.1573L1.67359 10.5073C1.10828 10.5073 0.65 10.049 0.65 9.4837L0 9.4837ZM1.67359 5.00699e-14L1.67359 -0.65C0.390307 -0.65 -0.65 0.390309 -0.65 1.67359L0 1.67359L0.65 1.67359C0.65 1.10828 1.10828 0.65 1.67359 0.65L1.67359 5.00699e-14ZM5.05582 0.518756L5.60495 0.170972C5.28121 -0.340193 4.71829 -0.65 4.11323 -0.65L4.11323 1.23058e-13L4.11323 0.65C4.27282 0.65 4.4213 0.731715 4.50669 0.86654L5.05582 0.518756ZM6.52313 1.86603L6.52313 1.21603C6.36354 1.21603 6.21507 1.13431 6.12968 0.999489L5.58054 1.34727L5.03141 1.69506C5.35515 2.20622 5.91808 2.51603 6.52313 2.51603L6.52313 1.86603ZM13 3.53962L13.65 3.53962C13.65 2.25634 12.6097 1.21603 11.3264 1.21603L11.3264 1.86603L11.3264 2.51603C11.8917 2.51603 12.35 2.97431 12.35 3.53962L13 3.53962ZM13 9.4837L12.35 9.4837C12.35 10.049 11.8917 10.5073 11.3264 10.5073L11.3264 11.1573L11.3264 11.8073C12.6097 11.8073 13.65 10.767 13.65 9.4837L13 9.4837Z", fill: "currentColor" }));
var IconFolderOpen16 = () => (0, import_react6.createElement)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { d: "M5.19629 1.57104C5.81144 1.5711 6.38623 1.8786 6.72754 2.39038L7.19922 3.09839C7.28454 3.22635 7.42824 3.30344 7.58203 3.30347H12.1699C13.5039 3.30348 14.5859 4.38548 14.5859 5.71948V6.62671C15.2694 7.02689 15.6605 7.85012 15.4385 8.68726L14.3848 12.658C14.1037 13.7164 13.1449 14.4527 12.0498 14.4529H2.91699C1.51651 14.4529 0.451662 13.2814 0.501954 11.9519V3.98706C0.501954 2.65305 1.58396 1.57104 2.91797 1.57104H5.19629ZM3.7793 7.75562C3.30994 7.75562 2.89883 8.07153 2.77832 8.52515L1.91602 11.7722C1.74167 12.4291 2.23734 13.073 2.91699 13.073H12.0498C12.5191 13.0728 12.9304 12.757 13.0508 12.3035L14.1045 8.33374C14.1819 8.04202 13.9619 7.756 13.6602 7.75562H3.7793ZM2.91797 2.9519C2.34625 2.9519 1.88281 3.41534 1.88281 3.98706V7.2937C2.33068 6.7269 3.02249 6.37476 3.7793 6.37476H13.2051V5.71948C13.2051 5.14777 12.7416 4.68434 12.1699 4.68433H7.58203C6.96675 4.6843 6.39209 4.37595 6.05078 3.86401L5.5791 3.15601C5.49379 3.02821 5.34995 2.95196 5.19629 2.9519H2.91797Z", fill: "currentColor" }), (0, import_react6.createElement)("path", { opacity: "0.2", d: "M13.6602 7.75525C13.9618 7.7556 14.1815 8.04179 14.1045 8.33337L13.0508 12.3031C12.9304 12.7567 12.5191 13.0725 12.0498 13.0726H2.91701C2.23744 13.0725 1.7417 12.4287 1.91603 11.7719L2.77834 8.52478C2.89898 8.07146 3.31018 7.75532 3.77931 7.75525H13.6602ZM5.1963 2.95154C5.34985 2.95159 5.49377 3.02803 5.57912 3.15564L6.0508 3.86365C6.39205 4.37553 6.96685 4.68385 7.58205 4.68396H12.1699C12.7416 4.68396 13.2049 5.14754 13.2051 5.71912V6.37439H3.77931C3.02267 6.37444 2.33067 6.72671 1.88283 7.29333V3.98669C1.88299 3.4152 2.34649 2.95168 2.91798 2.95154H5.1963Z", fill: "currentColor" }));
var IconTriangleRightFill14 = () => (0, import_react6.createElement)("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { d: "M4.25 2.82782L4.25 11.1722C4.25 11.6622 4.84243 11.9076 5.18891 11.5611L9.36109 7.38891C9.57588 7.17412 9.57588 6.82588 9.36109 6.61109L5.18891 2.43891C4.84243 2.09243 4.25 2.33782 4.25 2.82782Z", fill: "currentColor" }));
var IconPlusOutline16 = () => (0, import_react6.createElement)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { d: "M8.64453 1.5V7.34961H14.5V8.65039H8.64453V14.5H7.34473V8.65039H1.5V7.34961H7.34473V1.5H8.64453Z", fill: "currentColor" }));
var IconPersonalizationOutline16 = () => (0, import_react6.createElement)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { transform: "translate(1.292 1.3)", d: "M10.3232 9.18164C11.2868 9.18164 12.0985 9.82833 12.3506 10.7109L13.415 10.7109L13.415 11.8711L12.3496 11.8711C12.0971 12.7532 11.2864 13.3994 10.3232 13.3994C9.36031 13.3992 8.55012 12.7531 8.29785 11.8711L0 11.8711L0 10.7109L8.29688 10.7109C8.54876 9.82845 9.35988 9.18186 10.3232 9.18164ZM10.3232 10.3418C9.7999 10.3421 9.37534 10.7667 9.375 11.29C9.375 11.8137 9.79969 12.239 10.3232 12.2393C10.847 12.2393 11.2725 11.8138 11.2725 11.29C11.2721 10.7666 10.8468 10.3418 10.3232 10.3418ZM12.4326 11.291C12.4326 11.3549 12.4284 11.418 12.4229 11.4805C12.4287 11.4181 12.4326 11.355 12.4326 11.291ZM8.21484 11.2832C8.21484 11.2856 8.21484 11.2886 8.21484 11.291L8.21484 11.29C8.21484 11.2878 8.21484 11.2855 8.21484 11.2832ZM3.08301 4.59082C4.04605 4.59095 4.85696 5.23717 5.10938 6.11914L13.415 6.11914L13.415 7.2793L5.11035 7.2793C4.85833 8.16202 4.04648 8.80846 3.08301 8.80859C2.11972 8.80843 1.30963 8.16179 1.05762 7.2793L0 7.2793L0 6.11914L1.05762 6.11914C1.30994 5.23728 2.12006 4.59098 3.08301 4.59082ZM3.08301 5.75098C2.55962 5.75117 2.13512 6.17587 2.13477 6.69922C2.13477 7.22287 2.5594 7.64824 3.08301 7.64844C3.60665 7.64828 4.03223 7.2229 4.03223 6.69922C4.03187 6.17585 3.60643 5.75113 3.08301 5.75098ZM5.19238 6.69922C5.19238 6.763 5.18816 6.82633 5.18262 6.88867C5.18846 6.82629 5.19238 6.76313 5.19238 6.69922C5.19236 6.63495 5.18853 6.57152 5.18262 6.50879C5.18826 6.57154 5.19236 6.635 5.19238 6.69922ZM0.982422 6.52344C0.977382 6.58136 0.97463 6.63999 0.974609 6.69922C0.974609 6.75775 0.977496 6.81579 0.982422 6.87305C0.977758 6.81579 0.974609 6.75767 0.974609 6.69922C0.974628 6.64 0.977618 6.58142 0.982422 6.52344ZM10.3232 0C11.2869 0 12.0986 0.646596 12.3506 1.5293L13.415 1.5293L13.415 2.68945L12.3496 2.68945C12.363 2.64266 12.3754 2.59488 12.3857 2.54688C12.1838 3.50118 11.3376 4.21777 10.3232 4.21777C9.36037 4.21756 8.55018 3.57139 8.29785 2.68945L0 2.68945L0 1.5293L8.29688 1.5293C8.5487 0.646717 9.35981 0.00021854 10.3232 0ZM10.3232 1.16016C9.79984 1.16042 9.37524 1.58499 9.375 2.1084C9.375 2.63201 9.79969 3.05735 10.3232 3.05762C10.847 3.05762 11.2725 2.63217 11.2725 2.1084C11.2722 1.58483 10.8469 1.16016 10.3232 1.16016ZM12.4229 2.29883C12.4287 2.23641 12.4326 2.17331 12.4326 2.10938C12.4326 2.17327 12.4284 2.23638 12.4229 2.29883ZM8.21484 2.10938L8.21484 2.1084L8.21484 2.10938ZM8.22266 1.93359C8.21785 1.98897 8.21506 2.04499 8.21484 2.10156C8.21503 2.04501 8.2181 1.98902 8.22266 1.93359ZM8.22266 11.1162C8.2179 11.1713 8.21507 11.227 8.21484 11.2832C8.21504 11.227 8.21814 11.1713 8.22266 11.1162Z", fill: "currentColor" }));
var IconProjectAddOutline16 = () => (0, import_react6.createElement)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { transform: "translate(9.52 2.52)", d: "M3.55246 0L3.55246 2.44252L6 2.44252L6 3.55748L3.55246 3.55748L3.55246 6L2.43834 6L2.43834 3.55748L0 3.55748L0 2.44252L2.43834 2.44252L2.43834 0L3.55246 0Z", fill: "currentColor" }), (0, import_react6.createElement)("path", { transform: "translate(0.3496 2.35)", d: "M4.76367 0C5.36861 1.80598e-05 5.93113 0.310294 6.25488 0.821289L6.78027 1.64941C6.79685 1.67558 6.81791 1.69775 6.83887 1.71973C6.72186 2.15521 6.65702 2.61192 6.65137 3.08301C6.25601 2.96045 5.90909 2.70478 5.68164 2.3457L5.15723 1.5166C5.07183 1.38189 4.92318 1.3008 4.76367 1.30078L2.32422 1.30078C1.7589 1.30078 1.30078 1.7589 1.30078 2.32422L1.30078 10.1338C1.30078 10.6991 1.7589 11.1572 2.32422 11.1572L11.9766 11.1572C12.5419 11.1572 13 10.6991 13 10.1338L13 8.58398C13.4545 8.5135 13.8903 8.38748 14.3008 8.21289L14.3008 10.1338C14.3008 11.4171 13.2598 12.458 11.9766 12.458L2.32422 12.458C1.04093 12.458 0 11.4171 0 10.1338L0 2.32422C0 1.04093 1.04093 0 2.32422 0L4.76367 0Z", fill: "currentColor" }));
var IconEllipsisOutline16 = () => (0, import_react6.createElement)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { d: "M4.55146 8.00001C4.55146 8.63513 4.03659 9.15001 3.40146 9.15001C2.76634 9.15001 2.25146 8.63513 2.25146 8.00001C2.25146 7.36488 2.76634 6.85001 3.40146 6.85001C4.03659 6.85001 4.55146 7.36488 4.55146 8.00001Z", fill: "currentColor" }), (0, import_react6.createElement)("path", { d: "M9.1476 8.00001C9.1476 8.63513 8.63273 9.15001 7.9976 9.15001C7.36248 9.15001 6.8476 8.63513 6.8476 8.00001C6.8476 7.36488 7.36248 6.85001 7.9976 6.85001C8.63273 6.85001 9.1476 7.36488 9.1476 8.00001Z", fill: "currentColor" }), (0, import_react6.createElement)("path", { d: "M13.7486 8.00001C13.7486 8.63513 13.2338 9.15001 12.5986 9.15001C11.9635 9.15001 11.4486 8.63513 11.4486 8.00001C11.4486 7.36488 11.9635 6.85001 12.5986 6.85001C13.2338 6.85001 13.7486 7.36488 13.7486 8.00001Z", fill: "currentColor" }));
var IconTrashOutline16 = () => (0, import_react6.createElement)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { d: "M14.4782 4.84067L14.2138 10.1152C14.1102 12.1872 14.067 13.0115 13.3866 13.9607C13.1044 14.3546 12.7498 14.6912 12.3424 14.9535C11.8239 15.2872 11.2415 15.4316 10.5585 15.4998C9.88727 15.5668 9.04946 15.5656 7.99998 15.5656C6.95051 15.5656 6.1127 15.5668 5.44142 15.4998C4.75851 15.4316 4.17602 15.2872 3.65753 14.9535C3.25012 14.6912 2.89559 14.3546 2.61332 13.9607C1.93296 13.0115 1.88979 12.1872 1.78619 10.1152L1.52179 4.84067L2.89006 4.77277L3.15343 10.0463C3.26221 12.2218 3.32452 12.6015 3.72646 13.1624C3.90825 13.4161 4.13686 13.6334 4.39927 13.8023C4.66204 13.9714 5.00263 14.0792 5.57825 14.1367C6.16562 14.1953 6.92298 14.1963 7.99998 14.1963C9.07699 14.1963 9.83434 14.1953 10.4217 14.1367C10.9973 14.0792 11.3379 13.9714 11.6007 13.8023C11.8631 13.6334 12.0917 13.4161 12.2735 13.1624C12.6755 12.6015 12.7378 12.2218 12.8465 10.0463L13.1099 4.77277L14.4782 4.84067ZM5.43011 6.22849H6.7994V11.3909H5.43011V6.22849ZM9.20056 6.22849H10.5699V11.3909H9.20056V6.22849ZM8.53597 0.434431C9.17976 0.434431 9.6522 0.426926 10.0966 0.571258C10.2357 0.616451 10.3717 0.672554 10.502 0.738948C10.9182 0.951107 11.2464 1.29099 11.7015 1.74612L12.4978 2.54136H15.3742V3.91169H0.625732V2.54136H3.50218L4.29845 1.74612C4.75358 1.29099 5.08174 0.951107 5.49801 0.738948C5.62831 0.672554 5.76425 0.616451 5.90334 0.571258C6.34776 0.426926 6.82021 0.434431 7.46399 0.434431H8.53597ZM7.46399 1.80476C6.73208 1.80476 6.51641 1.81187 6.32617 1.87369C6.25545 1.89667 6.18668 1.92533 6.12041 1.95907C5.96398 2.03878 5.82348 2.16253 5.44142 2.54136H10.5585C10.1765 2.16253 10.036 2.03878 9.87955 1.95907C9.81329 1.92533 9.74452 1.89667 9.6738 1.87369C9.48356 1.81187 9.26789 1.80476 8.53597 1.80476H7.46399Z", fill: "currentColor" }));
var IconTagOutline16 = () => (0, import_react6.createElement)("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true }, (0, import_react6.createElement)("path", { fill: "currentColor", fillRule: "evenodd", d: "M2 6.5V3a1 1 0 0 1 1-1h3.5a1 1 0 0 1 .707.293l5.5 5.5a1 1 0 0 1 0 1.414l-3.5 3.5a1 1 0 0 1-1.414 0L2.293 7.207A1 1 0 0 1 2 6.5Zm3.2-2.6a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z" }));

// src/client/components/StateDot.tsx
var import_react7 = __toESM(require("react"), 1);
var import_react8 = require("react");
var MATRIX_CELLS = [[0, 0], [4, 0], [8, 0], [8, 4], [8, 8], [4, 8], [0, 8], [0, 4]];
function StateDot({ state }) {
  const phaseRef = import_react7.default.useRef(null);
  if (phaseRef.current === null) phaseRef.current = Date.now() % 1e3;
  if (state === "ongoing") return (0, import_react8.createElement)("svg", { className: "wcm-dotMatrix", "data-state": "ongoing", width: 10, height: 10, viewBox: "0 0 10 10", shapeRendering: "crispEdges", "aria-hidden": true }, MATRIX_CELLS.map(([x, y], index) => {
    const delay = ((0 - phaseRef.current - index * 125) % 1e3 + 1e3) % 1e3 - 1e3;
    return (0, import_react8.createElement)("rect", { className: "wcm-dotCell", key: `${x}-${y}`, x, y, width: "2", height: "2", style: { animationDelay: `${delay}ms` } });
  }));
  return (0, import_react8.createElement)("span", { className: "wcm-dot", "data-state": state, style: { width: 10, height: 10 }, "aria-hidden": true });
}

// src/client/components/CategorySidebar.tsx
var sessionStatus = (summary) => summary.pendingInteraction !== void 0 ? "warning" : summary.running ? "running" : summary.completed === true ? "done" : void 0;
function CategorySidebar({ api, wide, expandSidebar, t }) {
  const scope = api.settingsScope;
  const snapshot = useScope(scope);
  const workspaceState = useWorkspaceSnapshot(api.workspacesList);
  const sessionState = useSessionsSnapshot(api.sessionsList);
  const config = configOf(scope);
  const [failure, setFailure] = import_react9.default.useState("");
  const [openFolders, setOpenFolders] = import_react9.default.useState(loadFolderState);
  const [expandedIds, setExpandedIds] = import_react9.default.useState({});
  const [orderBy, setOrderBy] = import_react9.default.useState("manual");
  const [menuOpen, setMenuOpen] = import_react9.default.useState(false);
  const [addError, setAddError] = import_react9.default.useState(null);
  const [menuFor, setMenuFor] = import_react9.default.useState(null);
  const [renameTarget, setRenameTarget] = import_react9.default.useState(null);
  const [renameDraft, setRenameDraft] = import_react9.default.useState("");
  const [renameBusy, setRenameBusy] = import_react9.default.useState(false);
  const [renameError, setRenameError] = import_react9.default.useState("");
  const [deleteTarget, setDeleteTarget] = import_react9.default.useState(null);
  const [deleteBusy, setDeleteBusy] = import_react9.default.useState(false);
  const [deleteError, setDeleteError] = import_react9.default.useState("");
  const [addCategoryOpen, setAddCategoryOpen] = import_react9.default.useState(false);
  const [addOpen, setAddOpen] = import_react9.default.useState(false);
  const [addDraft, setAddDraft] = import_react9.default.useState({ path: "", group: "" });
  const [addBusy, setAddBusy] = import_react9.default.useState(false);
  const [addFormError, setAddFormError] = import_react9.default.useState("");
  const [dissolveTarget, setDissolveTarget] = import_react9.default.useState(null);
  const [dissolveBusy, setDissolveBusy] = import_react9.default.useState(false);
  const [dissolveError, setDissolveError] = import_react9.default.useState("");
  const dragRef = import_react9.default.useRef({ kind: null, id: null, el: null, over: null });
  const list = workspaceState.items ?? [];
  const byId = sessionState.byId ?? {};
  const currentId = sessionState.current;
  const startSession = (workspace) => api.startSession(workspaceId(workspace));
  const openSession = (sessionId) => api.openSession(sessionId);
  const toggleProject = (id) => setExpandedIds((previous) => ({ ...previous, [id]: !previous[id] }));
  const toggleFolder = (id) => setOpenFolders((previous) => {
    const next = { ...previous, [id]: previous[id] === false };
    saveFolderState(next);
    return next;
  });
  const sessionsOf = (workspace) => {
    const archived = new Set(workspaceState.archivedSessionIds ?? []);
    return (workspace.sessionIds ?? []).map((id) => byId[id]).filter((summary) => summary !== void 0 && summary.origin !== "subagent" && !archived.has(summary.id) && (!summary.blank || summary.id === currentId));
  };
  const runningOf = (workspace) => (workspace.sessionIds ?? []).some((id) => byId[id]?.running === true);
  const statusOfWorkspace = (workspace) => {
    const rows = sessionsOf(workspace);
    const statuses = rows.map(sessionStatus).filter((s) => s !== void 0);
    if (statuses.includes("warning")) return "warning";
    if (statuses.includes("running")) return "running";
    if (statuses.includes("done")) return "done";
    return void 0;
  };
  const statusOfCategory = (f) => {
    const statuses = f.projects.map(statusOfWorkspace).filter((s) => s !== void 0);
    if (statuses.length === 0) return void 0;
    if (statuses.includes("warning")) return "warning";
    if (statuses.includes("running")) return "running";
    return "done";
  };
  const statusDot = (status) => status !== void 0 ? (0, import_react10.createElement)("span", { className: `wcm-wsDot wcm-ws-${status}` }) : null;
  const sessionStatusDot = (status) => status === "running" ? (0, import_react10.createElement)(StateDot, { state: "ongoing" }) : statusDot(status);
  const statusIconSlot = (status, icon) => (0, import_react10.createElement)("span", { className: "wcm-rowIconSlot" }, (0, import_react10.createElement)("span", { className: "wcm-rowIcon" }, icon), (0, import_react10.createElement)("span", { className: "wcm-rowChevron" }, (0, import_react10.createElement)(IconTriangleRightFill14)), status !== void 0 ? (0, import_react10.createElement)("span", { className: `wcm-wsDot wcm-wsBadge wcm-ws-${status}` }) : null);
  const latestUpdatedAt = (workspace) => (workspace.sessionIds ?? []).reduce((max, id) => {
    const summary = byId[id];
    const updated = summary !== void 0 && typeof summary.updatedAt === "number" ? summary.updatedAt : 0;
    return updated > max ? updated : max;
  }, 0);
  const assignmentOf = (wid) => config.assignments[wid];
  const projectsOf = (catId) => list.filter((workspace) => assignmentOf(workspaceId(workspace)) === catId);
  const orderProjects = (projects) => orderBy === "updated" ? [...projects].sort((a, b) => latestUpdatedAt(b) - latestUpdatedAt(a)) : projects;
  const folders = config.categories.map((category) => ({ id: category.id, name: category.name, color: category.color, projects: orderProjects(projectsOf(category.id)) })).concat({ id: "__uncategorized__", name: t("uncategorized"), color: "#94a3b8", projects: orderProjects(projectsOf(void 0)) });
  const openAddWorkspace = () => {
    setAddDraft({ path: "", group: config.categories[0]?.id ?? "" });
    setAddFormError("");
    setAddError(null);
    setAddOpen(true);
  };
  const browseDirectory = async () => {
    if (addBusy) return;
    setAddBusy(true);
    setAddFormError("");
    try {
      const path = await api.pickDirectory();
      setAddDraft((draft) => ({ ...draft, path }));
    } catch (error) {
      setAddFormError(errText2(error));
    } finally {
      setAddBusy(false);
    }
  };
  const saveAddWorkspace = async () => {
    const path = addDraft.path.trim();
    if (path === "" || addBusy) return;
    setAddBusy(true);
    setAddFormError("");
    try {
      const workspace = await api.createWorkspace({ path });
      const wid = workspaceId(workspace);
      const assignments = { ...config.assignments };
      const group = addDraft.group;
      if (group === "" || group === "__uncategorized__") delete assignments[wid];
      else assignments[wid] = group;
      await scope.set("assignments", assignments);
      setAddOpen(false);
      api.startSession(wid);
    } catch (error) {
      setAddFormError(errText2(error));
    } finally {
      setAddBusy(false);
    }
  };
  const rowHalf = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  };
  const commitDrop = (activeId, targetId, half) => {
    if (activeId === null || activeId === targetId) return;
    const index = list.findIndex((workspace) => workspaceId(workspace) === targetId);
    if (index === -1) return;
    const anchor = half === "before" ? targetId : list[index + 1]?.workspaceId;
    if (anchor === activeId) return;
    const sourceIndex = list.findIndex((workspace) => workspaceId(workspace) === activeId);
    const anchorIndex = anchor === void 0 ? list.length : list.findIndex((workspace) => workspaceId(workspace) === anchor);
    if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
    const targetCat = assignmentOf(targetId);
    const activeCat = assignmentOf(activeId);
    if (targetCat !== activeCat) {
      const assignments = { ...config.assignments };
      if (targetCat === void 0) delete assignments[activeId];
      else assignments[activeId] = targetCat;
      scope.set("assignments", assignments).catch((reason) => {
        setFailure(errText2(reason));
      });
    }
    api.insertWorkspaceBefore(activeId, anchor).catch((reason) => {
      setFailure(reason instanceof Error ? reason.message : String(reason));
    });
  };
  const commitFolderDrop = (activeId, targetId, half) => {
    if (activeId === targetId) return;
    const cats = config.categories;
    const index = cats.findIndex((category) => category.id === targetId);
    if (index === -1) return;
    const anchor = half === "before" ? targetId : cats[index + 1]?.id;
    if (anchor === activeId) return;
    const sourceIndex = cats.findIndex((category) => category.id === activeId);
    const anchorIndex = anchor === void 0 ? cats.length : cats.findIndex((category) => category.id === anchor);
    if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
    const next = cats.filter((category) => category.id !== activeId);
    const insertAt = anchor === void 0 ? next.length : next.findIndex((category) => category.id === anchor);
    next.splice(insertAt === -1 ? next.length : insertAt, 0, cats[sourceIndex]);
    scope.set("categories", next).catch((reason) => {
      setFailure(errText2(reason));
    });
  };
  const commitAssign = (projectId, folderId) => {
    if (folderId === "__uncategorized__") {
      if (config.assignments[projectId] === void 0) return;
      const assignments = { ...config.assignments };
      delete assignments[projectId];
      scope.set("assignments", assignments).catch((reason) => {
        setFailure(errText2(reason));
      });
    } else {
      if (config.assignments[projectId] === folderId) return;
      const assignments = { ...config.assignments, [projectId]: folderId };
      scope.set("assignments", assignments).catch((reason) => {
        setFailure(errText2(reason));
      });
    }
  };
  const clearDrag = () => {
    const s = dragRef.current;
    if (s.over !== null) s.over.el.classList.remove("wcm-dropBefore", "wcm-dropAfter", "wcm-dropInto");
    if (s.el !== null) s.el.classList.remove("wcm-dragging");
    dragRef.current = { kind: null, id: null, el: null, over: null };
  };
  const dragStart = (kind, id) => (event) => {
    dragRef.current = { kind, id, el: event.currentTarget, over: null };
    if (event.dataTransfer !== void 0) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    }
    event.currentTarget.classList.add("wcm-dragging");
  };
  const dragOverFolder = (folderId) => (event) => {
    const s = dragRef.current;
    if (s.id === null || s.kind === "folder" && (s.id === folderId || folderId === "__uncategorized__")) return;
    event.preventDefault();
    if (event.dataTransfer !== void 0) event.dataTransfer.dropEffect = "move";
    if (s.kind === "folder") {
      if (s.over !== null && s.over.el !== event.currentTarget) s.over.el.classList.remove("wcm-dropBefore", "wcm-dropAfter", "wcm-dropInto");
      event.currentTarget.classList.remove("wcm-dropBefore", "wcm-dropAfter", "wcm-dropInto");
      const half = rowHalf(event);
      event.currentTarget.classList.add(half === "before" ? "wcm-dropBefore" : "wcm-dropAfter");
      s.over = { el: event.currentTarget, half };
    } else {
      if (s.over !== null && s.over.el !== event.currentTarget) s.over.el.classList.remove("wcm-dropBefore", "wcm-dropAfter", "wcm-dropInto");
      event.currentTarget.classList.remove("wcm-dropBefore", "wcm-dropAfter", "wcm-dropInto");
      event.currentTarget.classList.add("wcm-dropInto");
      s.over = { el: event.currentTarget, half: null };
    }
  };
  const dropOnFolder = (folderId) => (event) => {
    event.preventDefault();
    const s = dragRef.current;
    if (s.kind === "folder") {
      if (folderId !== "__uncategorized__") commitFolderDrop(s.id, folderId, rowHalf(event));
    } else commitAssign(s.id, folderId);
    clearDrag();
  };
  const dragOverProject = (id) => (event) => {
    const s = dragRef.current;
    if (s.kind !== "project" || s.id === null || s.id === id) return;
    event.preventDefault();
    if (event.dataTransfer !== void 0) event.dataTransfer.dropEffect = "move";
    const half = rowHalf(event);
    if (s.over !== null && s.over.el !== event.currentTarget) s.over.el.classList.remove("wcm-dropBefore", "wcm-dropAfter", "wcm-dropInto");
    event.currentTarget.classList.remove("wcm-dropBefore", "wcm-dropAfter", "wcm-dropInto");
    event.currentTarget.classList.add(half === "before" ? "wcm-dropBefore" : "wcm-dropAfter");
    s.over = { el: event.currentTarget, half };
  };
  const dropOnProject = (id) => (event) => {
    event.preventDefault();
    commitDrop(dragRef.current.id, id, rowHalf(event));
    clearDrag();
  };
  const dragEnd = () => {
    clearDrag();
  };
  const closeMenus = () => {
    setMenuFor(null);
    setMenuOpen(false);
  };
  const toggleMenuFor = (kind, id) => setMenuFor(menuFor !== null && menuFor.kind === kind && menuFor.id === id ? null : { kind, id });
  const confirmRename = async () => {
    if (renameTarget === null || renameBusy) return;
    const title = renameDraft.trim();
    if (title === "") return;
    setRenameBusy(true);
    setRenameError("");
    try {
      if (renameTarget.kind === "workspace") await api.renameWorkspace(renameTarget.id, title);
      else {
        const session = api.sessionBinding(renameTarget.id)?.session;
        if (session === void 0) throw new Error("unknown session");
        const result = await session.rename(title);
        if (!result.ok) throw new Error(result.error.message);
      }
      setRenameTarget(null);
    } catch (error) {
      setRenameError(errText2(error));
    } finally {
      setRenameBusy(false);
    }
  };
  const confirmDelete = async () => {
    if (deleteTarget === null || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await api.deleteWorkspace(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(errText2(error));
    } finally {
      setDeleteBusy(false);
    }
  };
  const confirmDissolve = async () => {
    if (dissolveTarget === null || dissolveBusy) return;
    setDissolveBusy(true);
    setDissolveError("");
    try {
      const assignments = { ...config.assignments };
      Object.keys(assignments).forEach((wid) => {
        if (assignments[wid] === dissolveTarget.id) delete assignments[wid];
      });
      await scope.set("assignments", assignments);
      await scope.set("categories", config.categories.filter((category) => category.id !== dissolveTarget.id));
      setDissolveTarget(null);
    } catch (error) {
      setDissolveError(errText2(error));
    } finally {
      setDissolveBusy(false);
    }
  };
  const forkSession = (sessionId) => {
    api.forkSession({ sessionId, increaseTitle: true }).then((childId) => {
      api.openSession(childId);
    }).catch(() => {
    });
  };
  const archiveSession = (sessionId) => {
    api.archiveSession(sessionId).catch((reason) => {
      setFailure(reason instanceof Error ? reason.message : String(reason));
    });
  };
  const menuItem = (label, danger, onPick) => (0, import_react10.createElement)("button", { className: `wcm-menuItem${danger ? " wcm-menuDanger" : ""}`, onClick: () => {
    closeMenus();
    onPick();
  } }, (0, import_react10.createElement)("span", { className: "wcm-menuText" }, label));
  const popover = (...items) => [(0, import_react10.createElement)("div", { className: "wcm-menuMask", key: "mask", onClick: closeMenus }), (0, import_react10.createElement)("div", { className: "wcm-menu wcm-menuCompact", key: "menu" }, ...items)];
  const project = (workspace) => {
    const id = workspaceId(workspace);
    const rows = sessionsOf(workspace);
    const expanded = wide && expandedIds[id] === true;
    const wsStatus = statusOfWorkspace(workspace);
    const label = workspaceLabel(workspace);
    const act = () => {
      if (wide) toggleProject(id);
      else startSession(workspace);
    };
    const wsMenuOpen = menuFor !== null && menuFor.kind === "workspace" && menuFor.id === id;
    return (0, import_react10.createElement)("div", { className: `wcm-projectRow${expanded ? " wcm-open" : ""}`, key: id, draggable: wide, title: workspace.path, role: "button", tabIndex: 0, onClick: act, onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        act();
      }
    }, onDragStart: wide ? dragStart("project", id) : void 0, onDragOver: wide ? dragOverProject(id) : void 0, onDrop: wide ? dropOnProject(id) : void 0, onDragEnd: wide ? dragEnd : void 0 }, (0, import_react10.createElement)("div", { className: "wcm-projectLine" }, statusIconSlot(wsStatus, expanded ? (0, import_react10.createElement)(IconFolderOpen16) : (0, import_react10.createElement)(IconFolderClose16)), (0, import_react10.createElement)("span", { className: "wcm-projectLabel" }, label), wide ? (0, import_react10.createElement)("button", { className: "wcm-projectAdd", title: t("newSession"), onClick: (event) => {
      event.stopPropagation();
      startSession(workspace);
    } }, (0, import_react10.createElement)(IconPlusOutline16)) : null, wide ? (0, import_react10.createElement)("button", { className: "wcm-projectMenuBtn", title: t("workspaceMenu"), "aria-label": t("workspaceMenu"), onClick: (event) => {
      event.stopPropagation();
      setMenuOpen(false);
      toggleMenuFor("workspace", id);
    } }, (0, import_react10.createElement)(IconEllipsisOutline16)) : null), wsMenuOpen ? popover(menuItem(t("rename"), false, () => {
      setRenameTarget({ kind: "workspace", id, title: label });
      setRenameDraft(label);
      setRenameError("");
    }), menuItem(t("deleteWorkspace"), true, () => setDeleteTarget({ id, label }))) : null, wide && expanded ? (0, import_react10.createElement)("div", { className: "wcm-sessions" }, rows.map((summary) => {
      const status = sessionStatus(summary);
      const showStatus = status !== void 0;
      const title = summary.blank ? t("newSession") : summary.displayTitle ?? summary.title ?? summary.id;
      const openIt = () => {
        openSession(summary.id);
      };
      const sessMenuOpen = menuFor !== null && menuFor.kind === "session" && menuFor.id === summary.id;
      return (0, import_react10.createElement)("div", { className: `wcm-session${summary.id === currentId ? " wcm-current" : ""}`, key: summary.id, role: "button", tabIndex: 0, title: summary.cwd, onClick: (event) => {
        event.stopPropagation();
        openIt();
      }, onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openIt();
        }
      } }, (0, import_react10.createElement)("span", { className: "wcm-sessionStatus" }, showStatus ? sessionStatusDot(status) : null), (0, import_react10.createElement)("span", { className: "wcm-sessionTitle" }, title), (0, import_react10.createElement)("button", { className: "wcm-sessionMenuBtn", title: t("sessionMenu"), "aria-label": t("sessionMenu"), onClick: (event) => {
        event.stopPropagation();
        setMenuOpen(false);
        toggleMenuFor("session", summary.id);
      } }, (0, import_react10.createElement)(IconEllipsisOutline16)), sessMenuOpen ? popover(menuItem(t("rename"), false, () => {
        setRenameTarget({ kind: "session", id: summary.id, title });
        setRenameDraft(title);
        setRenameError("");
      }), menuItem(t("fork"), false, () => forkSession(summary.id)), menuItem(t("archive"), false, () => archiveSession(summary.id))) : null);
    })) : null);
  };
  const folder = (f) => {
    const isUncategorized = f.id === "__uncategorized__";
    const open = wide && openFolders[f.id] !== false;
    const status = statusOfCategory(f);
    const onToggle = () => {
      if (wide) toggleFolder(f.id);
      else if (expandSidebar !== void 0) expandSidebar();
    };
    return (0, import_react10.createElement)("div", { className: "wcm-folderWrap", key: f.id }, (0, import_react10.createElement)("div", { className: `wcm-folderRow${open ? " wcm-open" : ""}`, draggable: wide && !isUncategorized, role: "button", tabIndex: 0, title: f.name, onClick: onToggle, onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggle();
      }
    }, onDragStart: wide && !isUncategorized ? dragStart("folder", f.id) : void 0, onDragOver: wide ? dragOverFolder(f.id) : void 0, onDrop: wide ? dropOnFolder(f.id) : void 0, onDragEnd: wide ? dragEnd : void 0 }, statusIconSlot(status, (0, import_react10.createElement)("span", { className: "wcm-rowIcon wcm-rowIconCategory", style: { color: f.color } }, (0, import_react10.createElement)(IconTagOutline16))), (0, import_react10.createElement)("span", { className: "wcm-folderLabel" }, f.name), (0, import_react10.createElement)("span", { className: "wcm-folderCount" }, f.projects.length), !isUncategorized ? (0, import_react10.createElement)("button", { className: "wcm-folderDissolve", title: t("dissolveCategory"), "aria-label": t("dissolveCategory"), onClick: (event) => {
      event.stopPropagation();
      setDissolveTarget({ id: f.id, name: f.name });
    } }, (0, import_react10.createElement)(IconTrashOutline16)) : (0, import_react10.createElement)("span", { className: "wcm-folderDissolveSlot" })), open ? (0, import_react10.createElement)("div", { className: "wcm-folderProjects" }, f.projects.map(project)) : null);
  };
  const sortItem = (mode, label) => (0, import_react10.createElement)("button", { className: `wcm-menuItem${orderBy === mode ? " wcm-menuItemOn" : ""}`, onClick: () => {
    setOrderBy(mode);
    setMenuOpen(false);
  } }, (0, import_react10.createElement)("span", { className: "wcm-menuText" }, label), orderBy === mode ? (0, import_react10.createElement)("span", { className: "wcm-menuCheck" }, "\u2713") : null);
  const headerActions = (0, import_react10.createElement)("div", { className: "wcm-sidebarActions" }, (0, import_react10.createElement)("button", { className: "wcm-iconBtn", title: t("viewOptions"), "aria-label": t("viewOptions"), onClick: () => {
    setMenuFor(null);
    setMenuOpen((value) => !value);
  } }, (0, import_react10.createElement)(IconPersonalizationOutline16)), (0, import_react10.createElement)("button", { className: "wcm-iconBtn", title: t("addCategory"), "aria-label": t("addCategory"), onClick: () => setAddCategoryOpen(true) }, (0, import_react10.createElement)(IconPlusOutline16)), api.canPickDirectory() ? (0, import_react10.createElement)("button", { className: "wcm-iconBtn", title: t("addWorkspace"), "aria-label": t("addWorkspace"), onClick: openAddWorkspace }, (0, import_react10.createElement)(IconProjectAddOutline16)) : null, menuOpen ? (0, import_react10.createElement)("div", { className: "wcm-menuWrap" }, (0, import_react10.createElement)("div", { className: "wcm-menuMask", onClick: () => setMenuOpen(false) }), (0, import_react10.createElement)("div", { className: "wcm-menu" }, (0, import_react10.createElement)("div", { className: "wcm-menuLabel" }, t("orderByLabel")), sortItem("manual", t("orderManual")), sortItem("updated", t("orderUpdated")))) : null);
  const errorDialog = addError ? (0, import_react10.createElement)(Dialog, { title: t("addWorkspaceError"), close: () => setAddError(null) }, (0, import_react10.createElement)("p", { className: "wcm-muted" }, addError), (0, import_react10.createElement)("div", { className: "wcm-actions" }, (0, import_react10.createElement)("button", { onClick: () => setAddError(null) }, t("close")), (0, import_react10.createElement)("button", { className: "wcm-primary", onClick: () => {
    setAddError(null);
    openAddWorkspace();
  } }, t("retry")))) : null;
  const renameDialog = renameTarget !== null ? (0, import_react10.createElement)(Dialog, { title: renameTarget.kind === "workspace" ? t("renameWorkspaceTitle") : t("renameSessionTitle"), close: () => {
    if (!renameBusy) setRenameTarget(null);
  } }, (0, import_react10.createElement)("input", { className: "wcm-renameInput", value: renameDraft, disabled: renameBusy, placeholder: t("rename"), onChange: (event) => setRenameDraft(event.target.value), onKeyDown: (event) => {
    if (event.key === "Enter") confirmRename();
  } }), renameError !== "" ? (0, import_react10.createElement)("p", { className: "wcm-error" }, renameError) : null, (0, import_react10.createElement)("div", { className: "wcm-actions" }, (0, import_react10.createElement)("button", { onClick: () => setRenameTarget(null), disabled: renameBusy }, t("cancel")), (0, import_react10.createElement)("button", { className: "wcm-primary", onClick: confirmRename, disabled: renameBusy || renameDraft.trim() === "" }, t("save")))) : null;
  const deleteDialog = deleteTarget !== null ? (0, import_react10.createElement)(Dialog, { title: t("deleteWorkspace"), close: () => {
    if (!deleteBusy) setDeleteTarget(null);
  } }, (0, import_react10.createElement)("p", { className: "wcm-muted" }, t("deleteWorkspaceText", { name: deleteTarget.label })), deleteError !== "" ? (0, import_react10.createElement)("p", { className: "wcm-error" }, deleteError) : null, (0, import_react10.createElement)("div", { className: "wcm-actions" }, (0, import_react10.createElement)("button", { onClick: () => setDeleteTarget(null), disabled: deleteBusy }, t("cancel")), (0, import_react10.createElement)("button", { className: "wcm-danger", onClick: confirmDelete, disabled: deleteBusy }, t("confirm")))) : null;
  const dissolveDialog = dissolveTarget !== null ? (0, import_react10.createElement)(Dialog, { title: t("dissolveCategory"), close: () => {
    if (!dissolveBusy) setDissolveTarget(null);
  } }, (0, import_react10.createElement)("p", { className: "wcm-muted" }, t("dissolveCategoryText", { name: dissolveTarget.name })), dissolveError !== "" ? (0, import_react10.createElement)("p", { className: "wcm-error" }, dissolveError) : null, (0, import_react10.createElement)("div", { className: "wcm-actions" }, (0, import_react10.createElement)("button", { onClick: () => setDissolveTarget(null), disabled: dissolveBusy }, t("cancel")), (0, import_react10.createElement)("button", { className: "wcm-danger", onClick: confirmDissolve, disabled: dissolveBusy }, t("confirm")))) : null;
  const addCategoryDialog = addCategoryOpen ? (0, import_react10.createElement)(Dialog, { title: t("addCategory"), close: () => setAddCategoryOpen(false) }, (0, import_react10.createElement)(CategoryForm, { initial: { id: "", name: "", color: "#4f8cff" }, lockedId: false, cancel: () => setAddCategoryOpen(false), save: (category) => {
    if (config.categories.some((item) => item.id === category.id)) {
      setFailure(t("categoryIdExists"));
      return;
    }
    scope.set("categories", [...config.categories, category]).catch((reason) => {
      setFailure(errText2(reason));
    });
    setAddCategoryOpen(false);
  } })) : null;
  const addWorkspaceDialog = addOpen ? (0, import_react10.createElement)(Dialog, { title: t("addWorkspace"), close: () => {
    if (!addBusy) setAddOpen(false);
  } }, (0, import_react10.createElement)("label", { className: "wcm-form-field" }, t("chooseGroup"), (0, import_react10.createElement)("select", { className: "wcm-select wcm-selectFull", value: addDraft.group, disabled: addBusy, onChange: (event) => setAddDraft((draft) => ({ ...draft, group: event.target.value })) }, config.categories.map((category) => (0, import_react10.createElement)("option", { key: category.id, value: category.id }, category.name)), (0, import_react10.createElement)("option", { value: "" }, t("uncategorized")))), (0, import_react10.createElement)("label", { className: "wcm-form-field" }, t("chooseDirectory"), (0, import_react10.createElement)("div", { className: "wcm-dirRow" }, (0, import_react10.createElement)("input", { className: "wcm-dirInput", value: addDraft.path, readOnly: true, placeholder: t("directoryPlaceholder") }), (0, import_react10.createElement)("button", { type: "button", disabled: addBusy, onClick: browseDirectory }, t("browse")))), addFormError !== "" ? (0, import_react10.createElement)("p", { className: "wcm-error" }, addFormError) : null, (0, import_react10.createElement)("div", { className: "wcm-gap" }), (0, import_react10.createElement)("div", { className: "wcm-actions" }, (0, import_react10.createElement)("button", { disabled: addBusy, onClick: () => setAddOpen(false) }, t("cancel")), (0, import_react10.createElement)("button", { className: "wcm-primary", disabled: addBusy || addDraft.path.trim() === "", onClick: saveAddWorkspace }, t("save")))) : null;
  const root = (0, import_react10.createElement)("div", { className: `wcm-sidebar${wide ? "" : " wcm-sidebarRail"}` }, (0, import_react10.createElement)("div", { className: "wcm-sidebarHead" }, (0, import_react10.createElement)("span", null, t("workspaceTitle")), wide ? headerActions : null), failure ? (0, import_react10.createElement)("p", { className: "wcm-error" }, failure) : null, (0, import_react10.createElement)("div", { className: "wcm-folders" }, folders.map(folder)), errorDialog, addWorkspaceDialog, renameDialog, deleteDialog, dissolveDialog, addCategoryDialog);
  return root;
}

// src/client/index.ts
if (typeof document !== "undefined") {
  const tagId = "dsh-workspace-category-manager/styles.css";
  if (document.querySelector(`style[data-plugin-css="${tagId}"]`) === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-workspace-category-manager";
    tag.dataset.pluginCss = tagId;
    tag.textContent = styles_default;
    document.head.appendChild(tag);
  }
}
var zh = { title: "\u5DE5\u4F5C\u533A\u5206\u7C7B", intro: "\u521B\u5EFA\u5206\u7C7B\u5E76\u628A\u5DE6\u4FA7\u5DE5\u4F5C\u533A\u4E2D\u7684\u9879\u76EE\u5F52\u5165\u5206\u7C7B\u3002\u5206\u7C7B\u4F1A\u7ACB\u5373\u663E\u793A\u5728\u5DE5\u4F5C\u533A\u5217\u8868\u4E2D\u3002", nonDestructive: "\u5206\u7C7B\u53EA\u4FDD\u5B58\u201C\u5DE5\u4F5C\u533A ID \u2192 \u5206\u7C7B\u201D\u5173\u7CFB\uFF1A\u4E0D\u4F1A\u79FB\u52A8\u3001\u91CD\u547D\u540D\u6216\u5220\u9664\u78C1\u76D8\u4E0A\u7684\u9879\u76EE\u76EE\u5F55\u3002", categoryTitle: "\u5206\u7C7B\u76EE\u5F55", workspaceTitle: "\u5DE5\u4F5C\u533A", addWorkspace: "\u6DFB\u52A0\u5DE5\u4F5C\u533A", chooseGroup: "\u9009\u62E9\u5206\u7EC4", chooseDirectory: "\u9879\u76EE\u76EE\u5F55", directoryPlaceholder: "\u70B9\u51FB\u201C\u6D4F\u89C8\u201D\u9009\u62E9\u76EE\u5F55", browse: "\u6D4F\u89C8", noCategoriesHint: "\u8FD8\u6CA1\u6709\u5206\u7C7B\uFF0C\u53EF\u76F4\u63A5\u4EE5\u201C\u672A\u5206\u7C7B\u201D\u521B\u5EFA\uFF0C\u7A0D\u540E\u5728\u8BBE\u7F6E\u4E2D\u5F52\u7EC4\u3002", addCategory: "\u65B0\u589E\u5206\u7C7B", editCategory: "\u7F16\u8F91\u5206\u7C7B", removeCategory: "\u5220\u9664\u5206\u7C7B", emptyCategories: "\u5C1A\u672A\u521B\u5EFA\u5206\u7C7B\u3002\u672A\u5206\u7C7B\u9879\u76EE\u4F1A\u76F4\u63A5\u663E\u793A\u5728\u4FA7\u680F\u4E2D\u3002", emptyWorkspaces: "\u6CA1\u6709\u5DF2\u6CE8\u518C\u7684\u5DE5\u4F5C\u533A\u3002\u8BF7\u4ECE\u5DE6\u4FA7\u5DE5\u4F5C\u533A\u533A\u57DF\u6DFB\u52A0\u9879\u76EE\u3002", uncategorized: "\u672A\u5206\u7C7B", all: "\u5168\u90E8", newSession: "\u65B0\u4F1A\u8BDD", emptyFiltered: "\u8BE5\u5206\u7C7B\u4E0B\u6682\u65E0\u9879\u76EE\u3002", viewOptions: "\u89C6\u56FE\u9009\u9879", orderByLabel: "\u6392\u5E8F\u65B9\u5F0F", orderManual: "\u624B\u52A8\u6392\u5E8F", orderUpdated: "\u6700\u8FD1\u66F4\u65B0", close: "\u5173\u95ED", retry: "\u91CD\u8BD5", addWorkspaceError: "\u6DFB\u52A0\u5DE5\u4F5C\u533A\u5931\u8D25", rename: "\u91CD\u547D\u540D", renameWorkspaceTitle: "\u91CD\u547D\u540D\u5DE5\u4F5C\u533A", renameSessionTitle: "\u91CD\u547D\u540D\u4F1A\u8BDD", fork: "\u5206\u53C9\u4F1A\u8BDD", archive: "\u5F52\u6863\u4F1A\u8BDD", deleteWorkspace: "\u5220\u9664\u5DE5\u4F5C\u533A", deleteWorkspaceText: "\u5C06\u628A\u201C{name}\u201D\u4ECE\u5DE5\u4F5C\u533A\u5217\u8868\u4E2D\u79FB\u9664\u3002\u6587\u4EF6\u5939\u4E0E\u4F1A\u8BDD\u8BB0\u5F55\u4F1A\u4FDD\u7559\uFF0C\u5176\u4F1A\u8BDD\u5C06\u663E\u793A\u5728\u201C\u672A\u5206\u7C7B\u201D\u4E0B\u3002", workspaceMenu: "\u5DE5\u4F5C\u533A\u64CD\u4F5C", sessionMenu: "\u4F1A\u8BDD\u64CD\u4F5C", dissolveCategory: "\u89E3\u6563\u5206\u7C7B", dissolveCategoryText: "\u786E\u5B9A\u89E3\u6563\u5206\u7C7B\u201C{name}\u201D\u5417\uFF1F\u8BE5\u5206\u7C7B\u4E0B\u7684\u6240\u6709\u9879\u76EE\u5C06\u8FDB\u5165\u672A\u5206\u7C7B\u3002", categoryIdExists: "\u5206\u7C7B\u6807\u8BC6\u7B26\u5DF2\u5B58\u5728\u3002", cancel: "\u53D6\u6D88", save: "\u4FDD\u5B58", confirm: "\u786E\u8BA4", edit: "\u7F16\u8F91", remove: "\u5220\u9664", loading: "\u6B63\u5728\u8BFB\u53D6\u8BBE\u7F6E\u2026", unavailable: "\u5F53\u524D\u90E8\u7F72\u672A\u63D0\u4F9B\u53EF\u7F16\u8F91\u7684\u5206\u7C7B\u8BBE\u7F6E\u3002", assignedCount: "{count} \u4E2A\u9879\u76EE", removeConfirm: "\u786E\u5B9A\u5220\u9664\u201C{name}\u201D\u5417\uFF1F\u8BE5\u5206\u7C7B\u4E0B\u7684\u9879\u76EE\u5C06\u6062\u590D\u4E3A\u672A\u5206\u7C7B\u3002" };
var en = { title: "Workspace categories", intro: "Create categories and assign the projects in the left workspace list. Categories are reflected in the sidebar immediately.", nonDestructive: "Categories store only a workspace-ID-to-category mapping. Project directories are never moved, renamed, or deleted.", categoryTitle: "Categories", workspaceTitle: "Workspaces", addWorkspace: "Add workspace", chooseGroup: "Choose a category", chooseDirectory: "Project directory", directoryPlaceholder: "Click \u201CBrowse\u201D to choose a directory", browse: "Browse", noCategoriesHint: "No categories yet \u2014 create it as Uncategorized and organize it later in Settings.", addCategory: "Add category", editCategory: "Edit category", removeCategory: "Remove category", emptyCategories: "No categories yet. Uncategorized projects appear directly in the sidebar.", emptyWorkspaces: "No registered workspaces. Add a project from the left workspace area.", uncategorized: "Uncategorized", all: "All", newSession: "New Session", emptyFiltered: "No projects in this category.", viewOptions: "View options", orderByLabel: "Sort by", orderManual: "Manual", orderUpdated: "Recently updated", close: "Close", retry: "Retry", addWorkspaceError: "Failed to add workspace", rename: "Rename", renameWorkspaceTitle: "Rename workspace", renameSessionTitle: "Rename session", fork: "Fork session", archive: "Archive session", deleteWorkspace: "Delete workspace", deleteWorkspaceText: "This removes \u201C{name}\u201D from the workspace list. The folder and session logs will be kept. Its sessions will appear under Uncategorized.", workspaceMenu: "Workspace actions", sessionMenu: "Session actions", dissolveCategory: "Dissolve category", dissolveCategoryText: "Dissolve category \u201C{name}\u201D? All its projects will move to Uncategorized.", categoryIdExists: "Category id already exists.", cancel: "Cancel", save: "Save", confirm: "Confirm", edit: "Edit", remove: "Remove", loading: "Loading settings\u2026", unavailable: "This deployment does not expose editable category settings.", assignedCount: "{count} project(s)", removeConfirm: "Remove \u201C{name}\u201D? Its projects will become uncategorized." };
var inject = ["slots", "locale", "settingsScope", "workspaces", "sessions"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "workspace-category-manager: dictionaries");
  const t = ctx.locale.bind(NS);
  const api = createDshApi(ctx);
  ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "workspace-categories", order: 16, label: () => t("title"), locale: NS, inject: () => ({ api, t }) }, CategorySection));
  ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({ name: "sidebar.workspaces", priority: -1, locale: NS, inject: () => ({ api, t }) }, CategorySidebar));
}
return module.exports; } });
