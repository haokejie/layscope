// Download test runtimes only; no dependency is installed into this project.
import {mkdir, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";

const cache = join(tmpdir(), "layscope-vue-3.5.22");
const response = await fetch("https://registry.npmjs.org/vue/-/vue-3.5.22.tgz");
if (!response.ok) throw new Error(`Vue fixture download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const expected = "toaZjQ3a/G/mYaLSbV+QsQhIdMo9x5rrqIpYRObsJ6T/J+RyCSFwN2LHNVH9v8uIcljDNa3QzPVdv3Y6b9hAJQ==";
if (createHash("sha512").update(bytes).digest("base64") !== expected) throw new Error("Vue fixture integrity mismatch.");
await mkdir(cache, {recursive: true});
const archive = join(cache, "vue.tgz");
await writeFile(archive, bytes);
execFileSync("tar", ["-xzf", archive, "-C", cache, "package/dist/vue.runtime.global.js", "package/dist/vue.runtime.global.prod.js", "package/LICENSE"]);
console.log(`Vue 3.5.22 development/production fixtures ready: ${cache}`);
