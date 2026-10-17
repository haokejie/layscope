import {test} from "node:test";
import assert from "node:assert/strict";
import {createRecognition} from "../packages/core/recognition.js";

class FixtureElement {
  constructor(tag = "div", attributes = {}) { this.localName = tag; this.attributes = attributes; this.id = attributes.id || ""; }
  getAttribute(name) { return this.attributes[name] ?? null; }
}
const app = {version: "3.5.22"};
function instance(name, element, parent = null) {
  const value = {type: {name}, subTree: {type: element.localName, el: element}, appContext: {app}, parent};
  element.__vueParentComponent = value;
  return value;
}
globalThis.Element = FixtureElement;

test("explicit and legacy markers win over Vue; ordinary nodes retain their rendering owner", () => {
  const marked = new FixtureElement("article", {"data-layout-component": "TemplCard"});
  const legacy = new FixtureElement("section", {"data-kivo-component": "LegacyCard"});
  const inner = new FixtureElement("input");
  inner.__vueParentComponent = instance("VueCard", marked);
  instance("OtherVueCard", legacy);
  const result = createRecognition().scan([marked, legacy, inner], "auto");
  assert.equal(result.info.get(marked).name, "TemplCard");
  assert.equal(result.info.get(legacy).name, "LegacyCard");
  assert.deepEqual(result.info.get(inner), {name: "input", kind: "DOM", source: "DOM", vueOwner: "VueCard"});
  assert.deepEqual(result.sources, ["组件标记", "Vue 3"]);
});

test("DOM mode does not access markers or framework internals", () => {
  const element = new FixtureElement("button", {id: "save"});
  element.getAttribute = () => { throw new Error("marker accessed"); };
  Object.defineProperty(element, "__vueParentComponent", {get() { throw new Error("runtime accessed"); }});
  const result = createRecognition().scan([element], "dom");
  assert.deepEqual(result.info.get(element), {name: "button#save", kind: "DOM", source: "DOM", vueOwner: null});
  assert.equal(result.vue, "disabled");
});

test("fragment and teleport roots are named independently without inventing DOM parents", () => {
  const first = new FixtureElement("header"), second = new FixtureElement("article"), teleported = new FixtureElement("aside");
  const fragment = instance("FragmentCard", first);
  fragment.subTree = {type: Symbol("fragment"), children: [{type: "header", el: first}, {type: "article", el: second}]};
  second.__vueParentComponent = fragment;
  const teleport = instance("TeleportCard", teleported);
  teleport.subTree = {type: {__isTeleport: true}, children: [{type: "aside", el: teleported}]};
  const result = createRecognition().scan([first, second, teleported], "auto");
  assert.equal(result.info.get(first).name, "FragmentCard");
  assert.equal(result.info.get(second).name, "FragmentCard");
  assert.equal(result.info.get(teleported).name, "TeleportCard");
  assert.equal(Object.hasOwn(result.info.get(teleported), "parent"), false);
});

test("inferred names and source filenames are used only when provided; anonymous names are explicit", () => {
  const elements = [new FixtureElement(), new FixtureElement(), new FixtureElement()];
  const types = [{__name: "InferredCard"}, {__file: "/src/SourceCard.vue"}, {}];
  elements.forEach((element, index) => { instance("", element).type = Object.freeze(types[index]); });
  const result = createRecognition().scan(elements, "auto");
  assert.deepEqual(elements.map(element => result.info.get(element).name), ["InferredCard", "SourceCard", "匿名 Vue 组件"]);
});

test("Vue 3 without development metadata is reported as unavailable, not as a fabricated component", () => {
  const root = new FixtureElement(); root.__vue_app__ = app;
  const result = createRecognition().scan([root], "auto");
  assert.equal(result.vue, "unavailable");
  assert.equal(result.info.get(root).kind, "DOM");
  assert.match(result.label, /组件信息不可用/);
});

test("rescans do not retain removed roots or mutate Vue instances", () => {
  const element = new FixtureElement();
  const owner = instance("OriginalCard", element);
  Object.freeze(owner.subTree); Object.freeze(owner);
  const recognition = createRecognition();
  assert.equal(recognition.scan([element], "auto").info.get(element).name, "OriginalCard");
  delete element.__vueParentComponent;
  assert.equal(recognition.scan([element], "auto").info.get(element).kind, "DOM");
  assert.equal(recognition.scan([], "auto").info.size, 0);
});

test("marker conflicts remain errors in automatic mode", () => {
  const node = new FixtureElement("div", {"data-layout-component": "One", "data-kivo-component": "Two"});
  assert.throws(() => createRecognition().scan([node], "auto"), /Conflicting/);
  assert.equal(createRecognition().scan([node], "dom").info.get(node).kind, "DOM");
});

test("compiled static ranges are discovered through the app VNodes without DOM instance markers", () => {
  const mount = new FixtureElement(), outer = new FixtureElement("section");
  const first = new FixtureElement("header"), second = new FixtureElement("article");
  first.nextSibling = second;
  const child = {type: {__name: "StaticCard"}, subTree: {type: Symbol.for("v-stc"), el: first, anchor: second}, appContext: {app}};
  const root = {type: {name: "App"}, subTree: {type: "section", el: outer, children: [{component: child}]}, appContext: {app}};
  child.parent = root;
  mount.__vue_app__ = {...app, _instance: root};
  const result = createRecognition().scan([mount, outer, first, second], "auto");
  assert.equal(result.info.get(first).name, "StaticCard");
  assert.equal(result.info.get(second).name, "StaticCard");
  assert.equal(first.__vueParentComponent, undefined);
});
