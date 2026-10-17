// Test-only Chrome API substitute. This module is never copied into dist/chromium.
import {createBackground} from "/popup/background-controller.js";
import {layScope} from "/popup/core.js";
import {version} from "/popup/version.js";
import {settingsKey} from "/popup/rules.js";

const scenario = new URL(location.href).searchParams.get("scenario");
const reloaded = sessionStorage.getItem("layScopePopupReloaded") === "yes";
const key = `layScopePopupPreview:${scenario ?? "default"}`;
const saved = JSON.parse(sessionStorage.getItem(key) ?? '{"local":{},"grants":[]}');
const data = saved.local;
if (["design", "many-rules", "inherited", "revoked"].includes(scenario) && !data[settingsKey]) {
  let sample = [
    {id:"exact",pattern:"http://127.0.0.1:8083/projects",enabled:true,defaultLayoutVisible:true},
    {id:"broad",pattern:"http://127.0.0.1:8083/*",enabled:false,defaultLayoutVisible:true},
    {id:"disabled",pattern:"https://example.com/admin/*",enabled:false,defaultLayoutVisible:false},
  ];
  if (scenario === "inherited") sample[1].enabled = true;
  if (scenario === "many-rules") sample = Array.from({length:50},(_,i) => ({id:String(i),pattern:`http://127.0.0.1:8083/page/${i}`,enabled:true,defaultLayoutVisible:false}));
  data[settingsKey] = {version:2,rules:sample};
  if (scenario !== "revoked") saved.grants.push("http://127.0.0.1/*");
}
const grants = new Set(saved.grants);
const session = {};
const storageListeners = [];
let state = "absent";
if ((scenario === "legacy-open" && !reloaded) || scenario === "storage-error") state = "open";
let layoutVisible = false;
let launcherVisible = true;
let oldCore = ["old-core","old-core-closed"].includes(scenario);
const launcherKey = "layscope.preview-launcherVisible";
const readLauncher = () => localStorage.getItem(launcherKey) !== "false";
function status() {
  if (state === "absent") return {state};
  return {state, version: oldCore ? "0.3.0" : version, panelOpen: state === "open", layoutVisible, launcherVisible, picking: false};
}
if (scenario === "design") { state="closed"; layoutVisible=true; launcherVisible=false; }
if (scenario === "old-core") { state = "open"; layoutVisible = true; launcherVisible = false; }
if (scenario === "old-core-closed") { state = "closed"; layoutVisible = true; launcherVisible = false; }
let listener;
const targetURL = "http://127.0.0.1:8083/projects";
function persist() { sessionStorage.setItem(key, JSON.stringify({local: data, grants: [...grants]})); }
function area(source, persistent = false) {
  return {
    async get(name) { return {[name]: structuredClone(source[name])}; },
    async set(values) { Object.assign(source, structuredClone(values)); if (persistent) { persist(); for (const callback of storageListeners) callback(Object.fromEntries(Object.entries(values).map(([key,newValue]) => [key,{newValue}])),"local"); } },
    async remove(names) { for (const name of [names].flat()) delete source[name]; if (persistent) persist(); },
  };
}
function previewAuto() {}
window.chrome = {
  runtime: {
    id: "preview",
    getURL: path => `chrome-extension://preview/${path}`,
    async openOptionsPage() { location.href = `/rules/${location.search}`; },
    getManifest() {
      if (scenario === "legacy-open" && !reloaded) return {};
      return {version, background: {service_worker: "background.js"}};
    },
    reload() {
      if (state !== "absent") throw new Error("Preview detected an inspector that was not cleaned before reload.");
      sessionStorage.setItem("layScopePopupReloaded", "yes");
      location.reload();
    },
    onMessage: {addListener(callback) { listener = callback; }},
    sendMessage(message) {
      if (scenario === "old-background") return Promise.resolve({ok: true, rules: []});
      if (scenario === "stale-core-background") return Promise.resolve({ok: true, settingsVersion: 2, coreVersion: "0.3.0", rules: []});
      if (scenario === "disconnected") return Promise.reject(new Error("Could not establish connection. Receiving end does not exist."));
      return new Promise(resolve => listener(message, {id:"preview",url:location.pathname === "/rules/" ? "chrome-extension://preview/rules.html" : "chrome-extension://preview/popup.html", ...location.pathname === "/rules/" && {tab:{id:2}}}, resolve));
    },
  },
  tabs: {
    async query() { return [{id: 1, url: scenario === "restricted" ? "edge://extensions/" : targetURL}]; },
    async get(id) { return {id, url: targetURL}; },
    onUpdated: {addListener() {}}, onRemoved: {addListener() {}},
  },
  storage: {local: area(data, true), session: area(session),onChanged:{addListener(callback) { storageListeners.push(callback); }}},
  permissions: {
    async contains({origins}) { return origins.every(origin => grants.has(origin)); },
    async request({origins}) {
      if (scenario === "denied") return false;
      for (const origin of origins) grants.add(origin);
      persist();
      return true;
    },
    async remove({origins}) { for (const origin of origins) grants.delete(origin); persist(); return true; },
  },
  scripting: {
    async executeScript({func, args = []}) {
      let result;
      if (func === layScope) {
        const [command, options] = args;
        if (command === "open") {
          if (state === "absent") { layoutVisible = false; launcherVisible = readLauncher(); oldCore = false; }
          state = "open";
        }
        else if (command === "close" && state === "open") state = "closed";
        else if (command === "destroy") state = "absent";
        else if (command === "load" && state === "absent") {
          state = "closed"; layoutVisible = options.layoutVisible === true; oldCore = false;
          if (Object.hasOwn(options, "launcherVisible")) localStorage.setItem(launcherKey, String(options.launcherVisible));
          launcherVisible = readLauncher();
        }
        else if (command === "set-layout") layoutVisible=options.layoutVisible;
        else if (command === "set-launcher") { launcherVisible = options.launcherVisible; localStorage.setItem(launcherKey, String(launcherVisible)); }
        else if (command !== "status") throw new Error(`Unsupported preview command: ${command}`);
        result = status();
      } else if (func === previewAuto) {
        if (state === "absent") { state = "closed"; layoutVisible = args[1]; launcherVisible = readLauncher(); oldCore = false; }
        result = status();
      } else if (func.name === "inspectPage") result = {url: targetURL, ready: true};
      else throw new Error("Unsupported preview injection");
      return [{documentId: "preview-document", result}];
    },
  },
};
if (scenario === "legacy-open" && !reloaded) delete chrome.storage;
if (scenario === "storage-error") chrome.storage.session.get = async () => { throw new Error("storage unavailable"); };
createBackground(chrome, previewAuto, version);
