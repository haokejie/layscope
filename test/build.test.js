import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";

test("both adapters package exactly the same executable core", async () => {
  execFileSync(process.execPath, ["scripts/build.mjs"], {cwd: fileURLToPath(new URL("../", import.meta.url))});
  const read = filename => readFile(new URL(`../dist/${filename}`, import.meta.url), "utf8");
  const codex = await read("codex/skills/layscope/assets/core-function.js");
  const chromium = await read("chromium/core.js");
  assert.equal(chromium, `export const layScope = ${codex};\n`);
  const metadata = JSON.parse(await read("build.json"));
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const license = await readFile(new URL("../LICENSE", import.meta.url), "utf8");
  assert.equal(pkg.name, "layscope");
  assert.equal(pkg.license, "MIT");
  assert.equal(metadata.version, pkg.version);
  assert.equal(await read("chromium/version.js"), `export const version = ${JSON.stringify(pkg.version)};\n`);
  assert.equal(metadata.coreSha256, createHash("sha256").update(codex).digest("hex"));
  const extension = JSON.parse(await read("chromium/manifest.json"));
  assert.equal(extension.manifest_version, 3);
  assert.equal(extension.version, pkg.version);
  assert.equal(extension.name, "LayScope — Layout & Component Inspector");
  assert.equal(extension.short_name, "LayScope");
  assert.equal(extension.action.default_title, "LayScope");
  assert.equal(extension.key, undefined);
  assert.deepEqual(extension.permissions, ["activeTab", "scripting", "storage"]);
  assert.equal(extension.host_permissions, undefined);
  assert.deepEqual(extension.optional_host_permissions, ["http://*/*", "https://*/*"]);
  assert.equal(extension.background.type, "module");
  assert.deepEqual(extension.options_ui, {page:"rules.html", open_in_tab:true});
  for (const file of ["rules.html", "rules-page.js", "rules-page.css", "ui.css", "popup-model.js", "page-command.js"]) {
    assert.ok((await read(`chromium/${file}`)).length > 0, `missing manager resource ${file}`);
  }
  assert.equal((await read("chromium/popup.html")).includes('<details'), false, "the popup must not contain a collapsible rule editor");
  const auto = await read("chromium/auto.js");
  assert.ok(auto.includes(codex), "automatic loading serializes the same shared core");
  assert.equal(extension.content_scripts, undefined, "non-matching pages need no resident content script");
  execFileSync(process.execPath, ["--input-type=module", "-e", `
    let listeners = 0;
    const event = {addListener() { listeners++; }};
    globalThis.chrome = {runtime: {onMessage: event, getURL: path => "chrome-extension://test/" + path}, tabs: {onUpdated: event, onRemoved: event}};
    await import('./dist/chromium/background.js');
    if (listeners !== 3) throw new Error('background entry did not register all handlers');
  `], {cwd: fileURLToPath(new URL("../", import.meta.url))});
  const plugin = JSON.parse(await read("codex/plugin.json"));
  assert.equal(plugin.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(plugin.version, extension.version);
  assert.equal(plugin.name, "layscope");
  assert.equal(plugin.license, "MIT");
  assert.equal(plugin.extensions["com.openai"].interface.displayName, "LayScope");
  assert.match(await read("codex/skills/layscope/SKILL.md"), /^name: layscope$/m);
  assert.match(await read("codex/skills/layscope/agents/openai.yaml"), /display_name: "LayScope"/);
  for (const adapter of ["chromium", "codex"]) assert.equal(await read(`${adapter}/LICENSE`), license);
});
