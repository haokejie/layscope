// Capture the document identity before executing the page-owned core in MAIN.
export function inspectPage() {
  return {url: location.href, ready: document.readyState === "complete"};
}

export async function executeCore(api, core, tabId, command, options = {}) {
  const [snapshot] = await api.scripting.executeScript({target: {tabId}, world: "ISOLATED", func: inspectPage});
  if (!snapshot?.documentId || !snapshot.result) throw new Error("浏览器未返回页面标识，请使用 Chrome / Edge 106 或更高版本。");
  const [injection] = await api.scripting.executeScript({target: {tabId, documentIds: [snapshot.documentId]}, world: "MAIN", func: core, args: [command, options]});
  if (!injection?.result) throw new Error("页面未返回检查器状态。");
  return injection.result;
}
