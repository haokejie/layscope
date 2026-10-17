import {layScope} from "./core.js";
import {pageAddress, parsePattern} from "./rules.js";
import {pageRuleContext} from "./popup-model.js";
import {version} from "./version.js";
import {requestRules} from "./rules-client.js";
import {executeCore} from "./page-command.js";

const byId = id => document.getElementById(id);
let tab;
let address;
let state = "unknown";
let live;
let legacyCore = false;
let rules = [];
let settingsReady = false;
let settingsFault;
let settingsNeedsReload = false;
let busy = false;

function message(id, value) {
  byId(id).textContent = value ?? "";
  byId(id).hidden = !value;
}
function render() {
  const labels = {unknown:"状态未知", open:"已加载", closed:"已加载", absent:"未加载", unavailable:"不支持此页"};
  const installed = state === "open" || state === "closed";
  byId("state").textContent = legacyCore ? "需更新" : labels[state];
  byId("state").dataset.state = state;
  byId("state").title = `核心 ${live?.version ?? version}`;
  for (const id of ["panel-visible", "layout-visible"]) byId(id).disabled = busy || !address || state === "unknown" || legacyCore;
  byId("launcher-visible").disabled = busy || !installed || legacyCore;
  if (!busy) {
    byId("panel-visible").checked = installed && live.panelOpen === true;
    byId("layout-visible").checked = installed && live.layoutVisible === true;
    byId("launcher-visible").checked = installed && live.launcherVisible === true;
  }
  byId("launcher-note").textContent = installed ? "按站点记忆" : "加载后可设置";
  byId("remove-inspector").hidden = !installed;
  byId("remove-inspector").disabled = busy;
  byId("legacy-row").hidden = !legacyCore;
  byId("update-instance").disabled = busy;
  const {exact, effective, managed, managedRule} = pageRuleContext(rules, address);
  byId("auto-row").hidden = managed || settingsNeedsReload;
  byId("inherited-row").hidden = !managed || settingsNeedsReload;
  byId("manage-inherited").disabled = busy;
  byId("inherited-status").textContent = effective?.granted ? "由规则管理" : "需授权 · 管理";
  if (!busy) byId("auto-page").checked = Boolean(effective?.granted);
  byId("auto-page").disabled = busy || !address || !settingsReady;
  byId("reload-extension").hidden = !settingsNeedsReload;
  byId("reload-extension").disabled = busy;
  byId("default-row").hidden = !settingsReady || settingsNeedsReload || managed || !exact?.enabled;
  if (!busy) byId("default-layout").checked = exact?.defaultLayoutVisible === true;
  byId("default-layout").disabled = busy || !settingsReady;
  let hint;
  if (managed) {
    hint = `生效规则：${effective.pattern}`;
    if (exact?.enabled) hint = "同时匹配页面与路径规则，请在规则页管理。";
  }
  else if (exact?.enabled && !exact.granted) hint = "主机权限已失效，打开开关可重新授权。";
  if (settingsFault) hint = settingsFault;
  message("auto-note", hint);
  byId("auto-note").title = hint ?? "";
  if (managed && !settingsFault) byId("auto-note").title = `生效规则：${effective.pattern}；覆盖本页的路径规则：${managedRule.pattern}`;
  byId("auto-note").dataset.error = String(Boolean(settingsFault));
  byId("rule-count").textContent = settingsReady ? `${rules.length} 条` : "";
}
async function readPageState(command = "status", options = {}) {
  const next = await executeCore(chrome, layScope, tab.id, command, options);
  const nextState = next?.state;
  if (!["open","closed","absent"].includes(nextState)) throw new Error("无法读取检查器状态。");
  const legacy = nextState !== "absent" && next.version !== version;
  if (!legacy && nextState !== "absent" && ["panelOpen","layoutVisible","launcherVisible","picking"].some(key => typeof next[key] !== "boolean")) {
    throw new Error("检查器状态契约无效，请移除后重试。");
  }
  live = next;
  legacyCore = legacy;
  state = nextState;
  render();
}
async function loadRules(command = {action:"list"}) {
  const response = await requestRules(chrome, {...command,tabId:tab?.id}, version);
  rules = response.rules;
  settingsReady = true;
  settingsNeedsReload = false;
  settingsFault = response.activationError ?? response.permissionError;
  if (response.automaticError?.url === tab?.url) settingsFault = response.automaticError.message;
  render();
}
async function change(command) {
  await loadRules(command);
  if (address) {
    try { await readPageState(); }
    catch (error) { message("page-error",error.message); }
  }
}
async function run(area, action) {
  if (busy) return;
  busy = true;
  if (area === "page") message("page-error");
  else settingsFault = undefined;
  render();
  try { await action(); }
  catch (error) {
    if (area === "page") message("page-error",error.message);
    else {
      settingsFault = error.message;
      if (error.code === "EXTENSION_RELOAD_REQUIRED") settingsNeedsReload = true;
    }
  } finally { busy = false; render(); }
}
byId("panel-visible").addEventListener("change", () => {
  const visible = byId("panel-visible").checked;
  run("page", () => readPageState(visible ? "open" : "close"));
});
byId("layout-visible").addEventListener("change", () => {
  const layoutVisible = byId("layout-visible").checked;
  run("page", () => readPageState(state === "absent" ? "load" : "set-layout", {layoutVisible}));
});
byId("launcher-visible").addEventListener("change", () => {
  const launcherVisible = byId("launcher-visible").checked;
  run("page", () => readPageState("set-launcher",{launcherVisible}));
});
byId("remove-inspector").addEventListener("click", () => run("page", () => readPageState("destroy")));
byId("update-instance").addEventListener("click", () => run("page", async () => {
  const panelOpen = state === "open";
  const initial = {};
  if (typeof live.layoutVisible === "boolean") initial.layoutVisible = live.layoutVisible;
  if (typeof live.launcherVisible === "boolean") initial.launcherVisible = live.launcherVisible;
  await readPageState("destroy");
  await readPageState("load",initial);
  if (panelOpen) await readPageState("open");
}));
byId("auto-page").addEventListener("change", () => {
  const enabled = byId("auto-page").checked;
  const {exact} = pageRuleContext(rules,address);
  if (!enabled) { run("settings", () => change({action:"toggle",id:exact.id,enabled:false})); return; }
  const granted = chrome.permissions.request({origins:[parsePattern(address).permission]});
  run("settings", async () => {
    if (!await granted) throw new Error("未授权，自动加载未开启。");
    if (exact) await change({action:"toggle",id:exact.id,enabled:true});
    else await change({action:"add",pattern:address});
  });
});
byId("default-layout").addEventListener("change", () => {
  const {exact} = pageRuleContext(rules,address);
  const defaultLayoutVisible = byId("default-layout").checked;
  run("settings", () => change({action:"set-default-layout",id:exact.id,defaultLayoutVisible}));
});
for (const id of ["manage-rules","manage-inherited"]) {
  byId(id).addEventListener("click", () => run("page", () => chrome.runtime.openOptionsPage()));
}
byId("reload-extension").addEventListener("click", () => run("settings", async () => {
  if (address && ["open","closed"].includes(state)) await readPageState("destroy");
  chrome.runtime.reload();
}));
try {
  [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.id) throw new Error("找不到当前标签页。");
  address = pageAddress(tab.url);
  const url = new URL(address);
  byId("page-host").textContent = url.host;
  byId("page-host").title = url.origin;
  byId("page-path").textContent = url.pathname;
  byId("page-path").title = url.pathname;
} catch (error) {
  state = "unavailable";
  byId("page-host").textContent = "当前页面不支持检查";
  message("page-error",error.message);
}
if (address) {
  try { await readPageState(); }
  catch (error) { message("page-error",error.message); }
}
try { await loadRules(); }
catch (error) {
  settingsFault = error.message;
  settingsNeedsReload = error.code === "EXTENSION_RELOAD_REQUIRED";
}
render();
