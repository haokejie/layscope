import {readFile, mkdir, writeFile, cp, rm} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {dispatchInspector} from "../packages/core/runtime.js";
import {createView} from "../packages/core/view.js";
import {createRecognition} from "../packages/core/recognition.js";
import {dispatchAutoLoad} from "../adapters/chromium/auto-command.js";

const base = new URL("../", import.meta.url);
const {version} = JSON.parse(await readFile(new URL("package.json", base), "utf8"));
const css = await readFile(new URL("packages/core/inspector.css", base), "utf8");
const view = `function(context) { return (${createView.toString()})(context, (${createRecognition.toString()})()); }`;
const source = `(function layScope(command = "open", options = {}) {\nreturn (${dispatchInspector.toString()})(${view}, ${JSON.stringify(css)}, command, options, ${JSON.stringify(version)});\n})`;
const hash = createHash("sha256").update(source).digest("hex");
for (const adapter of ["chromium", "codex"]) {
  const target = new URL(`dist/${adapter}/`, base);
  await rm(target, {recursive: true, force: true});
  await mkdir(target, {recursive: true});
  await cp(new URL(`adapters/${adapter}/`, base), target, {recursive: true});
  await cp(new URL("LICENSE", base), new URL("LICENSE", target));
  const metadataFile = adapter === "chromium" ? "manifest.json" : "plugin.json";
  const metadata = JSON.parse(await readFile(new URL(metadataFile, target), "utf8"));
  await writeFile(new URL(metadataFile, target), JSON.stringify({...metadata, version}, null, 2) + "\n");
  if (adapter === "chromium") {
    await writeFile(new URL("version.js", target), `export const version = ${JSON.stringify(version)};\n`);
    await writeFile(new URL("core.js", target), `export const layScope = ${source};\n`);
    await writeFile(new URL("auto.js", target), `export const autoLoadInspector = function(expectedURL, defaultLayoutVisible) {\nreturn (${dispatchAutoLoad.toString()})(${source}, expectedURL, defaultLayoutVisible);\n};\n`);
  } else {
    const assets = new URL("skills/layscope/assets/", target);
    await mkdir(assets, {recursive: true});
    await writeFile(new URL("core-function.js", assets), source);
  }
}
await writeFile(new URL("dist/build.json", base), JSON.stringify({version, coreSha256: hash}, null, 2) + "\n");
console.log(`Built shared core ${hash.slice(0, 12)} → ${fileURLToPath(new URL("dist/", base))}`);
