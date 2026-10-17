import {layScope as core} from "/core.js";
import {observeResources} from "/probe.js";

const {createApp, h, ref, Teleport, nextTick, createStaticVNode} = window.Vue;
const dynamic = ref(false);
const clicks = ref(0);
const NamedCard = {name: "NamedCard", setup: () => () => h("article", {id: "named-card"}, [h("h2", "Vue 命名组件"), h("button", {id: "vue-business", onClick: () => clicks.value++}, `业务点击 ${clicks.value}`)])};
const MarkedCard = {name: "VueMarkedCard", setup: () => () => h("article", {id: "marked-vue", "data-layout-component": "TemplCard"}, [h("h2", "显式组件标记优先"), h("form", [h("input", {placeholder: "组件内输入框"})])])};
const FragmentCard = {name: "FragmentCard", setup: () => () => [h("header", {id: "fragment-first"}, "多根节点 A"), h("article", {id: "fragment-second"}, "多根节点 B")]};
const TeleportCard = {name: "TeleportCard", setup: () => () => h(Teleport, {to: "#teleport-target"}, h("aside", {id: "teleported"}, "由 Vue 组件渲染，DOM 位于独立挂载区"))};
const InferredCard = {__name: "InferredCard", setup: () => () => h("section", {id: "inferred-card"}, "SFC 推断名称")};
const AnonymousCard = {setup: () => () => h("article", {id: "anonymous-card"}, "无名称元数据")};
const StaticCard = {__name: "StaticCard", setup: () => () => createStaticVNode('<header id="static-first">编译器静态根 A</header><article id="static-second">编译器静态根 B</article>', 2)};
const DynamicCard = {name: "DynamicCard", setup: () => () => h("article", {id: "dynamic-card"}, "动态挂载组件")};
const App = {name: "VueWorkspace", setup: () => () => h("section", {id: "vue-workspace"}, [
  h("h2", "Vue 工作区"), h(NamedCard), h(MarkedCard), h(FragmentCard), h(InferredCard), h(AnonymousCard), h(StaticCard), h(TeleportCard),
  h("button", {id: "toggle-dynamic", onClick: () => { dynamic.value = !dynamic.value; }}, "切换动态组件"),
  dynamic.value ? h(DynamicCard) : null,
])};
createApp(App).mount("#vue-app");
const development = !location.pathname.includes("production");
const check = (condition, message) => { if (!condition) throw new Error(message); };
const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
document.querySelector("#show-inspector").addEventListener("click", () => core("open"));
document.querySelector("#recognition-audit").addEventListener("click", async () => {
  core("destroy");
  const baseline = resources();
  const keys = ["recognitionMode", "launcherVisible", "detailsVisible"];
  const preferences = keys.map(key => [key, localStorage.getItem(`layscope.${key}`)]);
  const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
  const owner = document.querySelector("#named-card").__vueParentComponent;
  const output = document.querySelector("#recognition-result");
  try {
    localStorage.setItem("layscope.recognitionMode", "auto");
    localStorage.setItem("layscope.detailsVisible", "true");
    core("load", {layoutVisible: true, launcherVisible: false}); core("open");
    let root = document.querySelector("layscope-inspector").shadowRoot;
    const names = () => [...root.querySelectorAll(".tree-label > span")].map(element => element.textContent);
    const label = name => [...root.querySelectorAll(".tree-label")].find(element => element.querySelector("span").textContent === name);
    const mode = async value => {
      if (root.querySelector(".settings").hidden) root.querySelector(".more").click();
      const select = root.querySelector(".recognition-mode"); select.value = value; select.dispatchEvent(new Event("change"));
      root.querySelector(".more").click(); await settle();
    };
    check(core("status").recognition.vue === (development ? "available" : "unavailable"), "Incorrect Vue availability");
    check(names().includes("TemplCard") && names().includes("LegacyCard") && !names().includes("VueMarkedCard"), "Explicit markers lost priority");
    if (development) {
      check(names().includes("NamedCard") && names().includes("InferredCard") && names().includes("匿名 Vue 组件"), "Vue names missing");
      check(names().filter(name => name === "FragmentCard").length === 2, "Fragment roots not recognized");
      check(names().filter(name => name === "StaticCard").length === 2 && !document.querySelector("#static-first").__vueParentComponent, "Compiled static roots without DOM metadata were not recognized");
      check(label("TeleportCard").closest("li").parentElement.closest("li").querySelector(".tree-label > span").textContent === "section#teleport-target", "Teleport was moved into a fabricated component tree");
    } else check(root.querySelector(".recognition-status").title.includes("组件信息不可用"), "Production metadata absence was hidden");
    label("TemplCard").click();
    if (development) check(root.querySelector(".details").textContent.includes("VueMarkedCard"), "Vue ownership missing from details");
    label("TemplCard").parentElement.querySelector(".tree-toggle").click();
    const width = root.querySelector("#panel").getBoundingClientRect().width;
    await mode("dom");
    check(!names().includes("TemplCard") && !names().includes("LegacyCard") && !names().includes("NamedCard"), "DOM mode retained component names");
    check(core("status").selection === "article#marked-vue" && core("status").layoutVisible && core("status").panelOpen, "Mode switch changed selection or visual state");
    check(label("article#marked-vue").parentElement.querySelector(".tree-toggle").getAttribute("aria-expanded") === "false", "Mode switch lost fold state");
    check(root.querySelector("#panel").getBoundingClientRect().width === width && !root.querySelector(".details-card").hidden, "Mode switch changed width/details preference");
    await mode("auto");
    check(core("status").selection === "TemplCard" && label("TemplCard").parentElement.querySelector(".tree-toggle").getAttribute("aria-expanded") === "false", "Returning to automatic mode lost selection/fold state");
    await mode("dom");
    core("destroy"); core("open"); root = document.querySelector("layscope-inspector").shadowRoot;
    check(core("status").recognition.mode === "dom" && !names().includes("TemplCard"), "DOM mode preference was not restored");
    await mode("auto");
    core("set-layout", {layoutVisible: true});
    document.querySelector("#toggle-dynamic").click(); await nextTick(); await settle();
    check(Boolean(document.querySelector("#dynamic-card")) && (!development || names().includes("DynamicCard")), "Dynamic mount was not recognized");
    document.querySelector("#toggle-dynamic").click(); await nextTick(); await settle();
    check(!document.querySelector("#dynamic-card") && !names().includes("DynamicCard"), "Removed component was retained");
    const beforeClick = clicks.value; document.querySelector("#vue-business").click(); await nextTick(); await settle();
    check(clicks.value === beforeClick + 1, "Inspector intercepted business click");
    const nativeSet = Storage.prototype.setItem;
    root.querySelector(".more").click();
    try {
      Storage.prototype.setItem = function(key, value) {
        if (key === "layscope.recognitionMode") throw new DOMException("fixture quota", "QuotaExceededError");
        return nativeSet.call(this, key, value);
      };
      const select = root.querySelector(".recognition-mode"); select.value = "dom"; select.dispatchEvent(new Event("change"));
      check(select.value === "auto" && core("status").recognition.mode === "auto" && !root.querySelector(".recognition-error").hidden, "Failed mode save changed recognition or hid the error");
    } finally { Storage.prototype.setItem = nativeSet; }
    check(window.__VUE_DEVTOOLS_GLOBAL_HOOK__ === hook && document.querySelector("#named-card").__vueParentComponent === owner, "Inspector mutated the Vue runtime");
    core("destroy"); await settle();
    check(JSON.stringify(resources()) === JSON.stringify(baseline), `Recognition resources leaked: ${JSON.stringify(resources())}`);
    output.textContent = `通过：${development ? "Vue 3 开发版组件名、多根与 Teleport" : "Vue 3 生产版明确提示组件信息不可用"}；标记优先、仅 DOM 记忆、选择／折叠／详情保持、动态更新、保存失败及完整清理。`;
  } catch (error) { core("destroy"); output.textContent = `失败：${error.message}`; }
  finally {
    dynamic.value = false;
    for (const [key, value] of preferences) {
      if (value === null) localStorage.removeItem(`layscope.${key}`);
      else localStorage.setItem(`layscope.${key}`, value);
    }
  }
});
const resources = observeResources();
