import {readFile, readdir, mkdtemp, writeFile, cp, rm, rename} from "node:fs/promises";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {join} from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const args = process.argv.slice(2);
const version = pkg.version;
if (args.length > 1) throw new Error("Usage: npm run package -- [vX.Y.Z]");
if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) ||
    version.split(".").some(part => Number(part) > 65535) || version === "0.0.0") {
  throw new Error("Release version must be X.Y.Z with components between 0 and 65535, not all zero; prereleases are not supported.");
}
const tag = `v${version}`;
if (args.length === 1 && args[0] !== tag) throw new Error(`Release tag must match package.json: expected ${tag}.`);
if (lock.version !== version || lock.packages?.[""]?.version !== version) {
  throw new Error("package-lock.json version must match package.json.");
}

// Rebuild from source so a release never includes a stale local installation.
execFileSync(process.execPath, [join(root, "scripts/build.mjs")], {cwd: root, stdio: "inherit"});
const dist = join(root, "dist");
const stage = await mkdtemp(join(dist, ".release-"));

async function filesIn(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(join(directory, prefix), {withFileTypes: true})) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(directory, path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported release entry: ${path}`);
  }
  return files.sort();
}

try {
  const assets = [];
  for (const adapter of ["chromium", "codex"]) {
    const directory = join(dist, adapter);
    const filename = `layscope-${adapter}-${tag}.zip`;
    // Only adapter output goes into each ZIP; metadata stays at the archive root.
    execFileSync("zip", ["-q", "-X", join(stage, filename), ...await filesIn(directory)], {cwd: directory});
    execFileSync("unzip", ["-tq", join(stage, filename)], {stdio: "pipe"});
    assets.push(filename);
  }
  await cp(join(dist, "build.json"), join(stage, "build.json"));
  assets.push("build.json");
  const checksums = [];
  for (const filename of assets.sort()) {
    const hash = createHash("sha256").update(await readFile(join(stage, filename))).digest("hex");
    checksums.push(`${hash}  ${filename}`);
  }
  await writeFile(join(stage, "SHA256SUMS.txt"), checksums.join("\n") + "\n");
  await rm(join(dist, "release"), {recursive: true, force: true});
  await rename(stage, join(dist, "release"));
  console.log(`Packaged ${tag} → ${join(dist, "release")}`);
} finally {
  await rm(stage, {recursive: true, force: true});
}
