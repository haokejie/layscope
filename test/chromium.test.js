import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {changeRules, matchesPattern, pageAddress, parsePattern, readSettings, resolveRule, settingsKey} from "../adapters/chromium/rules.js";
import {dispatchAutoLoad} from "../adapters/chromium/auto-command.js";
import {loadAutomatically, visitKey, errorKey} from "../adapters/chromium/automation.js";
import {createBackground} from "../adapters/chromium/background-controller.js";
import {pageRuleContext} from "../adapters/chromium/popup-model.js";
import {loadSettings} from "../adapters/chromium/settings-store.js";
import {requestRules} from "../adapters/chromium/rules-client.js";

const rule = (pattern = "http://127.0.0.1:8083/projects*") => ({id: "project", pattern, enabled: true, defaultLayoutVisible: false});
const settings = rules => ({version: 2, rules});
function mockBrowser(rules = [rule()]) {
  const data = {[settingsKey]: settings(rules)};
  const session = {};
  const grants = new Set(rules.map(item => parsePattern(item.pattern).permission));
  const calls = [];
  let context;
  let documentId;
  const events = {};
  const event = name => ({addListener(fn) { events[name] = fn; }});
  const area = source => ({
    async get(key) { return structuredClone({[key]: source[key]}); },
    async set(values) { Object.assign(source, structuredClone(values)); },
    async remove(keys) { for (const key of [keys].flat()) delete source[key]; },
  });
  function navigate(url, id = "document-1", ready = "complete") {
    if (documentId !== id) {
      context = vm.createContext({location: {href: url}, document: {readyState: ready}, state: "absent", loads: 0, layoutVisible: false});
      vm.runInContext('function fakeCore(command, options) { if (command === "load" && state === "absent") { state = "closed"; loads++; layoutVisible = options.layoutVisible; } return {state, layoutVisible, panelOpen: state === "open", picking: false}; }', context);
    } else {
      context.location.href = url;
      context.document.readyState = ready;
    }
    documentId = id;
  }
  navigate("http://127.0.0.1:8083/projects");
  const auto = vm.runInContext(`(function(expectedURL, defaultLayoutVisible) { return (${dispatchAutoLoad.toString()})(fakeCore, expectedURL, defaultLayoutVisible); })`, context);
  const api = {
    runtime: {id: "test-extension", getURL: path => `chrome-extension://test-extension/${path}`, onMessage: event("message")},
    tabs: {onUpdated: event("updated"), onRemoved: event("removed"), async get(id) { return {id, url: context.location.href}; }},
    storage: {local: area(data), session: area(session)},
    permissions: {
      async contains({origins}) { return origins.every(origin => grants.has(origin)); },
      async remove({origins}) { for (const origin of origins) grants.delete(origin); return true; },
    },
    scripting: {async executeScript({target, func, args = [], world}) {
      calls.push({target, args, world});
      if (target.documentIds && !target.documentIds.includes(documentId)) throw new Error("document no longer exists");
      const result = vm.runInContext(`(${func.toString()})(...${JSON.stringify(args)})`, context);
      return [{documentId, frameId: 0, result: JSON.parse(JSON.stringify(result))}];
    }},
  };
  return {
    api, auto, data, session, grants, calls, navigate, events,
    get page() { return context; },
    message(command, sender = {id: "test-extension", url: "chrome-extension://test-extension/popup.html"}) {
      return new Promise(resolve => events.message({type: "layscope-rules", ...command}, sender, resolve));
    },
  };
}

test("URL rules distinguish origin and port, anchor paths, and escape regexp characters", () => {
  assert.equal(matchesPattern("http://127.0.0.1:8083/projects", "http://127.0.0.1:8083/projects?q=1#x"), true);
  for (const url of ["http://127.0.0.1:8084/projects", "https://127.0.0.1:8083/projects", "http://localhost:8083/projects", "http://127.0.0.1:8083/projects/1"]) {
    assert.equal(matchesPattern("http://127.0.0.1:8083/projects", url), false, url);
  }
  assert.equal(matchesPattern("https://example.com/admin/*", "https://example.com/admin/a/b"), true);
  assert.equal(matchesPattern("https://example.com/a.b+(x)/*", "https://example.com/aXbbbbx/file"), false);
  assert.equal(matchesPattern("https://example.com/a.b+(x)/*", "https://example.com/a.b+(x)/file"), true);
  assert.equal(pageAddress("http://localhost:8083/projects?x=1#x"), "http://localhost:8083/projects");
  assert.equal(parsePattern("http://localhost:8083/*").permission, "http://localhost/*");
});

