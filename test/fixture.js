import {layScope} from "/core.js";
import {observeResources} from "/probe.js";
let clicks = 0;
document.querySelector("main").addEventListener("click", event => {
  if (!event.target.closest("#business")) return;
  document.querySelector("#clicks").textContent = `业务点击：${++clicks}`;
});
const check = (condition, message) => { if (!condition) throw new Error(message); };
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const cleanMarkers = () => !document.querySelector("[data-layscope-boundary], [data-layscope-layout]");
const status = () => layScope("status");
const checkBranchLines = root => {
  const close = (actual, expected, message) => check(Math.abs(actual - expected) < 1, `${message}: ${actual} / ${expected}`);
  for (const toggle of root.querySelectorAll(".tree-toggle")) {
    if (!toggle.getClientRects().length) continue;
    const control = toggle.getBoundingClientRect();
    const arrow = toggle.firstElementChild.getBoundingClientRect();
    close(arrow.left + arrow.width / 2, control.left + control.width / 2, "Tree arrow is not horizontally centered");
    close(arrow.top + arrow.height / 2, control.top + control.height / 2, "Tree arrow is not vertically centered");
  }
  for (const group of root.querySelectorAll(".tree-node > ol")) {
    if (!group.getClientRects().length) continue;
    const parentControl = group.parentElement.querySelector(".tree-toggle").getBoundingClientRect();
    const first = group.firstElementChild;
    const firstBox = first.getBoundingClientRect();
    const start = getComputedStyle(first, "::before");
    close(firstBox.top + parseFloat(start.top), parentControl.top + parentControl.height / 2, "Parent/first-child stem is disconnected");
    close(firstBox.left + parseFloat(start.left), parentControl.left + parentControl.width / 2, "Child stem is not aligned with its parent control");
    const last = group.lastElementChild;
    const lastBox = last.getBoundingClientRect();
    const lastRow = last.querySelector(".tree-row").getBoundingClientRect();
    const end = getComputedStyle(last, "::before");
    close(lastBox.bottom - parseFloat(end.bottom), lastRow.top + lastRow.height / 2, "Last sibling stem extends through its descendants");
    for (const node of group.children) {
      if (!node.querySelector(":scope > .tree-row > .tree-spacer")) continue;
      const horizontal = getComputedStyle(node, "::after");
      const box = node.getBoundingClientRect();
      const spacer = node.querySelector(".tree-spacer").getBoundingClientRect();
      close(box.left + parseFloat(horizontal.left) + parseFloat(horizontal.width), spacer.left + spacer.width / 2, "Leaf connector does not end at its reserved control center");
    }
  }
  for (const node of root.querySelectorAll(".tree-root > .tree-node")) {
    const content = getComputedStyle(node, "::before").content;
    check(content === "none" || content === "normal", "Rebased root retained an ancestor connector");
  }
};
document.querySelector("#audit").addEventListener("click", async () => {
  const result = document.querySelector("#result");
  layScope("destroy");
  const baseline = document.querySelector("main").getBoundingClientRect().toJSON();
  const sheets = document.adoptedStyleSheets.length;
  const resources = resourceStatus();
  try {
    for (let index = 0; index < 20; index += 1) {
      const layoutVisible = index % 2 === 0;
      const loaded = layScope("load", {layoutVisible});
      check(!loaded.panelOpen && loaded.layoutVisible === layoutVisible && !loaded.picking, "Silent load state incorrect");
      layScope("load", {layoutVisible: !layoutVisible});
      check(status().layoutVisible === layoutVisible, "Repeat load changed layout");
      layScope("open"); layScope("open");
      check(document.querySelectorAll("layscope-inspector").length === 1, "Duplicate host");
      check(status().panelOpen && status().layoutVisible === layoutVisible && !status().picking, "Panel open changed layout or picking");
      check(JSON.stringify(document.querySelector("main").getBoundingClientRect().toJSON()) === JSON.stringify(baseline), "Inspector changed page layout");
      const closed = layScope("close");
      check(!closed.panelOpen && closed.layoutVisible === layoutVisible && closed.resources.panel === null, "Panel close changed layout or retained resources");
      check(Boolean(closed.resources.layout) === layoutVisible && Boolean(closed.resources.inspection) === layoutVisible, "Inspection scope has wrong ownership");
      layScope("set-layout", {layoutVisible: false});
      check(status().resources.inspection === null && cleanMarkers(), "Both hidden retained inspection/markers");
      layScope("toggle");
      layScope("destroy"); layScope("destroy");
      check(!document.querySelector("layscope-inspector") && !Object.hasOwn(window, "__layScopeV1__"), "Destroy leaked instance");
      check(document.adoptedStyleSheets.length === sheets && cleanMarkers(), "Leaked boundary styles");
      check(JSON.stringify(resourceStatus()) === JSON.stringify(resources), `Resource leak: ${JSON.stringify(resourceStatus())}`);
      await settle();
    }
    check(JSON.stringify(baseline) === JSON.stringify(document.querySelector("main").getBoundingClientRect().toJSON()), "Page layout changed");
    result.textContent = "通过：20 轮面板／布局四种组合、重复加载和完整移除；页面尺寸不变，节点、样式、监听器、观察器和回调均无残留。";
  } catch (error) { layScope("destroy"); result.textContent = `失败：${error.message}`; }
});
document.querySelector("#features").addEventListener("click", async () => {
  const output = document.querySelector("#feature-result");
  layScope("destroy");
  const before = resourceStatus();
  const sheets = document.adoptedStyleSheets.length;
  const launcherPreference = localStorage.getItem("layscope.launcherVisible");
  const detailsPreference = localStorage.getItem("layscope.detailsVisible");
  try {
    localStorage.setItem("layscope.detailsVisible", "true");
    const field = document.querySelector("input");
    field.focus();
    layScope("load", {launcherVisible: true});
    check(document.activeElement === field && !status().panelOpen && !status().picking && cleanMarkers(), "Quiet load altered focus/visuals");
    let root = document.querySelector("layscope-inspector").shadowRoot;
    const section = document.querySelector("[data-layout-component=ProjectList]");
    const business = () => document.querySelector("#business");
    const treeButton = () => [...root.querySelectorAll(".tree-label")].find(button => button.textContent.includes("ProjectList"));
    const normalClick = () => { const count = clicks; business().click(); check(clicks === count + 1, "Business click was intercepted"); };
    normalClick();
    layScope("open");
    check(document.activeElement === field && !status().layoutVisible && root.querySelector(".pick").disabled, "Open changed focus/layout");
    const treeHeight = () => root.querySelector(".tree").getBoundingClientRect().height;
    const originalTreeHeight = treeHeight();
    check(root.querySelector(".controls").getBoundingClientRect().height <= 48, "Toolbar expanded beyond one row");
    check(treeButton(), "Optional metadata not recognized");
    checkBranchLines(root);
    treeButton().click();
    check(status().selection === "ProjectList" && root.querySelector(".highlight").hidden, "Hidden layout lost details or showed highlight");
    check(!root.querySelector(".details-card").hidden && Math.abs(treeHeight() - originalTreeHeight) < 1, "Side details reduced the hierarchy viewport");
    check(root.querySelectorAll(".detail-group").length === 4, "Details groups missing");
    const savedDetails = localStorage.getItem("layscope.detailsVisible");
    root.querySelector(".more").click();
    check(root.querySelector(".details-card").hidden, "Settings competed with the details overlay");
    root.querySelector(".more").click();
    check(!root.querySelector(".details-card").hidden && localStorage.getItem("layscope.detailsVisible") === savedDetails, "Settings overwrote the details preference");
    const scrollTop = root.querySelector(".tree").scrollTop;
    root.querySelector(".details-close").click();
    check(root.querySelector(".details-card").hidden && root.querySelector(".tree").scrollTop === scrollTop, "Closing details changed hierarchy scroll");
    treeButton().click();
    check(root.querySelector(".details-card").hidden, "Selection ignored explicit dismissal");
    layScope("destroy");
    layScope("open");
    root = document.querySelector("layscope-inspector").shadowRoot;
    treeButton().click();
    check(root.querySelector(".details-card").hidden, "New instance forgot dismissed details");
    root.querySelector(".details-toggle").click();
    check(!root.querySelector(".details-card").hidden && !root.querySelector(".tree-page").hidden && Math.abs(treeHeight() - originalTreeHeight) < 1 && !status().layoutVisible, "Details toggle changed layout or hierarchy size");
    check(root.activeElement === root.querySelector(".details"), "Explicit details open did not focus its scroll area");
    const businessEscape = new KeyboardEvent("keydown", {bubbles: true, cancelable: true, key: "Escape"});
    document.body.dispatchEvent(businessEscape);
    check(!businessEscape.defaultPrevented && !root.querySelector(".details-card").hidden, "Details intercepted a business Escape");
    root.querySelector(".details").dispatchEvent(new KeyboardEvent("keydown", {bubbles: true, composed: true, key: "Escape"}));
    check(root.querySelector(".details-card").hidden, "Details Escape did not close the side card");
    root.querySelector(".details-toggle").click();
    normalClick();
    root.querySelector(".layout-toggle").click();
    check(status().panelOpen && status().layoutVisible && !status().picking, "Layout switch changed panel or picking");
    check(getComputedStyle(section).outlineStyle === "dashed", "Boundary styles failed under CSP");
    const hiddenBoundaries = document.querySelectorAll("[data-layscope-boundary]").length;
    root.querySelector(".more").click();
    check(!root.querySelector(".settings").hidden && Math.abs(treeHeight() - originalTreeHeight) < 1, "Settings resized the hierarchy");
    root.querySelector(".launcher-toggle").click();
    check(root.querySelector(".launcher").hidden && status().panelOpen && status().layoutVisible && !status().launcherVisible, "Hiding launcher changed panel/layout");
    layScope("close");
    check(root.querySelector(".launcher").hidden && !status().panelOpen && status().layoutVisible, "Close restored hidden launcher");
    normalClick();
    document.dispatchEvent(new KeyboardEvent("keydown", {bubbles: true, altKey: true, shiftKey: true, code: "KeyL"}));
    check(status().panelOpen && !status().launcherVisible && !root.querySelector("#panel").hidden, "Shortcut could not reopen without launcher");
    check(document.querySelectorAll("[data-layscope-boundary]").length === hiddenBoundaries, "Launcher switch changed boundaries");
    root.querySelector(".more").click();
    root.querySelector(".launcher-toggle").click();
    check(!root.querySelector(".launcher").hidden && status().launcherVisible, "Launcher could not be restored");
    document.dispatchEvent(new KeyboardEvent("keydown", {bubbles: true, key: "Escape"}));
    check(root.querySelector(".settings").hidden, "Escape did not dismiss settings");
    root.querySelector(".pick").click();
    const previous = clicks;
    business().click();
    check(clicks === previous && status().picking, "Explicit picking did not intercept business click");
    root.querySelector(".layout-toggle").click();
    check(!status().picking && cleanMarkers() && root.querySelector(".highlight").hidden, "Layout off retained interception/markers");
    check(status().nodes > 0 && status().selection, "Layout off cleared panel details");
    normalClick();
    root.querySelector(".layout-toggle").click();
    root.querySelector(".clear").click();
    treeButton().dispatchEvent(new PointerEvent("pointermove", {bubbles: true, pointerType: "mouse"}));
    check(status().preview === "ProjectList" && status().selection === null && !root.querySelector(".highlight").hidden, "Tree preview failed");
    check(root.querySelector(".details-card").hidden, "Hover opened side details");
    document.dispatchEvent(new PointerEvent("pointerout", {bubbles: true, relatedTarget: null}));
    check(status().preview === null && root.querySelector(".highlight").hidden && root.querySelector(".tooltip").hidden, "Leaving the page retained tree preview");
    treeButton().click();
    check(!root.querySelector(".details-card").hidden, "Selection did not restore enabled side details");
    const selectedDetails = root.querySelector(".details").textContent;
    document.querySelector("main").dispatchEvent(new PointerEvent("pointermove", {bubbles: true, pointerType: "mouse"}));
    check(status().preview === "Workspace" && status().selection === "ProjectList", "Page hover changed fixed selection");
    window.dispatchEvent(new Event("blur"));
    check(status().preview === null && status().selection === "ProjectList" && !root.querySelector(".highlight").hidden && root.querySelector(".tooltip").textContent.startsWith("ProjectList · "), "Window blur did not restore the fixed highlight");
    check(root.querySelector(".details").textContent === selectedDetails && !root.querySelector(".details-card").hidden, "Window blur changed fixed details");
    root.querySelector(".path button").click();
    check(status().selection === "Workspace", "Ancestor path did not locate the parent");
    treeButton().click();
    root.querySelector(".collapse-all").click();
    check(status().visibleNodes < status().nodes && status().selection === "ProjectList", "Collapse changed fixed selection");
    root.querySelector(".expand-all").click();
    check(status().visibleNodes === status().nodes, "Expand failed");
    root.querySelector(".clear").click();
    check(status().selection === null && status().preview === null && root.querySelector(".highlight").hidden, "Clear retained overlay");
    const namedCount = status().nodes;
    root.querySelector(".dom").click();
    check(status().nodes > namedCount, "Plain DOM switch failed");
    root.querySelector(".pick").click();
    layScope("close");
    check(!status().panelOpen && status().layoutVisible && !status().picking && status().resources.panel === null, "Close changed enabled layout");
    check(root.querySelector(".tree").children.length === 0 && root.querySelector(".highlight").hidden && root.querySelector(".details-card").hidden, "Close retained transient panel preview/details");
    normalClick();
    section.dispatchEvent(new PointerEvent("pointermove", {bubbles: true, pointerType: "mouse"}));
    check(status().preview === "ProjectList" && !root.querySelector(".tooltip").hidden, "Passive hover failed with panel closed");
    section.dispatchEvent(new PointerEvent("pointerout", {bubbles: true, relatedTarget: business()}));
    check(status().preview === "ProjectList", "Movement inside the page cleared preview prematurely");
    document.dispatchEvent(new PointerEvent("pointerout", {bubbles: true, relatedTarget: null}));
    check(status().preview === null && root.querySelector(".highlight").hidden && root.querySelector(".tooltip").hidden, "Leaving the page retained passive hover with panel closed");
    section.dispatchEvent(new PointerEvent("pointermove", {bubbles: true, pointerType: "mouse"}));
    window.dispatchEvent(new Event("blur"));
    check(status().preview === null && root.querySelector(".highlight").hidden, "Window blur retained passive hover");
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    try {
      Object.defineProperty(document, "hidden", {configurable: true, value: true});
      section.dispatchEvent(new PointerEvent("pointermove", {bubbles: true, pointerType: "mouse"}));
      document.dispatchEvent(new Event("visibilitychange"));
      check(status().preview === null && root.querySelector(".highlight").hidden, "Hiding the document retained passive hover");
    } finally {
      if (hiddenDescriptor) Object.defineProperty(document, "hidden", hiddenDescriptor);
      else delete document.hidden;
    }
    const replacement = section.cloneNode(true);
    section.replaceWith(replacement);
    await settle();
    check(!section.hasAttribute("data-layscope-boundary") && replacement.hasAttribute("data-layscope-boundary"), "Closed panel stopped boundary updates");
    check(status().selection === null, "Detached selection retained");
    layScope("open");
    check(treeButton(), "Tree did not refresh on reopen");
    layScope("set-layout", {layoutVisible: false});
    layScope("close");
    check(document.adoptedStyleSheets.length === sheets && status().nodes === 0 && status().resources.inspection === null && cleanMarkers(), "Both hidden retained page references/styles");
    layScope("open");
    document.querySelector("layscope-inspector").remove();
    await settle();
    check(status().state === "absent", "Detached host not cleaned");
    normalClick();
    check(JSON.stringify(resourceStatus()) === JSON.stringify(before), `Feature interactions leaked resources: ${JSON.stringify(resourceStatus())}`);
    output.textContent = "通过：侧挂详情与层级并行、收起偏好持久、悬浮不打开详情；面板／布局／选取独立，业务点击、DOM 替换与资源清理正常。";
  } catch (error) { layScope("destroy"); output.textContent = `失败：${error.message}`; }
  finally {
    if (launcherPreference === null) localStorage.removeItem("layscope.launcherVisible");
    else localStorage.setItem("layscope.launcherVisible", launcherPreference);
    if (detailsPreference === null) localStorage.removeItem("layscope.detailsVisible");
    else localStorage.setItem("layscope.detailsVisible", detailsPreference);
  }
});
document.querySelector("#hierarchy-audit").addEventListener("click", async () => {
  const output = document.querySelector("#hierarchy-result");
  layScope("destroy");
  const before = resourceStatus();
  const keys = ["panelWidth", "detailsVisible", "launcherVisible"];
  const preferences = keys.map(name => [name, localStorage.getItem(`layscope.${name}`)]);
  const fixture = document.createElement("section");
  const levels = [];
  let parent = fixture;
  for (let depth = 1; depth <= 30; depth += 1) {
    const node = document.createElement("div");
    node.setAttribute("data-layout-component", `Deep${depth}`);
    parent.append(node); levels.push(node); parent = node;
  }
  const leaf = document.createElement("button"); leaf.textContent = "深层业务按钮"; parent.append(leaf);
  const retained = document.createElement("aside");
  retained.setAttribute("data-layout-component", "RetainedBranch");
  const retainedLeaf = document.createElement("div");
  retainedLeaf.setAttribute("data-layout-component", "RetainedLeaf"); retainedLeaf.textContent = "保留折叠分支";
  retained.append(retainedLeaf); levels[11].append(retained);
  document.body.append(fixture);
  try {
    localStorage.setItem("layscope.panelWidth", "350");
    localStorage.setItem("layscope.detailsVisible", "true");
    layScope("load", {layoutVisible: true, launcherVisible: false}); layScope("open");
    let root = document.querySelector("layscope-inspector").shadowRoot;
    const label = name => [...root.querySelectorAll(".tree-label")].find(button => button.querySelector("span").textContent === name);
    const toggle = name => label(name)?.parentElement.querySelector(".tree-toggle");
    const viewRoot = () => root.querySelector(".tree-root > .tree-node > .tree-row > .tree-label span").textContent;
    const folds = () => [...root.querySelectorAll(".tree-toggle")].map(button => [button.getAttribute("aria-label"), button.getAttribute("aria-expanded")]);
    toggle("RetainedBranch").click();
    const originalFolds = JSON.stringify(folds());
    const treeHeight = root.querySelector(".tree").getBoundingClientRect().height;
    label("Deep24").click();
    checkBranchLines(root);
    check(viewRoot() !== "Deep1" && root.querySelector(".ancestors-toggle").textContent.includes("级"), "Deep selection did not hide distant ancestors");
    check(status().selection === "Deep24" && !root.querySelector(".details-card").hidden && root.querySelectorAll(".path li").length >= 24, "Auto ancestors changed selection/details path");
    const selectedDetails = root.querySelector(".details").textContent;
    toggle("Deep26").click();
    checkBranchLines(root);
    const scopeBeforeExpand = viewRoot();
    toggle("Deep26").click();
    check(viewRoot() !== scopeBeforeExpand && status().selection === "Deep24" && label("Deep24").getAttribute("aria-current") === "true", "Deep expansion did not advance scope independently or lost selected row styling");
    checkBranchLines(root);
    check(root.querySelector(".details").textContent === selectedDetails, "Expansion changed selected details");
    const scopeBeforeHover = viewRoot();
    label("Deep28").dispatchEvent(new PointerEvent("pointermove", {bubbles: true, pointerType: "mouse"}));
    check(viewRoot() === scopeBeforeHover && status().selection === "Deep24" && status().preview === "Deep28", "Hover moved hierarchy scope/selection");
    root.querySelector(".ancestors-toggle").click();
    check(root.querySelector(".details-card").hidden && root.querySelector(".tree").getBoundingClientRect().height === treeHeight, "Ancestor path competed with details or shrank tree");
    [...root.querySelectorAll(".ancestors-list button")].find(button => button.textContent === "Deep10").click();
    check(viewRoot() === "Deep10" && status().selection === "Deep24" && !root.querySelector(".details-card").hidden, "Ancestor navigation changed selected element/details preference");
    root.querySelector(".scope-up").click();
    check(viewRoot() === "Deep9" && status().selection === "Deep24", "Parent navigation changed selection");
    root.querySelector(".ancestors-toggle").click(); root.querySelector(".tree-top").click();
    check(root.querySelector(".ancestors-toggle").hidden && JSON.stringify(folds()) === originalFolds, "Scope navigation rewrote fold state");
    checkBranchLines(root);
    label("Deep24").click();
    const widthBefore = root.querySelector("#panel").getBoundingClientRect().width;
    root.querySelector(".resize-right").dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight", bubbles: true}));
    check(root.querySelector("#panel").getBoundingClientRect().width === widthBefore + 10 && localStorage.getItem("layscope.panelWidth") === "360", "Right resize was not persisted");
    root.querySelector(".drag-handle").dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight", shiftKey: true, bubbles: true}));
    const rightBefore = root.querySelector("#panel").getBoundingClientRect().right;
    root.querySelector(".resize-left").dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowLeft", bubbles: true}));
    check(root.querySelector("#panel").getBoundingClientRect().width === widthBefore + 20 && Math.abs(root.querySelector("#panel").getBoundingClientRect().right - rightBefore) < 1, "Left resize did not retain the right edge");
    check(status().selection === "Deep24" && root.querySelector(".details").textContent === selectedDetails && root.querySelector(".tree").getBoundingClientRect().height === treeHeight, "Width changed selection/details/tree height");
    checkBranchLines(root);
    const originalSetItem = Storage.prototype.setItem;
    try {
      Storage.prototype.setItem = function (key, value) {
        if (key === "layscope.panelWidth") throw new DOMException("fixture quota", "QuotaExceededError");
        return originalSetItem.call(this, key, value);
      };
      root.querySelector(".resize-right").dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowRight", bubbles: true}));
      check(!root.querySelector(".width-error").hidden && root.querySelector("#panel").getBoundingClientRect().width === 370 && localStorage.getItem("layscope.panelWidth") === "370", "Failed width save changed the actual/preferred width or hid the error");
    } finally { Storage.prototype.setItem = originalSetItem; }
    root.querySelector(".details-close").click();
    layScope("destroy"); layScope("load"); layScope("open");
    root = document.querySelector("layscope-inspector").shadowRoot;
    check(root.querySelector("#panel").getBoundingClientRect().width === 370, "New instance forgot preferred width");
    label("Deep24").click();
    check(root.querySelector(".details-card").hidden, "Width restoration overwrote dismissed details");
    root.querySelector(".clear").click();
    check(status().selection === null && root.querySelector(".details-card").hidden, "Clear retained selection/details");
    levels[19].remove(); await settle();
    check(root.querySelector(".ancestors-toggle").hidden, "Detached hierarchy root was retained");
    layScope("destroy"); fixture.remove(); await settle();
    check(JSON.stringify(resourceStatus()) === JSON.stringify(before), `Hierarchy/resize resources leaked: ${JSON.stringify(resourceStatus())}`);
    output.textContent = "通过：深层选择／展开自动收起祖先，悬浮与返回不改写选择或折叠；左右调宽、宽度记忆、详情独立和清理正常。";
  } catch (error) {
    layScope("destroy"); fixture.remove(); output.textContent = `失败：${error.message}`;
  } finally {
    for (const [name, value] of preferences) {
      if (value === null) localStorage.removeItem(`layscope.${name}`);
      else localStorage.setItem(`layscope.${name}`, value);
    }
  }
});
const resourceStatus = observeResources();
