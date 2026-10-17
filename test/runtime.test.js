import {test} from "node:test";
import assert from "node:assert/strict";
import {createContext, runInContext} from "node:vm";
import {dispatchInspector} from "../packages/core/runtime.js";

function harness({failCreate = false, failOpen = false, failLayout = false, launcherPreference, detailsPreference, panelWidth, recognitionMode, failPreferenceRead = false, failPreferenceWrite = false, storedPreferences = {}} = {}) {
  const listeners = new Map();
  const observers = new Set();
  const frames = new Map();
  const timers = new Map();
  const hosts = new Set();
  const stored = new Map(Object.entries(storedPreferences));
  if (launcherPreference !== undefined) stored.set("layscope.launcherVisible", launcherPreference);
  if (detailsPreference !== undefined) stored.set("layscope.detailsVisible", detailsPreference);
  if (panelWidth !== undefined) stored.set("layscope.panelWidth", panelWidth);
  if (recognitionMode !== undefined) stored.set("layscope.recognitionMode", recognitionMode);
  let serial = 0;
  class Target {
    addEventListener(type, callback) { listeners.set(callback, type); }
    removeEventListener(type, callback) { listeners.delete(callback); }
  }
  const document = new Target();
  const window = new Target();
  document.documentElement = {};
  document.body = {append(host) { hosts.add(host); host.isConnected = true; }};
  document.querySelector = () => [...hosts][0] ?? null;
  document.createElement = () => ({
    isConnected: false,
    attachShadow() { return {adoptedStyleSheets: []}; },
    remove() { hosts.delete(this); this.isConnected = false; },
  });
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const context = createContext({document, window, failCreate, failOpen, failLayout, destroyCalls: 0, externalStyles: 0,
    localStorage: {
      getItem(key) { if (failPreferenceRead) throw new Error("storage denied"); return stored.get(key) ?? null; },
      setItem(key, value) { if (failPreferenceWrite) throw new Error("quota exceeded"); stored.set(key, value); },
    },
    MutationObserver: Observer, CSSStyleSheet: class { replaceSync() {} },
    requestAnimationFrame(callback) { frames.set(++serial, callback); return serial; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback) { timers.set(++serial, callback); return serial; },
    clearTimeout(id) { timers.delete(id); },
  });
  const view = `function ({lifetime, setPicking, detailsPreference, widthPreference, recognitionPreference}) {
    globalThis.detailsConfig = detailsPreference;
    globalThis.widthConfig = widthPreference;
    globalThis.recognitionConfig = recognitionPreference;
    lifetime.listen(document, 'fixture', () => {});
    globalThis.pick = setPicking;
    if (failCreate) throw new Error('create failed');
    function allocate(scope) {
      scope.listen(window, 'resize', () => {});
      scope.observe(new MutationObserver(() => {})).observe(document.body);
      scope.frame(() => {}); scope.timeout(() => {}, 10);
    }
    return {
      startInspection: allocate, stopInspection() {},
      showLayout(scope) {
        externalStyles += 1;
        scope.cleanup(() => { externalStyles -= 1; });
        allocate(scope);
        if (failLayout) throw new Error('layout failed');
      }, hideLayout() {},
      showPanel(scope) { allocate(scope); if (failOpen) throw new Error('open failed'); },
      hidePanel() {}, renderState() {},
      destroy() { destroyCalls += 1; }, status() { return {}; }
    };
  }`;
  return {
    run(command, options = {}, version = "test-v2") { return JSON.parse(JSON.stringify(runInContext(`(${dispatchInspector})(${view}, '', ${JSON.stringify(command)}, ${JSON.stringify(options)}, ${JSON.stringify(version)})`, context))); },
    pick(value) { context.pick(value); },
    detailsVisible: () => context.detailsConfig.visible,
    saveDetails(value) { context.detailsConfig.save(value); },
    detailsPreference: () => stored.get("layscope.detailsVisible"),
    width: () => context.widthConfig.width,
    saveWidth(value) { context.widthConfig.save(value); },
    widthPreference: () => stored.get("layscope.panelWidth"),
    recognitionMode: () => context.recognitionConfig.mode,
    saveRecognition(value) { context.recognitionConfig.save(value); },
    recognitionPreference: () => stored.get("layscope.recognitionMode"),
    preference: () => stored.get("layscope.launcherVisible"),
    storedValues: () => Object.fromEntries(stored),
    resources: () => ({listeners: listeners.size, observers: observers.size, frames: frames.size, timers: timers.size, hosts: hosts.size, styles: context.externalStyles}),
    hasRegistry: () => Object.hasOwn(context, "__layScopeV1__"),
    destroyCalls: () => context.destroyCalls,
    detach() { for (const host of hosts) host.remove(); for (const observer of [...observers]) observer.callback(); },
    pagehide() { for (const [callback, type] of [...listeners]) if (type === "pagehide") callback(); },
  };
}