test("invalid or misleading patterns are rejected instead of broadened", () => {
  for (const value of ["", "example.com/a", "http:example.com", "file:///a", "https://*.example.com/*", "https://user:pass@example.com/a", "https://example.com/a?x=1", "https://example.com/a#x"]) {
    assert.throws(() => parsePattern(value), undefined, value);
  }
});

test("popup identifies a stale manifest, explains a missing background, and preserves other errors", async () => {
  const api = {runtime: {
    getManifest: () => ({}),
    sendMessage: async () => { throw new Error("Could not establish connection. Receiving end does not exist."); },
  }};
  await assert.rejects(requestRules(api, {action: "list"}, "test-core"), {code: "EXTENSION_RELOAD_REQUIRED", message: "更新扩展后可开启自动加载。"});
  api.runtime.getManifest = () => ({version: "test-core", background: {service_worker: "background.js"}});
  await assert.rejects(requestRules(api, {action: "list"}, "test-core"), {code: "EXTENSION_RELOAD_REQUIRED", message: "自动加载后台未连接，请更新扩展。"});
  api.runtime.sendMessage = async () => { throw new Error("Extension context invalidated."); };
  await assert.rejects(requestRules(api, {action: "list"}, "test-core"), /重新打开/);
  api.runtime.sendMessage = async () => ({ok: true, rules: []});
  await assert.rejects(requestRules(api, {action: "list"}, "test-core"), {code: "EXTENSION_RELOAD_REQUIRED", message: "自动加载后台版本较旧，请更新扩展。"});
  api.runtime.sendMessage = async () => { throw new Error("storage unavailable"); };
  await assert.rejects(requestRules(api, {action: "list"}, "test-core"), /storage unavailable/);
});

test("rules preserve settings, reject duplicates and corrupt storage, and allow toggling/deletion", () => {
  assert.deepEqual(readSettings(undefined), settings([]));
  const first = changeRules(undefined, {action: "add", pattern: "https://EXAMPLE.com"}, () => "new");
  assert.equal(first.rules[0].pattern, "https://example.com/");
  assert.throws(() => changeRules(first, {action: "add", pattern: "https://example.com/"}), /已存在/);
  const disabled = changeRules(first, {action: "toggle", id: "new", enabled: false});
  assert.equal(first.rules[0].enabled, true);
  assert.equal(disabled.rules[0].enabled, false);
  assert.deepEqual(changeRules(first, {action: "remove", id: "new"}), settings([]));
  assert.throws(() => changeRules(first, {action: "toggle", id: "missing", enabled: true}));
  for (const invalid of [null, {version: 3, rules: []}, settings([{...rule(), enabled: "yes"}]), settings([rule(), rule()])]) {
    assert.throws(() => readSettings(invalid));
  }
});

test("popup checks installed metadata and the actual automatic core, even when the settings schema matches", async () => {
  const browser = mockBrowser();
  createBackground(browser.api, browser.auto, "new-core");
  browser.api.runtime.getManifest = () => ({version: "new-core", background: {service_worker: "background.js"}});
  browser.api.runtime.sendMessage = message => browser.message(message);
  const model = await requestRules(browser.api, {action: "list"}, "new-core");
  assert.equal(model.coreVersion, "new-core");
  browser.api.runtime.getManifest = () => ({version: "old-core", background: {service_worker: "background.js"}});
  await assert.rejects(requestRules(browser.api, {action: "list"}, "new-core"), {code: "EXTENSION_RELOAD_REQUIRED"});
  browser.api.runtime.getManifest = () => ({version: "new-core", background: {service_worker: "background.js"}});
  for (const coreVersion of [undefined, "old-core"]) {
    browser.api.runtime.sendMessage = async () => ({ok: true, settingsVersion: 2, coreVersion, rules: []});
    await assert.rejects(requestRules(browser.api, {action: "list"}, "new-core"), {code: "EXTENSION_RELOAD_REQUIRED", message: "自动加载后台仍使用旧核心，请更新扩展后再刷新页面。"});
  }
});

