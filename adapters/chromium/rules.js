export const settingsKey = "layscope.autoLoadSettings";
export const ruleLimit = 50;

export function parsePattern(value) {
  if (typeof value !== "string" || value.length > 2048 || !value.trim()) {
    throw new Error("请输入完整的 http:// 或 https:// 页面地址。");
  }
  const input = value.trim();
  if (!/^https?:\/\//i.test(input)) throw new Error("请输入以 http:// 或 https:// 开头的完整地址。");
  let url;
  try { url = new URL(input); }
  catch { throw new Error("地址无效，请输入完整的 http:// 或 https:// 地址。"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hostname.includes("*")) {
    throw new Error("仅支持 HTTP / HTTPS 的具体主机，通配符 * 只能放在路径中。");
  }
  if (input.includes("?") || input.includes("#")) {
    throw new Error("规则请只填写主机和路径；匹配时会忽略查询参数和 # 片段。");
  }
  return {
    pattern: `${url.origin}${url.pathname}`,
    origin: url.origin,
    // Browser host grants cover every port; the rule itself still checks the exact origin.
    permission: `${url.protocol}//${url.hostname}/*`,
    path: url.pathname,
  };
}

export function pageAddress(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("此页面无法加载检查器，请切换到普通网页。");
  return `${url.origin}${url.pathname}`;
}

export function matchesPattern(pattern, address) {
  const rule = parsePattern(pattern);
  let url;
  try { url = new URL(address); }
  catch { return false; }
  if (url.origin !== rule.origin) return false;
  const escaped = rule.path.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${escaped}$`).test(url.pathname);
}

// One strict format under the LayScope settings namespace; no legacy migration.
export function readSettings(value) {
  if (value === undefined) return {version: 2, rules: []};
  if (!value || value.version !== 2 || !Array.isArray(value.rules) || value.rules.length > ruleLimit) {
    throw new Error("自动加载设置格式不受支持，未覆盖原有配置。");
  }
  const ids = new Set();
  const patterns = new Set();
  const rules = value.rules.map(rule => {
    if (!rule || typeof rule.id !== "string" || !rule.id || typeof rule.enabled !== "boolean" ||
        typeof rule.defaultLayoutVisible !== "boolean") {
      throw new Error("自动加载规则损坏，未覆盖原有配置。");
    }
    const {pattern} = parsePattern(rule.pattern);
    if (pattern !== rule.pattern || ids.has(rule.id) || patterns.has(pattern)) {
      throw new Error("自动加载规则重复或格式不正确，未覆盖原有配置。");
    }
    ids.add(rule.id);
    patterns.add(pattern);
    return {id: rule.id, pattern, enabled: rule.enabled, defaultLayoutVisible: rule.defaultLayoutVisible};
  });
  return {version: 2, rules};
}

export function resolveRule(rules, address) {
  const matches = rules.filter(rule => rule.enabled && matchesPattern(rule.pattern, address));
  const rank = rule => {
    const path = parsePattern(rule.pattern).path;
    const wildcards = path.split("*").length - 1;
    return {exact: wildcards === 0, literals: path.length - wildcards, wildcards};
  };
  return matches.sort((a, b) => {
    const left = rank(a), right = rank(b);
    if (left.exact !== right.exact) return Number(right.exact) - Number(left.exact);
    if (left.literals !== right.literals) return right.literals - left.literals;
    if (left.wildcards !== right.wildcards) return left.wildcards - right.wildcards;
    if (a.pattern < b.pattern) return -1;
    if (a.pattern > b.pattern) return 1;
    return 0;
  })[0];
}

export function changeRules(settings, command, createId = () => crypto.randomUUID()) {
  const current = readSettings(settings);
  if (command.action === "add") {
    const {pattern} = parsePattern(command.pattern);
    if (current.rules.some(rule => rule.pattern === pattern)) throw new Error("这条规则已存在，可在列表中启用。");
    if (current.rules.length >= ruleLimit) throw new Error(`最多保存 ${ruleLimit} 条规则，请先删除不再使用的规则。`);
    // New rules start quiet; preferences are changed explicitly after creation.
    current.rules.push({id: createId(), pattern, enabled: true, defaultLayoutVisible: false});
  } else {
    const rule = current.rules.find(item => item.id === command.id);
    if (!rule) throw new Error("规则已变化，请刷新规则后重试。");
    if (command.action === "toggle" && typeof command.enabled === "boolean") rule.enabled = command.enabled;
    else if (command.action === "set-default-layout" && typeof command.defaultLayoutVisible === "boolean") {
      rule.defaultLayoutVisible = command.defaultLayoutVisible;
    } else if (command.action === "remove") current.rules = current.rules.filter(item => item.id !== command.id);
    else throw new Error("不支持的规则操作。");
  }
  return current;
}