test("panel/layout matrix owns only needed resources, repeat load/open preserve state, destroy returns to baseline", () => {
  const page = harness();
  const zero = page.resources();
  for (let i = 0; i < 20; i += 1) {
    const quiet = page.run("load");
    assert.equal(quiet.panelOpen, false);
    assert.equal(quiet.layoutVisible, false);
    for (const name of ["panel", "layout", "inspection"]) assert.equal(quiet.resources[name], null);
    page.run("load", {layoutVisible: true});
    assert.equal(page.run("status").layoutVisible, false, "repeat load must not apply defaults");
    assert.equal(page.run("open").state, "open");
    const opened = page.resources();
    page.run("open");
    assert.deepEqual(page.resources(), opened);
    page.run("set-layout", {layoutVisible: true});
    page.pick(true);
    assert.equal(page.run("status").picking, true);
    const closed = page.run("close");
    assert.equal(closed.panelOpen, false);
    assert.equal(closed.layoutVisible, true);
    assert.equal(closed.picking, false);
    assert.equal(closed.resources.panel, null);
    assert.ok(closed.resources.layout && closed.resources.inspection);
    assert.equal(page.resources().styles, 1);
    const hidden = page.run("set-layout", {layoutVisible: false});
    for (const name of ["panel", "layout", "inspection"]) assert.equal(hidden.resources[name], null);
    assert.equal(page.resources().frames, 0);
    assert.equal(page.resources().timers, 0);
    assert.equal(page.run("toggle").panelOpen, true);
    assert.equal(page.run("status").layoutVisible, false);
    assert.equal(page.run("destroy").state, "absent");
    assert.deepEqual(page.resources(), zero);
    assert.equal(page.hasRegistry(), false);
    assert.equal(page.run("destroy").state, "absent");
  }
});
test("layout default only initializes a new silent instance; selection requires explicit layout and panel", () => {
  const page = harness();
  assert.equal(page.run("load", {layoutVisible: true}).layoutVisible, true);
  assert.equal(page.run("status").panelOpen, false);
  page.pick(true);
  assert.equal(page.run("status").picking, false);
  page.run("open"); page.pick(true);
  assert.equal(page.run("status").picking, true);
  const hidden = page.run("set-layout", {layoutVisible: false});
  assert.equal(hidden.panelOpen, true);
  assert.equal(hidden.picking, false);
  assert.ok(hidden.resources.panel);
  assert.equal(hidden.resources.layout, null);
  page.pick(true);
  assert.equal(page.run("status").picking, false);
  assert.equal(page.run("load", {layoutVisible: true}).layoutVisible, false);
  page.run("destroy");
});
test("old core stays inspectable/removable but cannot be controlled with new contracts", () => {
  const page = harness();
  page.run("open", {}, "old");
  assert.equal(page.run("status").version, "old");
  assert.throws(() => page.run("open"), /旧版/);
  assert.equal(page.run("destroy").state, "absent");
});
test("launcher visibility is independent, survives panel cycles and repeat loads without reallocating resources", () => {
  const page = harness();
  const zero = page.resources();
  page.run("load", {layoutVisible: true, launcherVisible: false});
  page.run("open"); page.pick(true);
  const before = page.resources();
  const shown = page.run("set-launcher", {launcherVisible: true});
  assert.equal(shown.panelOpen, true);
  assert.equal(shown.layoutVisible, true);
  assert.equal(shown.picking, true);
  assert.equal(shown.launcherVisible, true);
  assert.deepEqual(page.resources(), before);
  page.run("set-launcher", {launcherVisible: false});
  assert.equal(page.run("close").launcherVisible, false);
  assert.equal(page.run("toggle").launcherVisible, false);
  assert.equal(page.run("load", {launcherVisible: true}).launcherVisible, false);
  page.run("close");
  const quiet = page.run("set-layout", {layoutVisible: false});
  assert.equal(quiet.launcherVisible, false);
  assert.equal(quiet.resources.inspection, null);
  page.run("destroy");
  assert.deepEqual(page.resources(), zero);
  assert.equal(page.run("open").launcherVisible, false, "new instances reuse the saved preference");
  page.run("destroy");
});
test("launcher preference survives destruction/navigation and load defaults without changing live layout", () => {
  const page = harness();
  page.run("open");
  page.run("set-layout", {layoutVisible: true});
  page.run("set-launcher", {launcherVisible: false});
  assert.equal(page.preference(), "false");
  assert.equal(page.run("status").layoutVisible, true);
  page.pagehide();
  const automatic = page.run("load", {layoutVisible: true});
  assert.equal(automatic.launcherVisible, false);
  assert.equal(automatic.panelOpen, false);
  page.run("load", {launcherVisible: true});
  assert.equal(page.preference(), "false", "repeat load must not overwrite a manual choice");
  page.run("set-launcher", {launcherVisible: true});
  page.run("destroy");
  assert.equal(page.run("open").launcherVisible, true);
  page.run("destroy");
});
test("blocked or corrupt launcher storage fails explicitly without leaks or a false saved state", () => {
  for (const options of [{failPreferenceRead: true}, {launcherPreference: "invalid"}]) {
    const page = harness(options);
    const zero = page.resources();
    assert.throws(() => page.run("open"), /偏好/);
    assert.deepEqual(page.resources(), zero);
    assert.equal(page.hasRegistry(), false);
    if (options.launcherPreference) assert.equal(page.preference(), "invalid");
  }
  const page = harness({failPreferenceWrite: true});
  page.run("open");
  const before = page.resources();
  assert.throws(() => page.run("set-launcher", {launcherVisible: false}), /无法记住/);
  assert.equal(page.run("status").launcherVisible, true);
  assert.deepEqual(page.resources(), before);
  page.run("destroy");
});
test("status and close do not install; invalid commands fail before installation", () => {
  const page = harness();
  for (const command of ["status", "close", "destroy"]) assert.equal(page.run(command).state, "absent");
  assert.throws(() => page.run("invalid"), /Unknown inspector command/);
  for (const [command, options] of [["load", null], ["load", {layoutVisible: "yes"}], ["load", {launcherVisible: 0}], ["open", {layoutVisible: true}], ["set-layout", {}], ["set-layout", {other: true}], ["set-launcher", {}], ["set-launcher", {launcherVisible: "yes"}], ["set-launcher", {layoutVisible: false}]]) {
    assert.throws(() => page.run(command, options));
  }
  assert.throws(() => page.run("set-layout", {layoutVisible: true}), /Load the inspector/);
  assert.throws(() => page.run("set-launcher", {launcherVisible: false}), /Load the inspector/);
  assert.equal(page.hasRegistry(), false);
  assert.equal(page.resources().hosts, 0);
});
for (const option of ["failCreate", "failOpen", "failLayout"]) {
  test(`${option} rolls back all resources and registry`, () => {
    const page = harness({[option]: true});
    const zero = page.resources();
    assert.throws(() => { page.run("load", {layoutVisible: true}); page.run("open"); }, /failed/);
    assert.deepEqual(page.resources(), zero);
    assert.equal(page.hasRegistry(), false);
    if (option !== "failCreate") assert.equal(page.destroyCalls(), 1);
  });
}
test("external host removal destroys the instance", () => {
  const page = harness();
  const zero = page.resources();
  page.run("open");
  page.detach();
  assert.deepEqual(page.resources(), zero);
  assert.equal(page.hasRegistry(), false);
});
test("navigation clears both open and closed instances", () => {
  for (const state of ["open", "closed"]) {
    const page = harness();
    const zero = page.resources();
    page.run("open");
    if (state === "closed") page.run("close");
    page.pagehide();
    assert.deepEqual(page.resources(), zero);
    assert.equal(page.hasRegistry(), false);
    assert.equal(page.destroyCalls(), 1);
  }
});

