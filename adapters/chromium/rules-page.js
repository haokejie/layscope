import {parsePattern,ruleLimit,settingsKey} from "./rules.js";
import {requestRules} from "./rules-client.js";
import {version} from "./version.js";
const byId = id => document.getElementById(id);
let rules = [];
let ready = false;
let busy = false;
let deleting;
let needsReload = false;
let controlFocus;

function message(id,text) {
  byId(id).textContent = text ?? "";
  byId(id).hidden = !text;
}
function fault(error) {
  needsReload = error.code === "EXTENSION_RELOAD_REQUIRED";
  if (needsReload) for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
  byId("settings-error").textContent = error.message;
  byId("settings-fault").hidden = false;
  byId("reload-extension").hidden = !needsReload;
  byId("retry").hidden = needsReload;
}
function render() {
  const active = document.activeElement;
  if (byId("rule-list").contains(active)) controlFocus = active.getAttribute("aria-label");
  const query = byId("search").value.trim().toLowerCase();
  const filter = byId("filter").value;
  const visible = rules.filter(rule => {
    if (!rule.pattern.toLowerCase().includes(query)) return false;
    if (filter === "enabled") return rule.enabled;
    if (filter === "disabled") return !rule.enabled;
    if (filter === "ungranted") return rule.enabled && !rule.granted;
    return true;
  });
  byId("rule-count").textContent = ready ? `共 ${rules.length} 条规则` : "设置未连接";
  if (ready && visible.length !== rules.length) byId("rule-count").textContent = `${visible.length} / ${rules.length} 条规则`;
  byId("rule-list").replaceChildren(...visible.map(renderRule));
  byId("empty").hidden = !ready || visible.length > 0;
  byId("empty").textContent = rules.length ? "没有符合条件的规则。" : "还没有页面规则，点击“添加规则”开始。";
  for (const id of ["add-rule","save-rule","confirm-delete"]) byId(id).disabled = busy || !ready || needsReload;
  for (const id of ["cancel-add","cancel-delete","retry","reload-extension"]) byId(id).disabled = busy;
  byId("pattern").disabled = busy;
  if (!busy && controlFocus && !document.querySelector("dialog[open]")) {
    const control = [...byId("rule-list").querySelectorAll("[aria-label]")].find(item => item.getAttribute("aria-label") === controlFocus);
    control?.focus();
    controlFocus = undefined;
  }
}
function renderRule(rule) {
  const row = document.createElement("tr");
  const info = document.createElement("td");
  const pattern = document.createElement("p");
  pattern.className = "rule-pattern";
  pattern.textContent = rule.pattern;
  const kind = document.createElement("span");
  kind.className = "rule-kind";
  kind.textContent = rule.pattern.includes("*") ? "路径规则" : "精确页面";
  info.append(pattern,kind);
  function toggleCell(label,checked,action) {
    const cell = document.createElement("td");
    cell.dataset.label = label;
    const control = document.createElement("input");
    control.type = "checkbox";
    control.role = "switch";
    control.className = "switch";
    control.checked = checked;
    control.disabled = busy || needsReload;
    control.setAttribute("aria-label",`${label} ${rule.pattern}`);
    control.addEventListener("change",() => action(control.checked));
    cell.append(control);
    return cell;
  }
  const enabled = toggleCell("自动加载",rule.enabled,value => {
    if (value) enableRule(rule);
    else run(() => update({action:"toggle",id:rule.id,enabled:false}));
  });
  const status = document.createElement("span");
  status.className = "rule-state";
  if (!rule.enabled) status.textContent = "已停用";
  else if (!rule.granted) { status.textContent = "需授权"; status.dataset.warning = "true"; }
  enabled.append(status);
  const defaults = toggleCell("默认布局",rule.defaultLayoutVisible,value => run(() => update({action:"set-default-layout",id:rule.id,defaultLayoutVisible:value})));
  const actions = document.createElement("td");
  const buttons = document.createElement("div");
  buttons.className = "row-actions";
  if (rule.enabled && !rule.granted) {
    const grant = document.createElement("button");
    grant.type = "button";
    grant.className = "text-button";
    grant.textContent = "授权";
    grant.setAttribute("aria-label",`授权 ${rule.pattern}`);
    grant.disabled = busy || needsReload;
    grant.addEventListener("click",() => enableRule(rule));
    buttons.append(grant);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-button";
  remove.textContent = "删除";
  remove.setAttribute("aria-label",`删除 ${rule.pattern}`);
  remove.disabled = busy || needsReload;
  remove.addEventListener("click",() => {
    deleting = rule.id;
    byId("delete-pattern").textContent = rule.pattern;
    message("delete-error");
    byId("delete-dialog").showModal();
  });
  buttons.append(remove);
  actions.append(buttons);
  row.append(info,enabled,defaults,actions);
  return row;
}
async function update(command = {action:"list"}) {
  // No business tab id: managing the list saves settings without injecting a page.
  const response = await requestRules(chrome,command,version);
  rules = response.rules;
  ready = true;
  needsReload = false;
  byId("settings-fault").hidden = true;
  if (response.permissionError) fault(new Error(response.permissionError));
}
async function run(action,errorTarget) {
  if (busy) return;
  busy = true;
  render();
  try { await action(); }
  catch (error) {
    if (errorTarget && error.code !== "EXTENSION_RELOAD_REQUIRED") message(errorTarget,error.message);
    else fault(error);
  } finally { busy = false; render(); }
}
function enableRule(rule) {
  if (busy) return;
  const granted = chrome.permissions.request({origins:[parsePattern(rule.pattern).permission]});
  run(async () => {
    if (!await granted) throw new Error("未授权，规则未启用。");
    await update({action:"toggle",id:rule.id,enabled:true});
  });
}
byId("add-rule").addEventListener("click",() => {
  byId("rule-form").reset();
  byId("pattern").removeAttribute("aria-invalid");
  message("form-error");
  byId("add-dialog").showModal();
  byId("pattern").focus();
});
byId("cancel-add").addEventListener("click",() => byId("add-dialog").close());
byId("cancel-delete").addEventListener("click",() => byId("delete-dialog").close());
for (const id of ["add-dialog","delete-dialog"]) byId(id).addEventListener("cancel",event => { if (busy) event.preventDefault(); });
byId("pattern").addEventListener("input",() => { message("form-error"); byId("pattern").removeAttribute("aria-invalid"); });
byId("rule-form").addEventListener("submit",event => {
  event.preventDefault();
  if (busy) return;
  let pattern;
  try {
    pattern = parsePattern(byId("pattern").value).pattern;
    if (rules.some(rule => rule.pattern === pattern)) throw new Error("这条规则已存在，请在列表中管理。");
    if (rules.length >= ruleLimit) throw new Error(`最多保存 ${ruleLimit} 条规则。`);
  } catch (error) {
    message("form-error",error.message);
    byId("pattern").setAttribute("aria-invalid","true");
    byId("pattern").focus();
    return;
  }
  const granted = chrome.permissions.request({origins:[parsePattern(pattern).permission]});
  run(async () => {
    if (!await granted) throw new Error("未授权，规则未添加。");
    await update({action:"add",pattern});
    byId("add-dialog").close();
  },"form-error");
});
byId("confirm-delete").addEventListener("click",() => run(async () => {
  await update({action:"remove",id:deleting});
  byId("delete-dialog").close();
  deleting = undefined;
},"delete-error"));
byId("search").addEventListener("input",render);
byId("filter").addEventListener("change",render);
byId("retry").addEventListener("click",() => run(() => update()));
byId("reload-extension").addEventListener("click",() => chrome.runtime.reload());
window.addEventListener("focus",() => { if (!busy) run(() => update()); });
if (chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area === "local" && settingsKey in changes && !busy) run(() => update());
  });
}
await run(() => update());
