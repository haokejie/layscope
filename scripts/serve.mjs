import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
const root = new URL("../", import.meta.url);
const routes = new Map([
  ["/", ["test/fixture.html", "text/html"]],
  ["/fixture.js", ["test/fixture.js", "text/javascript"]],
  ["/probe.js", ["test/probe.js", "text/javascript"]],
  ["/vue/", ["test/vue-fixture.html", "text/html"]],
  ["/vue-production/", ["test/vue-fixture.html", "text/html"]],
  ["/vue-fixture.js", ["test/vue-fixture.js", "text/javascript"]],
  ["/vue-fixture.css", ["test/vue-fixture.css", "text/css"]],
  ...["vue.runtime.global.js", "vue.runtime.global.prod.js"].map((file, index) =>
    [index ? "/vue-runtime.prod.js" : "/vue-runtime.js", [join(tmpdir(), "layscope-vue-3.5.22", "package/dist", file), "text/javascript"]]),
  ["/core.js", ["dist/chromium/core.js", "text/javascript"]],
  ["/popup-preview.js", ["test/popup-preview.js", "text/javascript"]],
  ["/rules-preview.js", ["test/rules-preview.js", "text/javascript"]],
  ["/extension-preview.js", ["test/extension-preview.js", "text/javascript"]],
  ["/rules/", ["dist/chromium/rules.html", "text/html"]],
  ["/popup/", ["dist/chromium/popup.html", "text/html"]],
  ...["ui.css", "rules-page.css", "rules-page.js", "rules.js", "rules-client.js", "version.js"].map(file =>
    [`/rules/${file}`, [`dist/chromium/${file}`, file.endsWith(".css") ? "text/css" : "text/javascript"]]),
  ...["ui.css", "popup-model.js", "rules-page.css", "rules-page.js", "popup.css", "popup.js", "core.js", "rules.js", "rules-client.js", "page-command.js", "version.js", "settings-store.js", "automation.js", "background-controller.js"].map(file =>
    [`/popup/${file}`, [`dist/chromium/${file}`, file.endsWith(".css") ? "text/css" : "text/javascript"]]),
]);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const route = routes.get(pathname);
  res.setHeader("Cache-Control", "no-store");
  const policies = ["/vue/", "/vue-production/"].includes(pathname) ? "vue" : "'none'";
  res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'self'; style-src 'self'; frame-src 'self'; connect-src 'none'; img-src 'none'; require-trusted-types-for 'script'; trusted-types ${policies}`);
  if (!route) { res.writeHead(404).end(); return; }
  try {
    res.setHeader("Content-Type", `${route[1]}; charset=utf-8`);
    let body = await readFile(new URL(route[0], root));
    if (pathname === "/vue-production/") body = body.toString().replace('src="/vue-runtime.js"', 'src="/vue-runtime.prod.js"');
    if (route[0] === "dist/chromium/popup.html") body = body.toString().replace('src="popup.js"', 'src="/popup-preview.js"');
    if (route[0] === "dist/chromium/rules.html") body = body.toString().replace('src="rules-page.js"', 'src="/rules-preview.js"');
    res.end(body);
  }
  catch (error) { console.error(error); res.writeHead(500).end("Build the project before opening the fixture."); }
});
server.listen(8094, "127.0.0.1", () => console.log("Fixture: http://127.0.0.1:8094"));