test("details visibility is a durable preference independent from panel/layout/launcher state", () => {
  const page = harness({detailsPreference:"false",launcherPreference:"false"});
  const quiet = page.run("load");
  assert.equal(page.detailsVisible(),false);
  page.saveDetails(true);
  assert.equal(page.detailsPreference(),"true");
  assert.deepEqual(page.run("status"),quiet,"saving the detail preference must not alter runtime visibility");
  assert.equal(page.preference(),"false");
  page.run("destroy");
  page.run("open");
  assert.equal(page.detailsVisible(),true);
  page.saveDetails(false);
  page.pagehide();
  page.run("load",{layoutVisible:true});
  assert.equal(page.detailsVisible(),false);
});

test("invalid detail preferences fail before mounting and blocked saves preserve the original value", () => {
  const corrupt = harness({detailsPreference:"invalid"});
  const baseline = corrupt.resources();
  assert.throws(() => corrupt.run("open"),/详情显隐偏好格式无效/);
  assert.deepEqual(corrupt.resources(),baseline);
  assert.equal(corrupt.detailsPreference(),"invalid");
  const blocked = harness({detailsPreference:"true",failPreferenceWrite:true});
  blocked.run("open");
  assert.throws(() => blocked.saveDetails(false),{code:"DETAILS_PREFERENCE_SAVE_FAILED"});
  assert.equal(blocked.detailsPreference(),"true");
  assert.equal(blocked.run("status").panelOpen,true);
});