test("unmatched, disabled and ungranted pages execute no script", async () => {
  for (const rules of [[rule("https://elsewhere.test/*")], [{...rule(), enabled: false}], [rule()]]) {
    const browser = mockBrowser(rules);
    if (rules[0].enabled && rules[0].pattern === rule().pattern) browser.grants.clear();
    await loadAutomatically(browser.api, browser.auto, 7, browser.page.location.href);
    assert.equal(browser.calls.length, 0);
  }
});

test("automatic loads survive worker restart, respect dismissal, and load a new document or path", async () => {
  const browser = mockBrowser();
  const run = () => loadAutomatically(browser.api, browser.auto, 7, browser.page.location.href);
  assert.equal((await run()).state, "closed");
  assert.equal(browser.page.loads, 1);
  assert.equal(browser.calls.at(-1).world, "MAIN");
  browser.page.state = "absent"; // User completely removes the runtime; no marker remains in the page.
  assert.equal((await run()).state, "visited");
  assert.equal(browser.page.loads, 1);
  browser.navigate("http://127.0.0.1:8083/projects?filter=all#table");
  assert.equal((await run()).state, "visited");
  browser.navigate("http://127.0.0.1:8083/projects/2");
  assert.equal((await run()).state, "closed");
  assert.equal(browser.page.loads, 2);
  browser.navigate("http://127.0.0.1:8083/projects", "document-2");
  assert.equal((await run()).state, "closed");
  assert.equal(browser.page.loads, 1);
  assert.deepEqual(browser.calls.at(-1).target, {tabId: 7, documentIds: ["document-2"]});
  browser.page.state = "absent";
  browser.navigate("http://127.0.0.1:8083/profile", "document-2");
  assert.equal((await run()).state, "unmatched");
  browser.navigate("http://127.0.0.1:8083/projects", "document-2");
  assert.equal((await run()).state, "closed");
});

test("loading/navigated pages are skipped; existing closed inspector stays closed", async () => {
  const browser = mockBrowser();
  browser.navigate("http://127.0.0.1:8083/projects", "document-1", "loading");
  assert.equal((await loadAutomatically(browser.api, browser.auto, 7, browser.page.location.href)).state, "skipped");
  assert.equal(browser.session[visitKey(7)], undefined);
  browser.navigate("http://127.0.0.1:8083/projects");
  browser.page.state = "closed";
  assert.equal((await loadAutomatically(browser.api, browser.auto, 7, browser.page.location.href)).state, "closed");
  assert.equal(browser.page.loads, 0);
  assert.equal((await loadAutomatically(browser.api, browser.auto, 8, "http://127.0.0.1:8083/projects/old")).state, "skipped");
});

test("automatic command rechecks actual URL and readiness at the point of injection", () => {
  const browser = mockBrowser();
  const run = expected => vm.runInContext(`(${browser.auto.toString()})(${JSON.stringify(expected)})`, browser.page);
  assert.equal(run("http://127.0.0.1:8083/projects/old").state, "skipped");
  browser.page.document.readyState = "loading";
  assert.equal(run(browser.page.location.href).state, "skipped");
  assert.equal(browser.page.loads, 0);
});

test("worker serializes concurrent edits, shares host grant across ports, and revokes the final grant", async () => {
  const browser = mockBrowser([]);
  browser.grants.add("http://127.0.0.1/*");
  createBackground(browser.api, browser.auto, "test-core");
  const results = await Promise.all([
    browser.message({action: "add", pattern: "http://127.0.0.1:8083/projects"}),
    browser.message({action: "add", pattern: "http://127.0.0.1:8084/*"}),
  ]);
  assert.ok(results.every(result => result.ok));
  let {rules} = await browser.message({action: "list"});
  assert.equal(rules.length, 2);
  await browser.message({action: "remove", id: rules[0].id});
  assert.equal(browser.grants.size, 1);
  await browser.message({action: "remove", id: rules[1].id});
  assert.equal(browser.grants.size, 0);
  assert.equal(browser.data[settingsKey].rules.length, 0);
});

