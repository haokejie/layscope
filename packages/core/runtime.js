// Serialized into both adapters; dependencies and version are explicit arguments.
export function dispatchInspector(createView, css, command, options, version) {
  "use strict";
  // LayScope owns one registry and one preference namespace.
  const key = "__layScopeV1__";
  const commands = ["load", "open", "close", "toggle", "set-layout", "set-launcher", "destroy", "status"];
  function validate(action, values) {
    if (!commands.includes(action)) throw new Error(`Unknown inspector command: ${action}`);
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Inspector options must be an object.");
    const keys = Object.keys(values);
    if (["load", "set-layout", "set-launcher"].includes(action)) {
      let allowed = ["layoutVisible", "launcherVisible"];
      if (action === "set-layout") allowed = ["layoutVisible"];
      if (action === "set-launcher") allowed = ["launcherVisible"];
      if (keys.some(name => !allowed.includes(name))) throw new Error(`Unsupported options for ${action}.`);
      for (const name of allowed) {
        if ((name in values || action !== "load") && typeof values[name] !== "boolean") {
          throw new Error(`${name} must be a boolean.`);
        }
      }
    } else if (keys.length) throw new Error(`Command ${action} does not accept options.`);
  }
  validate(command, options);
  const existing = globalThis[key];
  if (existing) {
    const current = existing.command("status");
    if (current.version !== version && !["status", "destroy"].includes(command)) {
      throw new Error("页面已加载旧版检查器，请先完全移除旧实例，再加载新版。");
    }
    return existing.command(command, options);
  }
  if (["close", "destroy", "status"].includes(command)) return {state: "absent"};
  if (command === "set-layout" || command === "set-launcher") throw new Error("Load the inspector before setting visibility.");
  if (!document.body) throw new Error("LayScope requires a loaded HTML body.");
  if (document.querySelector("layscope-inspector")) throw new Error("LayScope is already mounted in another execution world. Remove that instance first.");

  function preference(name, label, errorCode, initial, decode) {
    const key = `layscope.${name}`;
    return {
      read() {
        let saved;
        try { saved = localStorage.getItem(key); }
        catch (error) { throw new Error(`无法读取此站点的${label}偏好：${error.message}`); }
        if (saved === null) return initial;
        const value = decode(saved);
        if (value === undefined) throw new Error(`此站点的${label}偏好格式无效，未覆盖原值。`);
        return value;
      },
      save(value) {
        if (decode(String(value)) !== value) throw new RangeError(`无效的${label}偏好。`);
        try { localStorage.setItem(key, String(value)); }
        catch (error) {
          const failure = new Error(`无法记住此站点的${label}偏好：${error.message}`);
          failure.code = errorCode;
          throw failure;
        }
      },
    };
  }
  function decodeBoolean(saved) {
    if (saved === "true") return true;
    if (saved === "false") return false;
  }
  const launcherPreference = preference("launcherVisible", "入口", "LAUNCHER_PREFERENCE_SAVE_FAILED", true, decodeBoolean);
  const detailsPreference = preference("detailsVisible", "详情显隐", "DETAILS_PREFERENCE_SAVE_FAILED", true, decodeBoolean);
  const widthPreference = preference("panelWidth", "面板宽度", "WIDTH_PREFERENCE_SAVE_FAILED", 350, saved => {
    const width = Number(saved);
    if (Number.isInteger(width) && width >= 320 && width <= 640 && String(width) === saved) return width;
  });
  const recognitionPreference = preference("recognitionMode", "组件识别", "RECOGNITION_PREFERENCE_SAVE_FAILED", "auto", saved => {
    if (saved === "auto" || saved === "dom") return saved;
  });

  function scope() {
    const disposers = new Set();
    const counts = {listeners: 0, observers: 0, frames: 0, timers: 0, cleanups: 0};
    let disposed = false;
    function own(cleanup, kind) {
      if (disposed) throw new Error("Cannot add resources to a disposed scope.");
      counts[kind] += 1;
      const dispose = () => {
        if (!disposers.delete(dispose)) return;
        counts[kind] -= 1;
        cleanup();
      };
      disposers.add(dispose);
      return dispose;
    }
    return {
      cleanup(callback) { return own(callback, "cleanups"); },
      listen(target, type, callback, values) {
        target.addEventListener(type, callback, values);
        return own(() => target.removeEventListener(type, callback, values), "listeners");
      },
      observe(observer) { own(() => observer.disconnect(), "observers"); return observer; },
      frame(callback) {
        let release;
        const id = requestAnimationFrame(() => { release(); callback(); });
        release = own(() => cancelAnimationFrame(id), "frames");
        return release;
      },
      timeout(callback, delay) {
        let release;
        const id = setTimeout(() => { release(); callback(); }, delay);
        release = own(() => clearTimeout(id), "timers");
        return release;
      },
      status: () => ({...counts}),
      dispose() {
        disposed = true;
        const errors = [];
        for (const release of [...disposers].reverse()) {
          try { release(); } catch (error) { errors.push(error); }
        }
        if (errors.length) throw new AggregateError(errors, "Inspector resource cleanup failed.");
      },
    };
  }

  const state = {panelOpen: false, layoutVisible: false, launcherVisible: launcherPreference.read(), picking: false};
  const detailsEnabled = detailsPreference.read();
  const panelWidth = widthPreference.read();
  const recognitionMode = recognitionPreference.read();
  const lifetime = scope();
  let inspection = null;
  let layout = null;
  let panel = null;
  let view;
  let destroyed = false;
  const host = document.createElement("layscope-inspector");
  const root = host.attachShadow({mode: "open"});
  const sheet = new CSSStyleSheet();
  function status() {
    return {state: state.panelOpen ? "open" : "closed", version, ...state,
      resources: {lifetime: lifetime.status(), inspection: inspection?.status() ?? null,
        layout: layout?.status() ?? null, panel: panel?.status() ?? null}, ...view.status()};
  }
  function destroy() {
    if (destroyed) return {state: "absent"};
    destroyed = true;
    state.panelOpen = false;
    state.layoutVisible = false;
    state.picking = false;
    try { panel?.dispose(); }
    finally {
      try { layout?.dispose(); }
      finally {
        try { inspection?.dispose(); }
        finally {
          try { lifetime.dispose(); }
          finally {
            try { view?.destroy(); }
            finally { root.adoptedStyleSheets = []; host.remove(); delete globalThis[key]; }
          }
        }
      }
    }
    return {state: "absent"};
  }
  function reconcile() {
    const needed = state.panelOpen || state.layoutVisible;
    if (!state.panelOpen && panel) { panel.dispose(); panel = null; view.hidePanel(); }
    if (!state.layoutVisible && layout) { layout.dispose(); layout = null; view.hideLayout(); }
    if (!needed && inspection) { inspection.dispose(); inspection = null; view.stopInspection(); }
    if (needed && !inspection) { inspection = scope(); view.startInspection(inspection); }
    if (state.layoutVisible && !layout) { layout = scope(); view.showLayout(layout); }
    if (state.panelOpen && !panel) { panel = scope(); view.showPanel(panel); }
    view.renderState();
  }
  function run(action, values = {}) {
    validate(action, values);
    if (action === "destroy") return destroy();
    if (destroyed) return {state: "absent"};
    if (action === "status" || action === "load") return status();
    if (action === "open") state.panelOpen = true;
    if (action === "close") state.panelOpen = false;
    if (action === "toggle") state.panelOpen = !state.panelOpen;
    if (action === "set-layout") state.layoutVisible = values.layoutVisible;
    if (action === "set-launcher") {
      launcherPreference.save(values.launcherVisible);
      state.launcherVisible = values.launcherVisible;
    }
    if (!state.panelOpen || !state.layoutVisible) state.picking = false;
    try { reconcile(); }
    catch (error) { destroy(); throw error; }
    return status();
  }
  try {
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [sheet];
    document.body.append(host);
    view = createView({host, root, lifetime, state,
      detailsPreference: {visible: detailsEnabled, save: detailsPreference.save},
      widthPreference: {width: panelWidth, save: widthPreference.save},
      recognitionPreference: {mode: recognitionMode, save: recognitionPreference.save},
      close: () => run("close"), toggle: () => run("toggle"), destroy,
      setLayout: value => run("set-layout", {layoutVisible: value}),
      setLauncher: value => run("set-launcher", {launcherVisible: value}),
      setPicking: value => {
        state.picking = Boolean(value && state.panelOpen && state.layoutVisible);
        view.renderState();
      }});
    lifetime.listen(document, "keydown", event => {
      if (event.altKey && event.shiftKey && event.code === "KeyL") { event.preventDefault(); run("toggle"); }
    }, true);
    lifetime.listen(window, "pagehide", destroy);
    const removal = lifetime.observe(new MutationObserver(() => { if (!host.isConnected) destroy(); }));
    removal.observe(document.documentElement, {childList: true, subtree: true});
    Object.defineProperty(globalThis, key, {value: {command: run}, configurable: true});
    if (command === "load") {
      state.layoutVisible = options.layoutVisible === true;
      if (Object.hasOwn(options, "launcherVisible")) {
        launcherPreference.save(options.launcherVisible);
        state.launcherVisible = options.launcherVisible;
      }
      reconcile();
      return status();
    }
    return run(command, options);
  } catch (error) { if (!destroyed) destroy(); throw error; }
}
