import {test} from "node:test";
import assert from "node:assert/strict";
import {executeCore, inspectPage} from "../adapters/chromium/page-command.js";
import {createContext, runInContext} from "node:vm";

test("core commands run only in MAIN and are pinned to the inspected document", async () => {
  const calls = [];
  const api = {scripting: {async executeScript(options) {
    calls.push(options);
    if (options.func === inspectPage) return [{documentId: "document-1", result: {url: "https://example.com/", ready: true}}];
    return [{result: {state: "absent"}}];
  }}};
  function core() {}
  for (const command of ["status", "load", "destroy"]) {
    await executeCore(api, core, 7, command);
    const [snapshot, injection] = calls.splice(0);
    assert.equal(snapshot.world, "ISOLATED");
    assert.equal(injection.world, "MAIN");
    assert.deepEqual(injection.target, {tabId: 7, documentIds: ["document-1"]});
    assert.equal(injection.func, core);
  }
});

test("missing document identity prevents injection; navigation failures are propagated", async () => {
  let calls = 0;
  const api = {scripting: {async executeScript() { calls++; return [{result: {ready: true}}]; }}};
  await assert.rejects(executeCore(api, () => {}, 7, "load"), /页面标识/);
  assert.equal(calls, 1);
  api.scripting.executeScript = async ({target}) => {
    if (target.documentIds) throw new Error("document no longer exists");
    return [{documentId: "old-document", result: {ready: true}}];
  };
  await assert.rejects(executeCore(api, () => {}, 7, "load"), /document no longer exists/);
});

test("page identity inspection never reads an isolated runtime registry", () => {
  const isolated = createContext({location: {href: "https://example.com/"}, document: {readyState: "complete"}});
  runInContext('Object.defineProperty(globalThis, "__layScopeV1__", {get() { throw new Error("registry accessed"); }});', isolated);
  const result = runInContext(`(${inspectPage.toString()})()`, isolated);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {url: "https://example.com/", ready: true});
});
