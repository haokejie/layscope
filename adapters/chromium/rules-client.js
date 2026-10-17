import {readSettings} from "./rules.js";

export async function requestRules(api, command, expectedVersion) {
  if (typeof expectedVersion !== "string" || !expectedVersion) throw new Error("Expected core version is required.");
  const manifest = api.runtime.getManifest();
  if (!manifest.background?.service_worker) {
    const error = new Error("更新扩展后可开启自动加载。");
    error.code = "EXTENSION_RELOAD_REQUIRED";
    throw error;
  }
  if (manifest.version !== expectedVersion) {
    const error = new Error("浏览器仍使用旧扩展配置，请更新扩展后再刷新页面。");
    error.code = "EXTENSION_RELOAD_REQUIRED";
    throw error;
  }
  let response;
  try { response = await api.runtime.sendMessage({type: "layscope-rules", ...command}); }
  catch (error) {
    if (error.message?.includes("Receiving end does not exist") || error.message?.includes("Could not establish connection")) {
      const unavailable = new Error("自动加载后台未连接，请更新扩展。");
      unavailable.code = "EXTENSION_RELOAD_REQUIRED";
      throw unavailable;
    }
    if (error.message?.includes("Extension context invalidated")) {
      throw new Error("扩展已经更新或重新加载，请关闭并重新打开扩展界面。");
    }
    throw error;
  }
  if (!response?.ok) throw new Error(response?.error ?? "扩展后台未返回规则状态，请重新加载扩展后再打开管理界面。");
  if (response.settingsVersion !== 2) {
    const error = new Error("自动加载后台版本较旧，请更新扩展。");
    error.code = "EXTENSION_RELOAD_REQUIRED";
    throw error;
  }
  if (response.coreVersion !== expectedVersion) {
    const error = new Error("自动加载后台仍使用旧核心，请更新扩展后再刷新页面。");
    error.code = "EXTENSION_RELOAD_REQUIRED";
    throw error;
  }
  readSettings({version: response.settingsVersion, rules: response.rules});
  if (response.rules.some(rule => typeof rule.granted !== "boolean")) throw new Error("后台返回的主机授权状态无效。");
  return response;
}