test("panel width persists independently across instances and rejects invalid writes", () => {
  const page = harness({launcherPreference: "false", detailsPreference: "false"});
  const initial = page.run("load");
  assert.equal(page.width(), 350);
  page.saveWidth(520);
  assert.equal(page.widthPreference(), "520");
  assert.deepEqual(page.run("status"), initial);
  assert.equal(page.preference(), "false");
  assert.equal(page.detailsPreference(), "false");
  for (const invalid of [319, 641, 350.5, "400", NaN]) {
    assert.throws(() => page.saveWidth(invalid), /无效的面板宽度/);
    assert.equal(page.widthPreference(), "520");
  }
  page.pagehide();
  page.run("load", {layoutVisible: true});
  assert.equal(page.width(), 520);
});

test("invalid saved widths fail before mounting and failed saves preserve the stored width", () => {
  for (const width of ["bad", "319", "641", "0350", "350.5", ""]) {
    const page = harness({panelWidth: width});
    const before = page.resources();
    assert.throws(() => page.run("open"), /面板宽度偏好格式无效/);
    assert.deepEqual(page.resources(), before);
    assert.equal(page.widthPreference(), width);
  }
  const page = harness({panelWidth: "480", failPreferenceWrite: true});
  page.run("open");
  assert.throws(() => page.saveWidth(500), {code: "WIDTH_PREFERENCE_SAVE_FAILED"});
  assert.equal(page.widthPreference(), "480");
  assert.equal(page.run("status").panelOpen, true);
});

test("recognition mode is typed, durable and independent from visual state", () => {
  const page = harness();
  page.run("load", {layoutVisible: true});
  assert.equal(page.recognitionMode(), "auto");
  for (const value of ["vue", "", true]) assert.throws(() => page.saveRecognition(value), /无效/);
  page.saveRecognition("dom");
  assert.equal(page.recognitionPreference(), "dom");
  assert.equal(page.run("status").layoutVisible, true);
  assert.equal(page.run("status").panelOpen, false);
  page.run("destroy"); page.run("open");
  assert.equal(page.recognitionMode(), "dom");
});

test("LayScope reload preserves its own preferences and registry", () => {
  const page = harness({launcherPreference: "false", detailsPreference: "false", panelWidth: "480", recognitionMode: "dom"});
  page.run("load", {layoutVisible: true}, "0.8.0");
  assert.equal(page.hasRegistry(), true);
  page.run("destroy", {}, "0.8.1");
  const next = page.run("load", {layoutVisible: true}, "0.8.1");
  assert.equal(next.launcherVisible, false);
  assert.equal(next.layoutVisible, true);
  assert.equal(next.panelOpen, false);
  assert.equal(page.detailsVisible(), false);
  assert.equal(page.width(), 480);
  assert.equal(page.recognitionMode(), "dom");
  assert.equal(page.preference(), "false");
  assert.equal(page.detailsPreference(), "false");
  assert.equal(page.widthPreference(), "480");
  assert.equal(page.recognitionPreference(), "dom");
});

test("a fresh LayScope instance ignores and leaves previous-product preferences untouched", () => {
  const previous = {
    "layout-inspector.launcherVisible": "false",
    "layout-inspector.detailsVisible": "false",
    "layout-inspector.panelWidth": "520",
    "layout-inspector.recognitionMode": "dom",
  };
  const page = harness({storedPreferences: previous});
  const loaded = page.run("load");
  assert.equal(loaded.launcherVisible, true);
  assert.equal(page.detailsVisible(), true);
  assert.equal(page.width(), 350);
  assert.equal(page.recognitionMode(), "auto");
  assert.deepEqual(page.storedValues(), previous);
  page.run("destroy");
  assert.deepEqual(page.storedValues(), previous);
});

test("corrupt recognition mode fails before mounting and failed writes preserve preference", () => {
  const invalid = harness({recognitionMode: "vue"});
  assert.throws(() => invalid.run("open"), /组件识别偏好格式无效/);
  assert.equal(invalid.resources().hosts, 0);
  const page = harness({recognitionMode: "dom", failPreferenceWrite: true});
  page.run("open");
  assert.throws(() => page.saveRecognition("auto"), {code: "RECOGNITION_PREFERENCE_SAVE_FAILED"});
  assert.equal(page.recognitionPreference(), "dom");
});
