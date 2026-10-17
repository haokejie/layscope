# LayScope

[简体中文](README.md) | **English**

**A browser extension for inspecting page layouts and component structure.**

LayScope runs directly on the page. Explore component boundaries, the rendered DOM hierarchy, element dimensions and spacing without adding a debugging UI to your application. It ships as a **Chrome / Edge extension** and a **Codex Browser plugin**, both using the same inspection core.

## Features

- Show layout boundaries, preview elements on hover, pick elements, and clear selections.
- Browse a collapsible hierarchy with branch guides. Deep selections can temporarily hide distant ancestors while preserving navigation back up.
- Drag the panel, resize its width, and inspect element details alongside the tree.
- Control the panel, layout overlay, and floating launcher independently. Remember launcher visibility, panel width, details visibility, and recognition mode per site.
- Automatically recognize explicit component markers and available Vue 3 metadata, with a DOM-only mode.
- Automatically load on chosen pages or path patterns in Chrome / Edge. Manage rules in a separate page.
- Remove the instance and release its nodes, styles, listeners, observers, and scheduled callbacks.

## Choose an integration

| Integration | Where it runs | Entry point | Automatic loading |
| --- | --- | --- | --- |
| Chrome / Edge extension | HTTP(S) pages in the browser | Browser toolbar → LayScope | Supported through page rules |
| Codex plugin | Codex's built-in Browser | Ask Codex to use LayScope | Explicit loading within a conversation |

The Codex plugin requires a browser tool with a CDP capability. It is a separate integration, not a Chromium extension installed inside Codex Browser. Inspecting a page does not require adding a package or script to that page's application.

## Build from source

Requirements: Node.js **22 or later** and npm. The repository pins its development versions in [.nvmrc](.nvmrc) and [package.json](package.json).

Clone the source and enter the project directory:

```sh
git clone https://github.com/haokejie/layscope.git
cd layscope

# Optional: select the pinned version when using nvm
nvm use
npm ci
npm run build
npm test
```

The project has no npm runtime or development dependencies. Builds produce:

| Path | Contents |
| --- | --- |
| `dist/chromium/` | Unpacked Chrome / Edge extension, including its MIT license |
| `dist/codex/` | Codex plugin, bundled skill and shared core, including its MIT license |
| `dist/build.json` | Version and shared-core SHA-256 |

Installation currently uses local builds; this repository does not provide a browser-store installation link or a public plugin-directory listing.

## Install in Chrome / Edge

1. Open `chrome://extensions` in Chrome, or `edge://extensions` in Edge.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose `dist/chromium/` from this repository.
4. Open the HTTP(S) page you want to inspect, then click **LayScope** in the browser toolbar. Pin it if convenient.

Chrome / Edge 106 or later is required. The current interface is in Chinese; the controls below include their visible labels.

### Everyday use

| Control | Behavior |
| --- | --- |
| Panel (`面板`) | Open or collapse the inspector without changing the layout overlay |
| Layout (`显示布局`) | Toggle boundaries and element highlights; opening the panel does not enable it |
| Floating launcher (`悬浮入口`) | Show or hide the in-page entry; visibility is remembered per origin |
| Pick (`选取`) | Select an element on the page; requires both panel and layout to be enabled |
| Clear (`清除选择`) | Clear the fixed selection |
| Details (`详情`) | Show or collapse dimensions, display, spacing, recognition source and ancestor path |
| Settings → Recognition (`组件识别`) | Switch between automatic recognition (`自动`) and DOM only (`仅 DOM`) |
| Remove (`移除` / `完全移除`) | Remove this page's instance without deleting rules or saved preferences |

**Alt + Shift + L** opens or collapses a loaded inspector, including when the launcher is hidden. Drag the panel header to move it and either side edge to resize it. The shortcut does not inject LayScope into a page where no instance has been loaded.

### Load automatically on chosen pages

Enable **This page loads automatically** (`此页面自动加载`) in the toolbar popup and approve access to that host. Automatic loading keeps the panel collapsed. **Show layout by default** (`默认显示布局`) controls the initial overlay for the next instance; it does not change the current one.

Use **Manage page rules** (`管理页面规则`) for the full searchable rule list, including add, enable/disable, default layout, reauthorization and deletion.

