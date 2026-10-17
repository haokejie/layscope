// Generic DOM inspection, migrated from the existing Kivo development tool.
// Rendered containment is reported; optional names never imply a framework call stack.
export function createView(context, recognition) {
  "use strict";
  const {host, root, lifetime, state, close, toggle, destroy, setLayout, setLauncher, setPicking, detailsPreference, widthPreference, recognitionPreference} = context;
  host.setAttribute("aria-live", "off");
  // Build static UI without innerHTML so Trusted Types pages can use the inspector.
  function element(tag, attributes, children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }
  const e = element;
  function icon(name) {
    const paths = {
      pick: "M9 2v3M9 13v3M2 9h3M13 9h3M6 6h6v6H6z",
      clear: "m5 5 8 8M13 5l-8 8",
      settings: "M4 9h.01M9 9h.01M14 9h.01",
      expand: "m5 5 4-3 4 3M9 2v5m-4 6 4 3 4-3M9 16v-5",
      collapse: "m5 2 4 3 4-3M9 5V1m-4 15 4-3 4 3M9 13v4",
      up: "M14 14H8a3 3 0 0 1-3-3V4m-3 3 3-3 3 3",
      chevron: "m6 3 6 6-6 6",
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 18 18");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", paths[name]);
    svg.append(path);
    return svg;
  }
  root.replaceChildren(
    e("div", {class: "dock"}, [
      e("button", {class: "launcher", type: "button", "aria-expanded": "false", "aria-controls": "panel",
        title: "点击开关，拖拽移动", "aria-keyshortcuts": "Alt+Shift+L"}, ["▧ LayScope", e("span", {}, ["通用"])]),
      e("section", {id: "panel", class: "panel", "aria-label": "布局检查器", hidden: ""}, [
        e("header", {class: "drag-handle", tabindex: "0", "aria-label": "移动布局检查器", title: "拖拽移动；方向键移动，Shift 加速"}, [
          e("div", {}, [e("span", {class: "grip", "aria-hidden": "true"}, ["⠿"]), e("strong", {}, ["LayScope"])]),
          e("div", {class: "header-actions"}, [
            e("button", {type: "button", class: "more icon-button", "aria-label": "面板设置", "aria-expanded": "false", "aria-controls": "inspector-settings", title: "面板设置"}, [icon("settings")]),
            e("button", {type: "button", class: "close icon-button", "aria-label": "收起布局检查面板", title: "收起面板"}, [icon("clear")]),
          ]),
        ]),
        e("div", {class: "controls"}, [
          e("div", {class: "selection-actions"}, [
            e("button", {type: "button", class: "pick", "aria-label": "选择页面元素", "aria-pressed": "false", title: "选择页面元素；Esc 结束选择"}, [icon("pick"), e("span", {class: "pick-label"}, ["选取"])]),
            e("button", {type: "button", class: "clear icon-button", "aria-label": "清除选择", title: "清除选择并结束选取", disabled: ""}, [icon("clear")]),
          ]),
          e("div", {class: "options"}, [
            e("label", {class: "layout-control", title: "显示页面布局边界，不改变面板展开状态"}, [e("input", {class: "layout-toggle", type: "checkbox", role: "switch", "aria-label": "显示布局"}, []), "布局"]),
            e("label", {title: "包含未标记的普通 HTML 元素"}, [e("input", {class: "dom", type: "checkbox", "aria-label": "包含普通 DOM"}, []), "普通 DOM"]),
          ]),
        ]),
        e("section", {id: "inspector-settings", class: "settings", "aria-label": "面板设置", hidden: ""}, [
          e("label", {class: "recognition-option"}, ["组件识别", e("select", {class: "recognition-mode", "aria-label": "组件识别模式"}, [e("option", {value: "auto"}, ["自动"]), e("option", {value: "dom"}, ["仅 DOM"])])]),
          e("p", {class: "recognition-error", role: "alert", hidden: ""}, []),
          e("label", {class: "launcher-option", title: "记住此站点偏好，刷新和自动加载继续沿用"}, [e("input", {class: "launcher-toggle", type: "checkbox"}, []), "显示悬浮入口"]),
          e("label", {class: "launcher-option", title: "选中或展开深层节点时收起远处祖先；悬浮不改变显示范围"}, [e("input", {class: "auto-ancestors", type: "checkbox", checked: ""}, []), "自动收起祖先"]),
          e("p", {class: "preference-error", role: "alert", hidden: ""}, []),
          e("p", {class: "help"}, ["入口显隐按站点记忆。Alt + Shift + L 打开或收起面板。"]),
          e("p", {class: "help"}, ["自动识别组件标记和 Vue 3；标记优先，层级代表实际 HTML 嵌套。"]),
          e("button", {type: "button", class: "destroy"}, ["完全移除"]),
        ]),
        e("div", {class: "tree-bar"}, [
          e("strong", {}, ["页面层级"]), e("span", {class: "recognition-status", "aria-label": "组件识别状态"}, []), e("span", {class: "count"}, []),
          e("button", {type: "button", class: "details-toggle", "aria-label": "显示元素详情", "aria-expanded": "false", "aria-controls": "inspector-details-card", title: "显示元素详情", disabled: ""}, ["详情"]),
        ]),
        e("p", {class: "details-error", role: "alert", hidden: ""}, []),
        e("p", {class: "width-error", role: "alert", hidden: ""}, []),
        e("div", {id: "inspector-tree-page", class: "tree-page"}, [
          e("div", {class: "tree-heading"}, [
            e("button", {type: "button", class: "scope-up icon-button", "aria-label": "显示上一层", title: "显示上一层，不改变选择", hidden: ""}, [icon("up")]),
            e("button", {type: "button", class: "ancestors-toggle", "aria-expanded": "false", "aria-controls": "inspector-ancestors", hidden: ""}, []),
            e("span", {class: "selection-summary"}, ["未选择元素"]),
            e("div", {class: "tree-actions"}, [
              e("button", {type: "button", class: "expand-all icon-button", "aria-label": "全部展开", title: "全部展开"}, [icon("expand")]),
              e("button", {type: "button", class: "collapse-all icon-button", "aria-label": "全部折叠", title: "全部折叠"}, [icon("collapse")]),
            ]),
          ]),
          e("nav", {class: "tree", "aria-label": "组件层级"}, []),
        ]),
        e("section", {id: "inspector-ancestors", class: "ancestors", "aria-label": "已收起的祖先", hidden: ""}, [
          e("div", {class: "ancestors-heading"}, [e("strong", {}, ["已收起的祖先"]), e("button", {type: "button", class: "ancestors-close icon-button", "aria-label": "收起祖先路径"}, [icon("clear")])]),
          e("ol", {class: "ancestors-list"}, []),
          e("button", {type: "button", class: "tree-top"}, ["返回完整树"]),
        ]),
        ...["left", "right"].map(side => e("button", {type: "button", class: `resize-handle resize-${side}`, role: "separator", "aria-orientation": "vertical", "aria-label": `调整面板宽度（${side === "left" ? "左" : "右"}边缘）`, "aria-valuemin": "320", "aria-valuemax": "640", title: "拖动调整宽度；方向键微调，Shift 加速；双击恢复 350px"}, [e("span", {"aria-hidden": "true"}, [])])),
      ]),
    ]),
    e("aside", {id: "inspector-details-card", class: "details-card", "aria-label": "元素详情", hidden: ""}, [
      e("header", {}, [e("strong", {}, ["元素详情"]), e("button", {type: "button", class: "details-close icon-button", "aria-label": "收起元素详情", title: "收起并记住详情显隐"}, [icon("clear")])]),
      e("div", {class: "details", tabindex: "0", "aria-label": "详情内容"}, []),
    ]),
    e("div", {class: "highlight", hidden: ""}, []), e("div", {class: "tooltip", hidden: ""}, []),
  );
  const ui = Object.fromEntries(["recognition-mode", "recognition-status", "recognition-error", "dock", "launcher", "panel", "close", "more", "settings", "details-toggle", "details-card", "details-close", "details-error", "width-error", "resize-left", "resize-right", "auto-ancestors", "scope-up", "ancestors-toggle", "ancestors", "ancestors-list", "tree-top", "ancestors-close", "tree-page", "selection-summary", "pick", "pick-label", "clear", "layout-toggle", "launcher-toggle", "preference-error", "dom", "details", "tree", "count", "expand-all", "collapse-all", "highlight", "tooltip", "destroy"]
    .map(name => [name, root.querySelector(name === "panel" ? "#panel" : `.${name}`)]));
  let detailsEnabled = detailsPreference.visible;
  let panelWidth = widthPreference.width;
  let recognitionMode = recognitionPreference.mode;
  let recognitionState = {sources: [], vue: "absent", label: "DOM"};
  ui["recognition-mode"].value = recognitionMode;
  ui.panel.style.width = `${panelWidth}px`;
  let resizing = null;
  let treeRoot = null;
  let treeAnchor = null;
  let entries = [];
  let byElement = new Map();
  let selected = null;
  let hovered = null;
  let treeHovered = null;
  let scheduled = false;
  let dockPosition = null;
  let drag = null;
  let suppressLauncherClick = false;
  let collapsed = new WeakSet();
  const treeNodes = new Map();
  const outlined = new Set();
  const skip = new Set(["SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT", "TEMPLATE", "OPTION"]);
  const semantic = "main,header,footer,aside,nav,section,article,form,[role=dialog],[role=search]";
  let inspectionScope = null;
  let resizeObserver = null;
  let overlayScheduled = false;
  let cancelLauncherSuppression = null;
  const boundarySheet = new CSSStyleSheet();
  boundarySheet.replaceSync(`html[data-layscope-layout] [data-layscope-boundary] {
    outline: 1px dashed rgb(59 130 246 / 42%) !important; outline-offset: -1px !important;
  }`);

  function collect() {
    const result = [];
    const map = new Map();
    const elements = [...document.body.querySelectorAll("*")].filter(element => element !== host);
    const {info: recognized, ...summary} = recognition.scan([document.body, ...elements], recognitionMode);
    recognitionState = summary;
    ui["recognition-status"].textContent = summary.label;
    ui["recognition-status"].title = summary.label;
    for (const element of elements) {
      if (!(element instanceof HTMLElement) || element === host || skip.has(element.tagName) ||
          element.matches("input[type=hidden]") || !element.getClientRects().length) continue;
      const box = element.getBoundingClientRect();
      const css = getComputedStyle(element);
      if (!box.width || !box.height || css.visibility !== "visible" ||
          css.clip === "rect(0px, 0px, 0px, 0px)" || css.clipPath === "inset(50%)") continue;
      const info = recognized.get(element);
      if (element !== selected && !ui.dom.checked && info.kind === "DOM" && !element.matches(semantic)) {
        if (!["grid", "inline-grid", "flex", "inline-flex"].includes(css.display)) continue;
      }
      let parent = element.parentElement;
      while (parent && !map.has(parent)) parent = parent.parentElement;
      const parentEntry = map.get(parent);
      const entry = {element, ...info, parent: parentEntry, children: [], depth: parentEntry ? parentEntry.depth + 1 : 0};
      if (parentEntry) parentEntry.children.push(entry);
      result.push(entry);
      map.set(element, entry);
    }
    return {result, map};
  }

  function refresh() {
    scheduled = false;
    if (!inspectionScope) return;
    const {result, map} = collect();
    const changed = result.length !== entries.length || result.some((entry, index) => {
      const old = entries[index];
      return old.element !== entry.element || old.name !== entry.name || old.kind !== entry.kind || old.depth !== entry.depth ||
        old.parent?.element !== entry.parent?.element;
    });
    entries = result;
    byElement = map;
    if (!map.has(treeRoot)) treeRoot = null;
    if (!map.has(treeAnchor)) treeAnchor = null;
    if (changed) showAncestors(false);
    if (!byElement.has(selected)) {
      selected = null;
      resizeObserver.disconnect();
    }
    if (!byElement.has(hovered)) hovered = null;
    if (changed || !byElement.has(treeHovered)) treeHovered = null;
    for (const element of outlined) {
      if (!state.layoutVisible || !map.has(element)) {
        element.removeAttribute("data-layscope-boundary");
        outlined.delete(element);
      }
    }
    if (state.layoutVisible) {
      for (const {element} of entries) {
        element.setAttribute("data-layscope-boundary", "");
        outlined.add(element);
      }
    }
    if (state.panelOpen) {
      if (changed || treeNodes.size !== entries.length) renderTree();
      else applyTreeExpansion();
    }
    renderDetails();
    renderOverlay();
  }

  function scheduleRefresh() {
    if (!inspectionScope || scheduled) return;
    scheduled = true;
    inspectionScope.frame(refresh);
  }

  function renderTree() {
    const scrollTop = ui.tree.scrollTop;
    const list = document.createElement("ol");
    list.className = "tree-root";
    treeNodes.clear();
    for (const [index, entry] of entries.entries()) {
      const item = document.createElement("li");
      item.className = entry.children.length ? "tree-node" : "tree-node tree-leaf";
      const row = document.createElement("div");
      row.className = "tree-row";
      row.dataset.index = index;
      let toggle = null;
      let group = null;
      if (entry.children.length) {
        toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "tree-toggle";
        toggle.dataset.toggle = index;
        group = document.createElement("ol");
        group.id = `layscope-children-${index}`;
        toggle.setAttribute("aria-controls", group.id);
        toggle.append(icon("chevron"));
        row.append(toggle);
      } else {
        const spacer = document.createElement("span");
        spacer.className = "tree-spacer";
        spacer.setAttribute("aria-hidden", "true");
        row.append(spacer);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tree-label";
      button.dataset.index = index;
      button.setAttribute("aria-current", String(entry.element === selected));
      button.setAttribute("aria-label", `第 ${entry.depth + 1} 层 ${entry.name}，${entry.kind}`);
      const name = document.createElement("span");
      name.textContent = entry.name;
      const badge = document.createElement("small");
      badge.textContent = entry.kind;
      button.append(name, badge);
      row.append(button);
      item.append(row);
      if (group) item.append(group);
      if (entry.parent) treeNodes.get(entry.parent.element).group.append(item);
      else list.append(item);
      treeNodes.set(entry.element, {row, label: button, toggle, group});
    }
    const scope = treeNodes.get(treeRoot);
    if (scope) list.replaceChildren(scope.row.parentElement);
    ui.tree.replaceChildren(list);
    applyTreeExpansion();
    ui.tree.scrollTop = scrollTop;
  }

  function applyTreeExpansion() {
    if (!state.panelOpen) return;
    let visibleCount = 0;
    let branchCount = 0;
    let collapsedCount = 0;
    let viewCount = 0;
    const scope = byElement.get(treeRoot);
    for (const entry of entries) {
      entry.visible = !entry.parent || (entry.parent.visible && !collapsed.has(entry.parent.element));
      if (entry.visible) visibleCount += 1;
      entry.inView = entry.visible;
      if (scope) {
        entry.inView = entry === scope || Boolean(entry.parent?.inView && !collapsed.has(entry.parent.element));
      }
      if (entry.inView) viewCount += 1;
      const node = treeNodes.get(entry.element);
      if (!node.toggle) continue;
      branchCount += 1;
      const expanded = !collapsed.has(entry.element);
      if (!expanded) collapsedCount += 1;
      node.toggle.setAttribute("aria-expanded", String(expanded));
      node.toggle.setAttribute("aria-label", `${expanded ? "折叠" : "展开"} ${entry.name}`);
      node.group.hidden = !expanded;
    }
    ui.count.textContent = `${viewCount} / ${entries.length}`;
    ui.count.title = `当前视图 ${viewCount} 个节点；全树折叠后 ${visibleCount} 个，共 ${entries.length} 个节点`;
    ui["expand-all"].disabled = collapsedCount === 0;
    ui["collapse-all"].disabled = branchCount === collapsedCount;
    if (!byElement.get(treeHovered)?.inView) treeHovered = null;
    syncTreeContext();
    renderOverlay();
  }

  function ancestorBudget() {
    // Reserve reading room for the node name, badge and tree controls.
    return Math.max(3, Math.min(5, Math.floor((ui.panel.clientWidth - 266) / 14) + 1));
  }

  function followTree(entry, expanding = false) {
    if (!entry || !ui["auto-ancestors"].checked) return false;
    const scopeDepth = byElement.get(treeRoot)?.depth ?? 0;
    const budget = ancestorBudget();
    if (expanding && entry.depth - scopeDepth < budget - 1) return false;
    treeAnchor = entry.element;
    let ancestor = entry;
    const depth = Math.max(0, entry.depth - budget + 1);
    while (ancestor.parent && ancestor.depth > depth) ancestor = ancestor.parent;
    const next = ancestor.depth === 0 ? null : ancestor.element;
    if (next === treeRoot) return false;
    treeRoot = next;
    showAncestors(false);
    return true;
  }

  function syncTreeContext() {
    const scope = byElement.get(treeRoot);
    ui["scope-up"].hidden = !scope;
    ui["ancestors-toggle"].hidden = !scope;
    if (!scope) {
      showAncestors(false);
      return;
    }
    ui["ancestors-toggle"].textContent = `⋯ ${scope.depth}级`;
    ui["ancestors-toggle"].setAttribute("aria-label", `已收起前 ${scope.depth} 级祖先`);
    ui["ancestors-toggle"].title = `当前视图从 ${scope.name} 开始；查看已收起的祖先`;
  }

  function showAncestors(value, restoreFocus = false) {
    ui.ancestors.hidden = !value;
    ui["ancestors-toggle"].setAttribute("aria-expanded", String(value));
    ui["ancestors-list"].replaceChildren();
    if (value) {
      const path = [];
      for (let entry = byElement.get(treeRoot)?.parent; entry; entry = entry.parent) path.unshift(entry);
      for (const entry of path) {
        const button = e("button", {type: "button", "data-ancestor-index": String(entries.indexOf(entry))}, [entry.name]);
        ui["ancestors-list"].append(e("li", {}, [e("span", {"aria-hidden": "true"}, [String(entry.depth + 1)]), button]));
      }
      ui["ancestors-close"].focus({preventScroll: true});
    } else if (restoreFocus && !ui["ancestors-toggle"].hidden) {
      ui["ancestors-toggle"].focus({preventScroll: true});
    }
    syncDetails();
  }

  function navigateTree(entry) {
    treeAnchor = null;
    treeRoot = entry?.parent ? entry.element : null;
    showAncestors(false);
    renderTree();
    ui.tree.scrollTop = 0;
    renderDetails();
    const label = ui.tree.querySelector(".tree-label");
    label?.focus({preventScroll: true});
  }

  function positionDetails() {
    if (ui["details-card"].hidden) return;
    const margin = 12;
    const gap = 12;
    const width = Math.min(320, innerWidth - margin * 2);
    const panel = ui.panel.getBoundingClientRect();
    let left;
    let top = panel.top;
    let placement;
    if (panel.right + gap + width <= innerWidth - margin) {
      placement = "right";
      left = panel.right + gap;
    } else if (panel.left - gap - width >= margin) {
      placement = "left";
      left = panel.left - gap - width;
    } else {
      placement = "overlay";
      left = Math.max(margin, Math.min(panel.right - width, innerWidth - width - margin));
      top += root.querySelector(".drag-handle").getBoundingClientRect().height;
    }
    Object.assign(ui["details-card"].style, {
      left: `${left}px`, top: `${top}px`, width: `${width}px`,
      maxHeight: `${Math.min(panel.height, innerHeight - top - margin)}px`,
    });
    ui["details-card"].dataset.placement = placement;
  }

  function syncDetails() {
    const selectedEntry = byElement.has(selected);
    const visible = state.panelOpen && detailsEnabled && selectedEntry && ui.settings.hidden && ui.ancestors.hidden;
    ui["details-card"].hidden = !visible;
    ui["details-toggle"].disabled = !selectedEntry;
    ui["details-toggle"].setAttribute("aria-expanded", String(visible));
    ui["details-toggle"].setAttribute("aria-label", visible ? "收起元素详情" : "显示元素详情");
    let hint = "先选择一个页面元素";
    if (selectedEntry) hint = visible ? "收起元素详情（记住此站点偏好）" : "显示元素详情";
    ui["details-toggle"].title = hint;
    positionDetails();
  }

  function renderDetails() {
    ui.clear.disabled = !byElement.has(selected);
    for (const button of ui.tree.querySelectorAll("button[data-index]")) {
      button.setAttribute("aria-current", String(entries[Number(button.dataset.index)]?.element === selected));
    }
    const entry = byElement.get(selected);
    ui["selection-summary"].textContent = entry ? entry.name : "未选择元素";
    ui["selection-summary"].title = entry ? `${entry.name} · ${entry.kind}` : "选取页面元素或点击层级节点，查看旁侧详情";
    ui["selection-summary"].dataset.selected = String(Boolean(entry));
    if (!entry) {
      ui.details.replaceChildren();
      syncDetails();
      return;
    }
    const box = selected.getBoundingClientRect();
    const css = getComputedStyle(selected);
    function group(title, children) {
      return e("section", {class: "detail-group"}, [e("h3", {}, [title]), ...children]);
    }
    function fields(values) {
      return e("dl", {}, values.flatMap(([label, value]) => [e("dt", {}, [label]), e("dd", {}, [value])]));
    }
    const path = e("ol", {class: "path", "aria-label": "祖先路径"}, []);
    const ancestors = [];
    for (let current = entry; current; current = current.parent) ancestors.unshift(current);
    for (const [index, ancestor] of ancestors.entries()) {
      const button = e("button", {type: "button", title: ancestor.name, "aria-current": String(ancestor === entry)}, [ancestor.name]);
      button.dataset.pathIndex = entries.indexOf(ancestor);
      path.append(e("li", {}, [e("span", {class: "path-step", "aria-hidden": "true"}, [String(index + 1)]), button]));
    }
    const scrollTop = ui.details.scrollTop;
    ui.details.replaceChildren(
      group("元素名称", [e("strong", {}, [entry.name]), e("p", {class: "element-kind"}, [`<${selected.localName}> · ${entry.kind}`]), fields([["识别来源", entry.source], ...(entry.vueOwner ? [["所属组件", entry.vueOwner]] : [])])]),
      group("尺寸", [fields([["宽度", `${Math.round(box.width)} px`], ["高度", `${Math.round(box.height)} px`]])]),
      group("布局与间距", [fields([["display", css.display], ["padding", css.padding], ["margin", css.margin], ["gap", css.gap]])]),
      group("祖先路径", [path]),
    );
    ui.details.scrollTop = scrollTop;
    syncDetails();
  }

  function choose(element, scroll) {
    const treeFocused = ui.tree.contains(root.activeElement);
    if (selected !== element) ui.details.scrollTop = 0;
    selected = element;
    hovered = null;
    treeHovered = null;
    resizeObserver.disconnect();
    if (element) resizeObserver.observe(element);
    for (let ancestor = byElement.get(element)?.parent; ancestor; ancestor = ancestor.parent) {
      collapsed.delete(ancestor.element);
    }
    showAncestors(false);
    if (followTree(byElement.get(element))) renderTree();
    else applyTreeExpansion();
    if (scroll) element.scrollIntoView({block: "nearest", inline: "nearest", behavior: "instant"});
    renderDetails();
    renderOverlay();
    const label = treeNodes.get(element)?.label;
    label?.scrollIntoView({block: "nearest", inline: "nearest"});
    if (treeFocused) label?.focus({preventScroll: true});
  }

  function visibleBox(element) {
    const box = element.getBoundingClientRect();
    let left = Math.max(0, box.left);
    let top = Math.max(0, box.top);
    let right = Math.min(innerWidth, box.right);
    let bottom = Math.min(innerHeight, box.bottom);
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent);
      const parentBox = parent.getBoundingClientRect();
      if (["auto", "scroll", "hidden", "clip"].includes(css.overflowX)) {
        left = Math.max(left, parentBox.left + parent.clientLeft);
        right = Math.min(right, parentBox.left + parent.clientLeft + parent.clientWidth);
      }
      if (["auto", "scroll", "hidden", "clip"].includes(css.overflowY)) {
        top = Math.max(top, parentBox.top + parent.clientTop);
        bottom = Math.min(bottom, parentBox.top + parent.clientTop + parent.clientHeight);
      }
    }
    return {left, top, width: right - left, height: bottom - top, box};
  }

  function renderOverlay() {
    const element = treeHovered || hovered || selected;
    const entry = byElement.get(element);
    const bounds = entry && visibleBox(element);
    const visible = state.layoutVisible && bounds && bounds.width > 0 && bounds.height > 0;
    ui.highlight.hidden = !visible;
    ui.tooltip.hidden = !visible;
    if (!visible) return;
    Object.assign(ui.highlight.style, {
      left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`,
    });
    const prefix = treeHovered && treeHovered !== selected ? "预览 · " : "";
    ui.tooltip.textContent = `${prefix}${entry.name} · ${Math.round(bounds.box.width)} × ${Math.round(bounds.box.height)}`;
    ui.tooltip.style.left = `${Math.max(8, Math.min(bounds.left, innerWidth - 320))}px`;
    ui.tooltip.style.top = `${bounds.top > 36 ? bounds.top - 30 : bounds.top + 6}px`;
  }

  function clearPreview() {
    if (!hovered && !treeHovered) return;
    hovered = null;
    treeHovered = null;
    renderOverlay();
  }

  function scheduleOverlay() {
    if (!layoutScope || overlayScheduled) return;
    overlayScheduled = true;
    layoutScope.frame(() => { overlayScheduled = false; renderOverlay(); });
  }

  function renderState() {
    const launcherHidden = !state.launcherVisible;
    if (ui.launcher.hidden !== launcherHidden) {
      const box = ui.dock.getBoundingClientRect();
      stopDrag();
      ui.launcher.hidden = launcherHidden;
      if (dockPosition) moveDock(box.left, box.bottom - ui.dock.getBoundingClientRect().height);
    }
    ui["launcher-toggle"].checked = state.launcherVisible;
    ui["layout-toggle"].checked = state.layoutVisible;
    ui.pick.disabled = !state.layoutVisible;
    ui.pick.setAttribute("aria-pressed", String(state.picking));
    ui["pick-label"].textContent = state.picking ? "结束" : "选取";
    ui.pick.setAttribute("aria-label", state.picking ? "结束选择（Esc）" : "选择页面元素");
    ui.pick.title = state.layoutVisible ? "选择页面元素；Esc 结束选择" : "开启布局后可选取页面元素";
    syncDetails();
    renderOverlay();
  }

  function clearSelection() {
    selected = null;
    hovered = null;
    treeHovered = null;
    treeAnchor = null;
    resizeObserver?.disconnect();
    setPicking(false);
    renderDetails();
  }

  function moveDock(x, y) {
    const box = ui.dock.getBoundingClientRect();
    const margin = 12;
    const left = Math.max(margin, Math.min(x, innerWidth - box.width - margin));
    const top = Math.max(margin, Math.min(y, innerHeight - box.height - margin));
    dockPosition = {x: left, y: top};
    Object.assign(ui.dock.style, {left: `${left}px`, top: `${top}px`, bottom: "auto"});
    positionDetails();
  }

  function applyPanelWidth(width, origin) {
    const box = origin || ui.dock.getBoundingClientRect();
    panelWidth = width;
    ui.panel.style.width = `${width}px`;
    if (!ui.panel.hidden) {
      let left = box.left;
      if (origin?.right !== undefined) left = origin.right - ui.panel.getBoundingClientRect().width;
      moveDock(left, box.top);
      if (followTree(byElement.get(treeAnchor))) renderTree();
    }
    const maximum = Math.min(640, innerWidth - 24);
    const actual = Math.round(ui.panel.getBoundingClientRect().width || Math.min(width, maximum));
    for (const handle of [ui["resize-left"], ui["resize-right"]]) {
      handle.disabled = maximum < 320;
      handle.setAttribute("aria-valuemin", String(Math.min(320, actual)));
      handle.setAttribute("aria-valuenow", String(actual));
      handle.setAttribute("aria-valuemax", String(Math.max(actual, maximum)));
    }
    positionDetails();
  }

  function savePanelWidth(width) {
    ui["width-error"].hidden = true;
    try { widthPreference.save(width); return true; }
    catch (error) {
      if (error.code !== "WIDTH_PREFERENCE_SAVE_FAILED") throw error;
      ui["width-error"].textContent = error.message;
      ui["width-error"].hidden = false;
      return false;
    }
  }

  function stopResize() {
    if (!resizing) return;
    const previous = resizing;
    resizing = null;
    ui.panel.classList.remove("is-resizing");
    if (previous.handle.hasPointerCapture(previous.pointerId)) previous.handle.releasePointerCapture(previous.pointerId);
    applyPanelWidth(previous.width, {left: previous.left, top: previous.top});
  }

  function finishResize(event) {
    if (!resizing || event.pointerId !== resizing.pointerId) return;
    if (event.type !== "pointerup") { stopResize(); return; }
    const previous = resizing;
    if (panelWidth !== previous.width && !savePanelWidth(panelWidth)) { stopResize(); return; }
    resizing = null;
    ui.panel.classList.remove("is-resizing");
    if (previous.handle.hasPointerCapture(event.pointerId)) previous.handle.releasePointerCapture(event.pointerId);
  }

  for (const [handle, direction] of [[ui["resize-left"], -1], [ui["resize-right"], 1]]) {
    lifetime.listen(handle, "pointerdown", event => {
      if (event.button !== 0 || drag || resizing || handle.disabled) return;
      const box = ui.panel.getBoundingClientRect();
      const dock = ui.dock.getBoundingClientRect();
      resizing = {handle, pointerId: event.pointerId, x: event.clientX, actual: box.width,
        width: panelWidth, left: dock.left, top: dock.top, right: box.right};
      ui["width-error"].hidden = true;
      event.preventDefault();
      handle.focus({preventScroll: true});
      handle.setPointerCapture(event.pointerId);
    });
    lifetime.listen(handle, "pointermove", event => {
      if (!resizing || event.pointerId !== resizing.pointerId) return;
      const delta = (event.clientX - resizing.x) * direction;
      if (Math.abs(delta) < 3) return;
      let available = innerWidth - 12 - resizing.left;
      if (direction < 0) available = resizing.right - 12;
      const width = Math.max(320, Math.min(640, Math.floor(available), Math.round(resizing.actual + delta)));
      const origin = {left: resizing.left, top: resizing.top};
      if (direction < 0) origin.right = resizing.right;
      ui.panel.classList.add("is-resizing");
      applyPanelWidth(width, origin);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) lifetime.listen(handle, type, finishResize);
    lifetime.listen(handle, "keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const step = event.shiftKey ? 40 : 10;
      const sign = event.key === "ArrowRight" ? 1 : -1;
      const dock = ui.dock.getBoundingClientRect();
      const panel = ui.panel.getBoundingClientRect();
      let available = innerWidth - 12 - dock.left;
      if (direction < 0) available = panel.right - 12;
      const width = Math.max(320, Math.min(640, Math.floor(available), Math.round(panel.width) + sign * direction * step));
      const origin = {left: dock.left, top: dock.top};
      if (direction < 0) origin.right = panel.right;
      if (savePanelWidth(width)) applyPanelWidth(width, origin);
    });
    lifetime.listen(handle, "dblclick", () => {
      if (savePanelWidth(350)) applyPanelWidth(350);
    });
  }

  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const {handle, moved} = drag;
    drag = null;
    ui.dock.classList.remove("is-dragging");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (moved && handle === ui.launcher && event.type === "pointerup") {
      suppressLauncherClick = true;
      // The click generated by this pointerup must not also toggle the panel.
      cancelLauncherSuppression?.();
      cancelLauncherSuppression = lifetime.timeout(() => {
        suppressLauncherClick = false;
        cancelLauncherSuppression = null;
      }, 0);
    }
  }

  for (const handle of [root.querySelector(".drag-handle"), ui.launcher]) {
    lifetime.listen(handle, "pointerdown", event => {
      if (event.button !== 0 || drag || resizing || event.target.closest("button, input, label")) return;
      const box = ui.dock.getBoundingClientRect();
      drag = {handle, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        left: box.left, top: box.top, moved: false};
      event.preventDefault();
      handle.focus({preventScroll: true});
      handle.setPointerCapture(event.pointerId);
    });
    lifetime.listen(handle, "pointermove", event => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      ui.dock.classList.add("is-dragging");
      moveDock(drag.left + dx, drag.top + dy);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      lifetime.listen(handle, type, finishDrag);
    }
  }

  lifetime.listen(root.querySelector(".drag-handle"), "keydown", event => {
    if (event.target !== event.currentTarget) return;
    const delta = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 10;
    const box = ui.dock.getBoundingClientRect();
    moveDock(box.left + delta[0] * step, box.top + delta[1] * step);
  });

  function setVisible(value) {
    const previousBox = ui.dock.getBoundingClientRect();
    ui.panel.hidden = !value;
    ui.launcher.setAttribute("aria-expanded", String(value));
    if (dockPosition) moveDock(previousBox.left, previousBox.bottom - ui.dock.getBoundingClientRect().height);
    applyPanelWidth(panelWidth);
    syncDetails();
  }

  function stopDrag() {
    stopResize();
    if (drag) {
      const {handle, pointerId} = drag;
      drag = null;
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    }
    ui.dock.classList.remove("is-dragging");
    cancelLauncherSuppression?.();
    cancelLauncherSuppression = null;
    suppressLauncherClick = false;
  }

  function cleanBoundaries() {
    document.documentElement.removeAttribute("data-layscope-layout");
    for (const element of outlined) element.removeAttribute("data-layscope-boundary");
    for (const element of document.querySelectorAll("[data-layscope-boundary]")) {
      element.removeAttribute("data-layscope-boundary");
    }
    outlined.clear();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== boundarySheet);
  }

  function pageElement(event) {
    if (event.composedPath().includes(host)) return null;
    let element = event.target;
    while (element instanceof Element && !byElement.has(element)) element = element.parentElement;
    return byElement.has(element) ? element : null;
  }

  lifetime.listen(ui.launcher, "click", event => {
    if (suppressLauncherClick) {
      event.preventDefault();
      return;
    }
    toggle();
  });
  function showSettings(value, restoreFocus = false) {
    if (value) showAncestors(false);
    ui.settings.hidden = !value;
    ui.more.setAttribute("aria-expanded", String(value));
    syncDetails();
    if (value) ui["launcher-toggle"].focus({preventScroll: true});
    else if (restoreFocus) ui.more.focus({preventScroll: true});
  }

  function setDetailsVisible(value, restoreFocus = false) {
    ui["details-error"].hidden = true;
    try { detailsPreference.save(value); }
    catch (error) {
      if (error.code !== "DETAILS_PREFERENCE_SAVE_FAILED") throw error;
      ui["details-error"].textContent = error.message;
      ui["details-error"].hidden = false;
      return;
    }
    detailsEnabled = value;
    syncDetails();
    if (value && !ui["details-card"].hidden) ui.details.focus({preventScroll: true});
    else if (restoreFocus) ui["details-toggle"].focus({preventScroll: true});
  }
  lifetime.listen(ui.more, "click", () => showSettings(ui.settings.hidden));
  lifetime.listen(ui["recognition-mode"], "change", () => {
    const mode = ui["recognition-mode"].value;
    ui["recognition-error"].hidden = true;
    try { recognitionPreference.save(mode); }
    catch (error) {
      if (error.code !== "RECOGNITION_PREFERENCE_SAVE_FAILED") throw error;
      ui["recognition-error"].textContent = error.message;
      ui["recognition-error"].hidden = false;
      ui["recognition-mode"].value = recognitionMode;
      return;
    }
    recognitionMode = mode;
    hovered = null;
    treeHovered = null;
    if (inspectionScope) refresh();
  });
  lifetime.listen(document, "pointerdown", event => {
    const path = event.composedPath();
    if (!ui.settings.hidden && !path.includes(ui.settings) && !path.includes(ui.more)) showSettings(false);
    if (!ui.ancestors.hidden && !path.includes(ui.ancestors) && !path.includes(ui["ancestors-toggle"])) showAncestors(false);
  }, true);
  lifetime.listen(document, "keydown", event => {
    if (!ui.settings.hidden && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      showSettings(false, true);
    } else if (!ui.ancestors.hidden && event.key === "Escape" && !state.picking) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showAncestors(false, true);
    } else if (event.key === "Escape" && !state.picking && !ui["details-card"].hidden && event.composedPath().includes(host)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setDetailsVisible(false, true);
    }
  }, true);
  lifetime.listen(ui["details-toggle"], "click", () => setDetailsVisible(!detailsEnabled));
  lifetime.listen(ui["details-close"], "click", () => setDetailsVisible(false, true));
  lifetime.listen(ui["ancestors-toggle"], "click", () => showAncestors(ui.ancestors.hidden));
  lifetime.listen(ui["ancestors-close"], "click", () => showAncestors(false, true));
  lifetime.listen(ui["scope-up"], "click", () => navigateTree(byElement.get(treeRoot)?.parent));
  lifetime.listen(ui["tree-top"], "click", () => navigateTree(null));
  lifetime.listen(ui["auto-ancestors"], "change", () => {
    showAncestors(false);
    if (ui["auto-ancestors"].checked) followTree(byElement.get(treeAnchor || selected));
    else treeRoot = null;
    renderTree();
    renderDetails();
  });
  lifetime.listen(ui.close, "click", close);
  lifetime.listen(ui.destroy, "click", destroy);
  lifetime.listen(ui.pick, "click", () => setPicking(!state.picking));
  lifetime.listen(ui.clear, "click", clearSelection);
  lifetime.listen(ui.dom, "change", refresh);
  lifetime.listen(ui["layout-toggle"], "change", () => setLayout(ui["layout-toggle"].checked));
  lifetime.listen(ui["launcher-toggle"], "change", () => {
    ui["preference-error"].hidden = true;
    try { setLauncher(ui["launcher-toggle"].checked); }
    catch (error) {
      if (error.code !== "LAUNCHER_PREFERENCE_SAVE_FAILED") throw error;
      ui["launcher-toggle"].checked = state.launcherVisible;
      ui["preference-error"].textContent = error.message;
      ui["preference-error"].hidden = false;
    }
  });
  lifetime.listen(window, "resize", () => {
    stopResize();
    applyPanelWidth(panelWidth);
    if (dockPosition) moveDock(dockPosition.x, dockPosition.y);
    else positionDetails();
  });

  let layoutScope = null;
  return {
    renderState,
    startInspection(scope) {
      inspectionScope = scope;
      resizeObserver = scope.observe(new ResizeObserver(scheduleOverlay));
      const observer = scope.observe(new MutationObserver(scheduleRefresh));
      observer.observe(document.body, {subtree: true, childList: true, attributes: true,
        attributeFilter: ["class", "style", "hidden", "open", "data-state", "data-slot", "data-layout-component", "data-kivo-component"]});
      scope.listen(window, "resize", scheduleRefresh);
      refresh();
    },
    stopInspection() {
      selected = null;
      hovered = null;
      treeHovered = null;
      treeRoot = null;
      treeAnchor = null;
      showAncestors(false);
      resizeObserver = null;
      scheduled = false;
      inspectionScope = null;
      entries = [];
      byElement.clear();
      treeNodes.clear();
      ui.tree.replaceChildren();
      ui.count.textContent = "";
      renderDetails();
    },
    showLayout(scope) {
      layoutScope = scope;
      scope.cleanup(cleanBoundaries);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, boundarySheet];
      document.documentElement.setAttribute("data-layscope-layout", "");
      scope.listen(document, "pointermove", event => {
        const element = pageElement(event);
        if (element !== hovered) { hovered = element; renderOverlay(); }
      }, {passive: true});
      scope.listen(document, "pointerout", event => {
        if (event.relatedTarget === null) clearPreview();
      }, {capture: true, passive: true});
      scope.listen(window, "blur", clearPreview);
      scope.listen(document, "visibilitychange", () => {
        if (document.hidden) clearPreview();
      });
      for (const type of ["pointerdown", "click"]) {
        scope.listen(document, type, event => {
          if (!state.picking || event.composedPath().includes(host)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const element = pageElement(event);
          if (type === "click" && element) choose(element, false);
        }, true);
      }
      scope.listen(document, "keydown", event => {
        if (state.picking && event.key === "Escape") {
          event.preventDefault(); event.stopImmediatePropagation(); setPicking(false);
        }
      }, true);
      scope.listen(document, "scroll", scheduleOverlay, {capture: true, passive: true});
      refresh();
    },
    hideLayout() {
      layoutScope = null;
      overlayScheduled = false;
      hovered = null;
      treeHovered = null;
      renderOverlay();
    },
    showPanel(scope) {
      setVisible(true);
      scope.listen(ui.tree, "click", event => {
        const toggle = event.target.closest("button[data-toggle]");
        if (toggle) {
          const entry = entries[Number(toggle.dataset.toggle)];
          const focused = root.activeElement === toggle;
          let changed = false;
          if (collapsed.has(entry.element)) {
            collapsed.delete(entry.element);
            changed = followTree(entry, true);
          } else collapsed.add(entry.element);
          if (changed) renderTree();
          else applyTreeExpansion();
          if (focused) treeNodes.get(entry.element)?.toggle?.focus({preventScroll: true});
          return;
        }
        const button = event.target.closest("button[data-index]");
        if (button) choose(entries[Number(button.dataset.index)].element, true);
      });
      scope.listen(ui["expand-all"], "click", () => {
        collapsed = new WeakSet();
        treeRoot = null;
        treeAnchor = null;
        renderTree();
      });
      scope.listen(ui["collapse-all"], "click", () => {
        for (const entry of entries) {
          if (entry.children.length) collapsed.add(entry.element);
        }
        treeRoot = null;
        treeAnchor = null;
        renderTree();
      });
      scope.listen(ui["ancestors-list"], "click", event => {
        const button = event.target.closest("button[data-ancestor-index]");
        if (button) navigateTree(entries[Number(button.dataset.ancestorIndex)]);
      });
      scope.listen(ui.tree, "pointermove", event => {
        if (event.pointerType === "touch") return;
        const row = event.target.closest(".tree-row");
        const element = row ? entries[Number(row.dataset.index)].element : null;
        if (element !== treeHovered) {
          treeHovered = element;
          renderOverlay();
        }
      });
      scope.listen(ui.tree, "pointerleave", () => {
        treeHovered = null;
        renderOverlay();
      });
      scope.listen(ui.details, "click", event => {
        const button = event.target.closest("button[data-path-index]");
        if (button) {
          choose(entries[Number(button.dataset.pathIndex)].element, true);
          ui.details.querySelector('[aria-current="true"]')?.focus({preventScroll: true});
        }
      });
      refresh();
    },
    hidePanel() {
      showAncestors(false);
      showSettings(false);
      ui["details-error"].hidden = true;
      ui["width-error"].hidden = true;
      setVisible(false);
      stopDrag();
      clearSelection();
      treeHovered = null;
      treeNodes.clear();
      ui.tree.replaceChildren();
      ui.count.textContent = "";
      renderOverlay();
    },
    destroy() {
      stopDrag();
      cleanBoundaries();
      selected = null;
      hovered = null;
      treeHovered = null;
      treeRoot = null;
      treeAnchor = null;
      entries = [];
      byElement.clear();
      treeNodes.clear();
      root.replaceChildren();
    },
    status() {
      return {nodes: entries.length, visibleNodes: entries.filter(entry => entry.visible).length,
        recognition: {mode: recognitionMode, sources: recognitionState.sources, vue: recognitionState.vue},
        selection: byElement.get(selected)?.name ?? null,
        preview: byElement.get(treeHovered || hovered)?.name ?? null};
    },
  };
}
