import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile, readdir, writeFile, mkdir, mkdtemp, cp, rm} from "node:fs/promises";
import {createHash} from "node:crypto";
import {execFileSync, spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {join} from "node:path";
import {tmpdir} from "node:os";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const tag = `v${pkg.version}`;
const packageScript = join(root, "scripts/package.mjs");
const release = join(root, "dist/release");
const runPackage = (...args) => execFileSync(process.execPath, [packageScript, ...args], {cwd: root});
const fromZip = (archive, file) => execFileSync("unzip", ["-p", archive, file], {encoding: "utf8"});

test("release downloads contain installable roots, the shared core, MIT and valid checksums", async () => {
  runPackage(tag);
  const filenames = ["build.json", "SHA256SUMS.txt", `layscope-chromium-${tag}.zip`, `layscope-codex-${tag}.zip`].sort();
  assert.deepEqual((await readdir(release)).sort(), filenames);
  const license = await readFile(join(root, "LICENSE"), "utf8");
  const core = await readFile(join(root, "dist/codex/skills/layscope/assets/core-function.js"), "utf8");
  for (const adapter of ["chromium", "codex"]) {
    const archive = join(release, `layscope-${adapter}-${tag}.zip`);
    execFileSync("unzip", ["-tq", archive]);
    const entries = execFileSync("unzip", ["-Z1", archive], {encoding: "utf8"}).trim().split("\n");
    assert.ok(entries.every(path => !path.startsWith("/") && !path.split("/").includes("..")));
    assert.ok(entries.every(path => !/^(test|node_modules|\.git|\.codex|adapters|dist)\//.test(path)));
    assert.equal(fromZip(archive, "LICENSE"), license);
    const metadataFile = adapter === "chromium" ? "manifest.json" : "plugin.json";
    const metadata = JSON.parse(fromZip(archive, metadataFile));
    assert.equal(metadata.version, pkg.version);
    if (adapter === "chromium") {
      assert.equal(fromZip(archive, "core.js"), `export const layScope = ${core};\n`);
      for (const file of [metadata.action.default_popup, metadata.background.service_worker, metadata.options_ui.page]) {
        assert.ok(entries.includes(file), `missing extension entry point ${file}`);
      }
    } else {
      assert.equal(metadata.name, "layscope");
      assert.equal(fromZip(archive, "skills/layscope/assets/core-function.js"), core);
      assert.ok(entries.includes("skills/layscope/SKILL.md"));
    }
    const builtFiles = (await readdir(join(root, "dist", adapter), {recursive: true, withFileTypes: true}))
      .filter(entry => entry.isFile())
      .map(entry => join(entry.parentPath, entry.name).slice(join(root, "dist", adapter).length + 1).replaceAll("\\", "/"));
    assert.deepEqual(entries.sort(), builtFiles.sort(), "the entire adapter output must be included");
  }
  const build = JSON.parse(await readFile(join(release, "build.json"), "utf8"));
  assert.equal(build.version, pkg.version);
  assert.equal(build.coreSha256, createHash("sha256").update(core).digest("hex"));
  const sums = (await readFile(join(release, "SHA256SUMS.txt"), "utf8")).trim().split("\n");
  assert.equal(sums.length, 3);
  for (const line of sums) {
    const [hash, filename] = line.split("  ");
    assert.equal(hash, createHash("sha256").update(await readFile(join(release, filename))).digest("hex"));
  }
  assert.deepEqual(sums.map(line => line.split("  ")[1]).sort(), filenames.filter(file => file !== "SHA256SUMS.txt"));
});

test("invalid tags fail before replacing downloads; rebuilding removes stale release assets", async () => {
  const previous = await readFile(join(release, "SHA256SUMS.txt"), "utf8");
  for (const badTag of ["v99999.0.0", pkg.version, `${tag}-rc.1`]) {
    const result = spawnSync(process.execPath, [packageScript, badTag], {cwd: root, encoding: "utf8"});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Release tag must match package.json/);
    assert.equal(await readFile(join(release, "SHA256SUMS.txt"), "utf8"), previous);
  }
  await writeFile(join(release, "stale.zip"), "old version");
  runPackage();
  assert.equal((await readdir(release)).includes("stale.zip"), false);
  assert.equal((await readdir(join(root, "dist"))).some(name => name.startsWith(".release-")), false);
});

test("version and lockfile validation reject inconsistent or unsupported releases", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "layscope-release-test-"));
  try {
    await mkdir(join(fixture, "scripts"));
    await cp(packageScript, join(fixture, "scripts/package.mjs"));
    const cases = [
      {version: "0.8.1-rc.1", lockVersion: "0.8.1-rc.1", message: /prereleases are not supported/},
      {version: "65536.0.0", lockVersion: "65536.0.0", message: /components between 0 and 65535/},
      {version: "0.0.0", lockVersion: "0.0.0", message: /not all zero/},
      {version: pkg.version, lockVersion: "0.0.0", message: /package-lock.json version must match/}
    ];
    for (const item of cases) {
      await writeFile(join(fixture, "package.json"), JSON.stringify({version: item.version}));
      await writeFile(join(fixture, "package-lock.json"), JSON.stringify({version: item.lockVersion, packages: {"": {version: item.lockVersion}}}));
      const result = spawnSync(process.execPath, [join(fixture, "scripts/package.mjs")], {encoding: "utf8"});
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, item.message);
    }
  } finally {
    await rm(fixture, {recursive: true, force: true});
  }
});