| Pattern | Matches |
| --- | --- |
| `https://example.com/admin` | That exact path |
| `https://example.com/admin/*` | Paths under `/admin/`; not `/admin` without its trailing slash |
| `https://example.com/*` | All paths on that origin |

Patterns distinguish protocol, host, port and path, while ignoring query strings and fragments. Exact enabled rules take precedence over wildcard rules. Disabling an exact rule does not exclude a page from other enabled matching rules. The limit is 50 rules. See the [Chromium integration guide](adapters/chromium/README.md) for matching details.

## Use in Codex Browser

Build the project, then register `dist/codex/` as a local plugin source using the [Codex integration guide](adapters/codex/README.md#安装与使用). After installing and enabling **LayScope** in a supported client, ask, for example:

> Use LayScope to open the inspector on the current Browser page. Keep the layout overlay off.

> Show component boundaries, then inspect the selected element's dimensions and spacing.

> Remove LayScope from this page when finished.

The plugin uses the browser tool's CDP capability to run its bundled core in the top-level page. It does not need a separate MCP server, a debugging-port setting, or an application change. If CDP is unavailable, this integration cannot inject the inspector. Local plugin installation and discovery depend on the host client; a successful direct CDP test does not establish installation success.

## Component recognition

Automatic naming priority is:

1. `data-layout-component` or the compatible `data-kivo-component` marker.
2. Available Vue 3 component-root metadata.
3. `data-slot`.
4. The actual DOM tag and ID.

Explicit names are optional and can be added by Go/templ or any other rendering system:

```html
<section data-layout-component="ProjectList">…</section>
```

Vue 3 recognition has been tested with the 3.5.22 development and production runtimes. When component metadata is unavailable, LayScope explicitly reports that condition and retains DOM and explicit-marker inspection. DOM-only mode ignores component metadata. The hierarchy always represents rendered HTML containment, including the actual mount position of Teleport content; it is not a framework's logical component tree. The inspector does not read props or reactive state, and does not take over Vue DevTools hooks.

The default tree includes visible components, semantic elements and flex/grid containers. Enable **Plain DOM** (`普通 DOM`) to include other visible HTML elements. Business shadow roots, iframe contents, browser-protected pages and SVG internals are outside the current inspection scope.

## Permissions and local data

The extension requests `activeTab`, `scripting` and `storage`. Optional HTTP(S) host access is requested when adding or enabling automatic-loading rules. Browser grants cover all ports of the specified protocol/host, while LayScope's rules still distinguish ports.

Rules stay in the extension's local storage. Site preferences stay in that origin's `localStorage`. Inspection adds no analytics or remote requests; the source-only Vue fixture preparation downloads its test runtime separately.

## Switch to LayScope

LayScope uses its own project directory, plugin/skill IDs, runtime and storage namespace. Install it as a new tool. It does not read or migrate previous-product rules, host grants or site preferences, and does not delete the old data.

Close or disable the previous tool and refresh pages that contain its inspector before switching, so the two inspectors do not run together. Load this project's `dist/chromium/` in Chrome / Edge, or install the new `layscope` plugin/skill in Codex. Set up automatic-loading rules and approve host access again in LayScope.

For subsequent LayScope updates, keep its own source path, reload the extension and reopen its popup. When a page instance is outdated, use **Update instance** (`更新实例`) or refresh the page. Rebuilding files and refreshing a business page alone does not reload a cached extension background worker.

## Development and verification

```sh
npm run dev          # http://127.0.0.1:8094/
npm run fixture:vue  # Prepare the pinned Vue runtime in the system temp directory
```

The local server offers lifecycle, interaction and deep-hierarchy audits at `/`, real Vue audits at `/vue/` and `/vue-production/`, and extension-API substitute previews at `/popup/` and `/rules/`. These previews do not replace acceptance through a real installed extension. Vue fixture preparation verifies the downloaded archive's SHA-512 and does not add a dependency.

Development guides: [conventions](CONVENTIONS.md), [shared core](packages/core/README.md), [Chrome / Edge](adapters/chromium/README.md), [Codex Browser](adapters/codex/README.md).

## License

[MIT](LICENSE) © 2026 LayScope contributors. The license is included in both build outputs. The separately downloaded Vue test runtime retains its own license.