test("worker refuses missing access and displays revoked grants without destroying saved rules", async () => {
  const browser = mockBrowser([]);
  createBackground(browser.api, browser.auto, "test-core");
  const refused = await browser.message({action: "add", pattern: "https://example.com/*"});
  assert.equal(refused.ok, false);
  assert.match(refused.error, /未保存/);
  assert.equal(browser.data[settingsKey].rules.length, 0);
  browser.data[settingsKey] = settings([rule()]);
  const model = await browser.message({action: "list"});
  assert.equal(model.rules[0].granted, false);
  assert.equal(browser.data[settingsKey].rules[0].enabled, true);
  let response = false;
  const accepted = browser.events.message({type: "layscope-rules", action: "list"}, {id: "test-extension", tab: {id: 7}}, () => { response = true; });
  assert.equal(accepted, undefined);
  assert.equal(response, false);
});

test("worker handles URL changes, skips unrelated updates, preserves saved rule if activation fails, and cleans tab bookkeeping", async () => {
  const browser = mockBrowser();
  createBackground(browser.api, browser.auto, "test-core");
  browser.events.updated(7, {title: "new title"}, {url: browser.page.location.href});
  await browser.message({action: "list"});
  assert.equal(browser.calls.length, 0);
  browser.events.updated(7, {status: "complete"}, {url: browser.page.location.href});
  await browser.message({action: "list"});
  assert.equal(browser.page.loads, 1);
  browser.events.removed(7);
  await browser.message({action: "list"});
  assert.equal(browser.session[visitKey(7)], undefined);
  browser.api.tabs.get = async () => { throw new Error("tab closed"); };
  const saved = await browser.message({action: "add", pattern: "http://127.0.0.1:8083/other", tabId: 7});
  assert.equal(saved.ok, true);
  assert.equal(saved.rules.length, 2);
  assert.match(saved.activationError, /规则已保存.*tab closed/);
  browser.session[errorKey(9)] = {message: "test"};
  browser.events.removed(9);
  await browser.message({action: "list"});
  assert.equal(browser.session[errorKey(9)], undefined);
});


test("settings use only the LayScope namespace and never migrate or rewrite unsupported data", async () => {
  const browser = mockBrowser();
  const previous = settings([rule()]);
  browser.data.autoLoadSettings = previous;
  delete browser.data[settingsKey];
  let writes = 0;
  browser.api.storage.local.set = async () => { writes++; };
  assert.deepEqual(await loadSettings(browser.api), settings([]));
  assert.deepEqual(browser.data.autoLoadSettings, previous);
  for (const value of [{version: 1, rules: []}, settings([{id: "bad", pattern: "https://example.com/", enabled: true}]), {version: 9, rules: []}]) {
    browser.data[settingsKey] = value;
    await assert.rejects(loadSettings(browser.api));
    assert.deepEqual(browser.data[settingsKey], value);
  }
  assert.equal(writes, 0);
});

test("rule precedence is deterministic, respects disabled exact rules and does not depend on order", () => {
  const patterns = ["/projects", "/pro*", "/projects*", "/pr*jects*", "/*", "/proj*ects", "/pro*jects"];
  const rules = patterns.map((path, index) => ({...rule(`https://example.com${path}`), id: String(index)}));
  const address = "https://example.com/projects?x=1";
  assert.equal(resolveRule(rules, address).pattern, "https://example.com/projects");
  rules[0].enabled = false;
  assert.equal(resolveRule([...rules].reverse(), address).pattern, "https://example.com/pro*jects");
  assert.equal(resolveRule(rules.slice(0, 5), address).pattern, "https://example.com/projects*", "more literal path characters win");
  const tied = rules.filter(item => ["/proj*ects", "/pro*jects"].some(path => item.pattern.endsWith(path)));
  assert.equal(resolveRule(tied, address).pattern, "https://example.com/pro*jects");
  assert.equal(resolveRule(tied.reverse(), address).pattern, "https://example.com/pro*jects");
  assert.equal(resolveRule(rules, "https://other.test/projects"), undefined);
});

