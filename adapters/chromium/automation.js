import {pageAddress, parsePattern, resolveRule} from "./rules.js";
import {loadSettings} from "./settings-store.js";
import {inspectPage} from "./page-command.js";

export const visitKey = tabId => `layscope.autoLoadVisit:${tabId}`;
export const errorKey = tabId => `layscope.autoLoadError:${tabId}`;

// The background worker serializes calls. Session storage survives worker suspension,
// so closing/removing the inspector is respected until the document or path changes.
export async function loadAutomatically(api, autoLoadInspector, tabId, address, force = false) {
  const {rules} = await loadSettings(api);
  const rule = resolveRule(rules, address);
  if (!rule) {
    await api.storage.session.remove(visitKey(tabId));
    return {state: "unmatched"};
  }
  const {permission} = parsePattern(rule.pattern);
  if (!await api.permissions.contains({origins: [permission]})) return {state: "permission-required"};
  const [snapshot] = await api.scripting.executeScript({target: {tabId}, world: "ISOLATED", func: inspectPage});
  if (!snapshot?.documentId || !snapshot.result) throw new Error("浏览器未返回页面标识，请使用 Chrome / Edge 106 或更高版本。");
  const {documentId, result} = snapshot;
  if (!result.ready || result.url !== address) return {state: "skipped"};
  const path = pageAddress(result.url);
  const key = visitKey(tabId);
  const previous = (await api.storage.session.get(key))[key];
  if (!force && previous?.documentId === documentId && previous.path === path) return {state: "visited"};
  const [injection] = await api.scripting.executeScript({
    target: {tabId, documentIds: [documentId]}, world: "MAIN", func: autoLoadInspector, args: [result.url, rule.defaultLayoutVisible],
  });
  if (!injection?.result) throw new Error("自动加载没有返回检查器状态。");
  if (injection.result.state !== "skipped") {
    await api.storage.session.set({[key]: {documentId, path}});
    await api.storage.session.remove(errorKey(tabId));
  }
  return injection.result;
}
