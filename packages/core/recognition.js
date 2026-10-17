// Read-only Vue 3 development metadata. DOM containment remains authoritative.
export function createRecognition() {
  function domInfo(element, vueOwner = null) {
    return {name: element.localName + (element.id ? `#${element.id}` : ""), kind: "DOM", source: "DOM", vueOwner};
  }
  function componentName(instance) {
    const type = instance.type;
    const names = [type.name, type.__name];
    if (typeof type === "function") names.unshift(type.displayName);
    for (const name of names) {
      if (typeof name === "string" && name.trim()) return name.trim();
    }
    if (typeof type.__file === "string") {
      const match = type.__file.match(/([^/\\]+)\.vue$/);
      if (match) return match[1];
    }
    return "匿名 Vue 组件";
  }

  function roots(vnode, result, seen) {
    if (!vnode || typeof vnode !== "object" || seen.has(vnode)) return;
    seen.add(vnode);
    if (vnode.component) roots(vnode.component.subTree, result, seen);
    else if (vnode.suspense) roots(vnode.suspense.activeBranch, result, seen);
    else if (typeof vnode.type === "string" && vnode.el instanceof Element) result.add(vnode.el);
    else if (vnode.type === Symbol.for("v-stc")) {
      let node = vnode.el;
      while (node) {
        if (node instanceof Element) result.add(node);
        if (!vnode.anchor || node === vnode.anchor) break;
        node = node.nextSibling;
      }
    }
    else if (Array.isArray(vnode.children)) {
      for (const child of vnode.children) roots(child, result, seen);
    }
  }

  function scan(elements, mode) {
    if (!["auto", "dom"].includes(mode)) throw new Error("Invalid recognition mode.");
    const info = new Map();
    if (mode === "dom") {
      for (const element of elements) info.set(element, domInfo(element));
      return {info, sources: [], vue: "disabled", label: "仅 DOM"};
    }
    const instances = new Set();
    const seenInstances = new Set();
    const seenVNodes = new Set();
    let vueDetected = false;
    function discoverVNode(vnode) {
      if (!vnode || typeof vnode !== "object" || seenVNodes.has(vnode)) return;
      seenVNodes.add(vnode);
      if (vnode.component) discover(vnode.component);
      else if (vnode.suspense) discoverVNode(vnode.suspense.activeBranch);
      else if (Array.isArray(vnode.children)) {
        for (const child of vnode.children) discoverVNode(child);
      }
    }
    function discover(instance) {
      if (!instance || seenInstances.has(instance)) return;
      if (typeof instance.appContext?.app?.version !== "string" || !instance.appContext.app.version.startsWith("3.") ||
          !instance.type || !instance.subTree || instance.isUnmounted || instance.isDeactivated) return;
      seenInstances.add(instance);
      vueDetected = true;
      discoverVNode(instance.subTree);
      // Children precede wrappers so a shared DOM root uses its closest component.
      instances.add(instance);
    }
    for (const element of elements) {
      const app = element.__vue_app__;
      if (typeof app?.version === "string" && app.version.startsWith("3.")) {
        vueDetected = true;
        discover(app._instance);
      }
      let instance = element.__vueParentComponent;
      while (instance && !seenInstances.has(instance)) {
        discover(instance);
        if (!seenInstances.has(instance)) break;
        instance = instance.parent;
      }
    }
    const rootNames = new Map();
    for (const instance of instances) {
      const elements = new Set();
      roots(instance.subTree, elements, new Set());
      for (const element of elements) {
        if (!rootNames.has(element)) rootNames.set(element, componentName(instance));
      }
    }
    const sources = new Set();
    for (const element of elements) {
      const owner = element.__vueParentComponent;
      let vueOwner = null;
      if (instances.has(owner)) vueOwner = componentName(owner);
      else if (rootNames.has(element)) vueOwner = rootNames.get(element);
      const component = element.getAttribute("data-layout-component");
      const legacy = element.getAttribute("data-kivo-component");
      if (component && legacy && component !== legacy) throw new Error("Conflicting data-layout-component and data-kivo-component names.");
      let value;
      if (component || legacy) value = {name: component || legacy, kind: "组件", source: "组件标记", vueOwner};
      else if (rootNames.has(element)) value = {name: rootNames.get(element), kind: "组件", source: "Vue 3", vueOwner};
      else {
        const slot = element.getAttribute("data-slot");
        if (slot) value = {name: slot.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(""), kind: "slot", source: "组件标记", vueOwner};
        else value = domInfo(element, vueOwner);
      }
      if (value.source !== "DOM") sources.add(value.source);
      info.set(element, value);
    }
    if (vueDetected) sources.add("Vue 3");
    const ordered = ["组件标记", "Vue 3"].filter(source => sources.has(source));
    let vue = "absent";
    if (vueDetected) vue = instances.size ? "available" : "unavailable";
    let label = ordered.join(" · ") || "DOM";
    if (vue === "unavailable") label += "（组件信息不可用）";
    return {info, sources: ordered, vue, label};
  }
  return {scan};
}