test("automatic loads apply winning defaults once, preferences and SPA changes never overwrite live state", async () => {
  const broad = {...rule("http://127.0.0.1:8083/*"), defaultLayoutVisible: true};
  const exact = {...rule("http://127.0.0.1:8083/projects"), id: "exact", defaultLayoutVisible: false};
  const browser = mockBrowser([broad, exact]);
  createBackground(browser.api, browser.auto, "test-core");
  const run = () => loadAutomatically(browser.api, browser.auto, 7, browser.page.location.href);
  assert.equal((await run()).layoutVisible, false);
  assert.equal(browser.page.state, "closed");
  browser.page.layoutVisible = true;
  browser.page.state = "open";
  const calls = browser.calls.length;
  await browser.message({action: "set-default-layout", id: "exact", defaultLayoutVisible: true, tabId: 7});
  assert.equal(browser.calls.length, calls, "saving a preference must not inject");
  assert.equal(browser.page.state, "open");
  assert.equal(browser.page.layoutVisible, true);
  browser.page.layoutVisible = false;
  browser.navigate("http://127.0.0.1:8083/projects/2");
  assert.equal((await run()).layoutVisible, false, "SPA rule change must preserve manual state");
  browser.navigate("http://127.0.0.1:8083/projects/2", "new-document");
  assert.equal((await run()).layoutVisible, true);
  assert.equal(browser.page.state, "closed");
  const saved = changeRules(settings([broad]), {action: "toggle", id: broad.id, enabled: false});
  assert.equal(saved.rules[0].defaultLayoutVisible, true);
});


test("background serializes concurrent requests and preserves independent preference edits", async () => {
  const browser = mockBrowser();
  browser.data[settingsKey] = settings([{...rule(), id: "current"}]);
  createBackground(browser.api, browser.auto, "test-core");
  const results = await Promise.all([
    browser.message({action: "list"}),
    browser.message({action: "set-default-layout", id: "current", defaultLayoutVisible: true}),
    browser.message({action: "toggle", id: "current", enabled: false}),
  ]);
  assert.ok(results.every(result => result.ok && result.settingsVersion === 2));
  assert.deepEqual(browser.data[settingsKey], settings([{id: "current", pattern: rule().pattern, enabled: false, defaultLayoutVisible: true}]));
  const before = structuredClone(browser.data[settingsKey]);
  const invalid = await browser.message({action: "set-default-layout", id: "current", defaultLayoutVisible: "yes"});
  assert.equal(invalid.ok, false);
  assert.deepEqual(browser.data[settingsKey], before);
});

test("page shortcut yields to matching multi-page rules without changing exact precedence", () => {
  const address = "http://127.0.0.1:8083/projects";
  const exact = {...rule(address),id:"exact"};
  const broad = {...rule("http://127.0.0.1:8083/*"),id:"broad"};
  assert.equal(pageRuleContext([exact],address).managed,false);
  const context = pageRuleContext([exact,broad],address);
  assert.equal(context.effective.id,"exact", "existing precedence is preserved");
  assert.equal(context.managedRule.id,"broad", "disabling the exact rule would not turn off loading");
  assert.equal(context.managed,true);
  assert.equal(pageRuleContext([{...broad,enabled:false}],address).managed,false);
  assert.equal(pageRuleContext([broad],"http://127.0.0.1:8084/projects").managed,false);
});

test("standalone manager can edit without injecting a business tab; webpage senders stay rejected", async () => {
  const browser = mockBrowser([]);
  browser.grants.add("http://127.0.0.1/*");
  createBackground(browser.api,browser.auto,"test-core");
  const sender = {id:"test-extension",url:browser.api.runtime.getURL("rules.html"),tab:{id:42}};
  const added = await browser.message({action:"add",pattern:"http://127.0.0.1:8083/projects"},sender);
  assert.equal(added.ok,true);
  assert.equal(browser.calls.length,0,"manager edits do not activate an arbitrary tab");
  const saved = await browser.message({action:"set-default-layout",id:added.rules[0].id,defaultLayoutVisible:true},sender);
  assert.equal(saved.rules[0].defaultLayoutVisible,true);
  let accepted = false;
  for (const untrusted of [
    {...sender,url:"https://example.com/rules.html"},
    {...sender,url:browser.api.runtime.getURL("rules.html.evil")},
    {...sender,id:"another-extension"},
  ]) {
    assert.equal(browser.events.message({type:"layscope-rules",action:"list"},untrusted,() => { accepted=true; }),undefined);
  }
  assert.equal(accepted,false);
});
