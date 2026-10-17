import {loadAutomatically, errorKey, visitKey} from "./automation.js";
import {changeRules, parsePattern, settingsKey} from "./rules.js";
import {loadSettings} from "./settings-store.js";

export function createBackground(api, autoLoadInspector, coreVersion) {
  if (typeof coreVersion !== "string" || !coreVersion) throw new Error("Background coreVersion is required.");
  const managerPages = new Set(["popup.html", "rules.html"].map(path => api.runtime.getURL(path)));
  let pending = Promise.resolve();
  function enqueue(task) {
    const result = pending.then(task, task);
    pending = result;
    return result;
  }

  async function getModel(tabId) {
    const settings = await loadSettings(api);
    const rules = await Promise.all(settings.rules.map(async rule => ({
      ...rule, granted: await api.permissions.contains({origins: [parsePattern(rule.pattern).permission]}),
    })));
    let automaticError;
    if (Number.isInteger(tabId)) automaticError = (await api.storage.session.get(errorKey(tabId)))[errorKey(tabId)];
    return {coreVersion, settingsVersion: settings.version, rules, automaticError};
  }

  async function handle(message) {
    if (message.action === "list") return getModel(message.tabId);
    const before = await loadSettings(api);
    const after = changeRules(before, message);
    const enabled = after.rules.find(rule => rule.id === message.id);
    if (message.action === "add" || (message.action === "toggle" && enabled?.enabled)) {
      let pattern = message.pattern;
      if (message.action === "toggle") pattern = enabled.pattern;
      if (!await api.permissions.contains({origins: [parsePattern(pattern).permission]})) {
        throw new Error("尚未获得此主机的访问权限，规则未保存。");
      }
    }
    await api.storage.local.set({[settingsKey]: after});
    let permissionError;
    if (message.action === "remove") {
      const removed = before.rules.find(rule => rule.id === message.id);
      const {permission} = parsePattern(removed.pattern);
      if (!after.rules.some(rule => parsePattern(rule.pattern).permission === permission)) {
        try { await api.permissions.remove({origins: [permission]}); }
        catch (error) { permissionError = `规则已删除，撤销主机权限失败：${error.message}`; }
      }
    }
    // Saving is successful even if this tab navigates away or disallows injection.
    // Report the activation error separately instead of claiming the rule wasn't saved.
    let activationError;
    if ((message.action === "add" || (message.action === "toggle" && enabled?.enabled)) && Number.isInteger(message.tabId)) {
      try {
        const tab = await api.tabs.get(message.tabId);
        await loadAutomatically(api, autoLoadInspector, tab.id, tab.url, true);
      }
      catch (error) { activationError = `规则已保存，本页加载失败：${error.message}`; }
    }
    return {...await getModel(message.tabId), activationError, permissionError};
  }

  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== api.runtime.id || !managerPages.has(sender.url) || message?.type !== "layscope-rules") return;
    enqueue(() => handle(message)).then(
      model => respond({ok: true, ...model}),
      error => respond({ok: false, error: error.message}),
    );
    return true;
  });

  api.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (change.status !== "complete" && !change.url) return;
    const address = change.url ?? tab.url;
    if (!address?.startsWith("http://") && !address?.startsWith("https://")) return;
    enqueue(async () => {
      try { await loadAutomatically(api, autoLoadInspector, tabId, address); }
      catch (error) {
        console.error("LayScope 自动加载失败", error);
        await api.storage.session.set({[errorKey(tabId)]: {url: address, message: error.message}});
      }
    }).catch(error => console.error("LayScope 无法保存错误状态", error));
  });

  api.tabs.onRemoved.addListener(tabId => {
    enqueue(() => api.storage.session.remove([visitKey(tabId), errorKey(tabId)])).catch(error => console.error(error));
  });

}
