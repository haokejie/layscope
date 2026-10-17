# LayScope

**简体中文** | [English](README.en.md)

**用于检查页面布局与组件结构的浏览器扩展。**

LayScope 直接运行在浏览器页面上，帮助你查看组件边界、实际 DOM 层级、元素尺寸和间距。提供 **Chrome／Edge 浏览器扩展**和 **Codex 内置 Browser 插件**两种接入方式，共用同一检查核心，无需在业务项目中安装调试 UI。

## 功能

- 显示布局边界，悬停预览元素，选取并固定目标，也可清除选择。
- 查看带分支线和折叠功能的层级树；深层选择可自动收起远处祖先，并保留向上返回的入口。
- 拖拽移动面板、调整宽度，在旁侧查看元素详情。
- 独立控制面板、布局显示和悬浮入口，按站点记住入口显隐、面板宽度、详情显隐和识别模式。
- 自动识别显式组件标记及可用的 Vue 3 元数据，支持仅 DOM 模式。
- 在 Chrome／Edge 为指定页面或路径设置自动加载，通过独立规则页集中管理。
- 完全移除实例，释放节点、样式、监听器、观察器和已调度回调。

## 选择使用方式

| 接入方式 | 运行位置 | 操作入口 | 自动加载 |
| --- | --- | --- | --- |
| Chrome／Edge 浏览器扩展 | 浏览器中的 HTTP(S) 页面 | 浏览器工具栏 → LayScope | 支持页面规则 |
| Codex 插件 | Codex 内置 Browser | 在会话中要求使用 LayScope | 按会话显式加载 |

Codex 插件依赖当前浏览器工具提供 CDP capability，是独立接入方式。检查页面本身不要求业务项目安装 npm 包、注入脚本或注册组件；精确组件名称可通过可选标记提供。

## 从源码构建

需要 Node.js **22 或更高版本**及 npm。开发环境固定版本见 [.nvmrc](.nvmrc) 和 [package.json](package.json)。

克隆源码并进入项目目录：

```sh
git clone https://github.com/haokejie/layscope.git
cd layscope

# 使用 nvm 时可先切换到项目固定版本
nvm use
npm ci
npm run build
npm test
```

项目没有 npm 运行时或开发依赖。构建产物：

| 路径 | 内容 |
| --- | --- |
| `dist/chromium/` | 可加载的 Chrome／Edge 扩展，包含 MIT 协议 |
| `dist/codex/` | Codex 插件、技能与共享核心，包含 MIT 协议 |
| `dist/build.json` | 版本号及共享核心 SHA-256 |

当前通过本地构建安装，仓库尚未提供浏览器商店安装链接或公共插件目录条目。

## 安装 Chrome／Edge 浏览器扩展

1. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
2. 开启「开发者模式」。
3. 点击「加载解压缩的扩展」，选择本仓库中的 `dist/chromium/`。
4. 打开需要检查的 HTTP(S) 页面，点击浏览器工具栏中的 **LayScope**；可按需固定到工具栏。

最低支持 Chrome／Edge 106。当前工具界面使用中文，中英文 README 描述同一套功能。

### 日常使用

| 控件 | 行为 |
| --- | --- |
| 面板 | 展开或收起检查面板，不改变布局显示状态 |
| 显示布局 | 控制边界与元素高亮；展开面板不会自动打开布局 |
| 悬浮入口 | 显示或隐藏页面内入口，按当前站点记忆 |
| 选取 | 在页面上选择目标元素，需要面板与布局同时开启 |
| 清除选择 | 取消固定的元素选择 |
| 详情 | 展开或收起元素尺寸、display、间距、识别来源与祖先路径 |
| 面板设置 → 组件识别 | 在「自动」与「仅 DOM」之间切换 |
| 移除／完全移除 | 清理本页实例，保留规则和已保存的偏好 |

**Alt + Shift + L** 可展开或收起已加载的面板，悬浮入口隐藏时也可使用。拖动面板标题栏可移动位置，拖动左右边缘可调整宽度。快捷键只控制已加载的实例，不负责向尚未加载的页面注入工具。

### 指定页面自动加载

在工具栏弹层开启「此页面自动加载」，并确认浏览器对此主机的访问授权。自动加载时面板保持收起；「默认显示布局」只决定下次创建实例时是否显示边界，不改变当前实例。

点击「管理页面规则」进入完整列表，可搜索、添加、启停、设置默认布局、重新授权和删除规则。

| 规则示例 | 匹配范围 |
| --- | --- |
| `https://example.com/admin` | 精确页面 |
| `https://example.com/admin/*` | `/admin/` 下的路径，不匹配没有末尾斜杠的 `/admin` |
| `https://example.com/*` | 此 origin 下的全部路径 |

规则区分协议、主机、端口和路径，忽略查询参数与 `#` 片段。启用的精确规则优先于通配规则；停用精确规则不会排除此页被其他启用规则匹配。最多保存 50 条规则，详细优先级见 [Chrome／Edge 接入说明](adapters/chromium/README.md)。

## 在 Codex 内置 Browser 使用

构建后，按 [Codex 接入说明](adapters/codex/README.md#安装与使用)把 `dist/codex/` 注册为本地插件来源，在支持的客户端安装并启用 **LayScope**，然后可以在会话中说：

> 用 LayScope 打开当前 Browser 页面的检查面板，先不要显示布局。

> 显示组件边界，查看选中元素的尺寸和间距。

> 检查完成，移除当前页面的 LayScope。

插件通过浏览器工具的 CDP capability 在顶层页面运行自带核心，不需要单独的 MCP 服务、调试端口配置或业务代码修改。当前工具未提供 CDP 时无法使用这一接入方式。本地插件安装和技能发现取决于宿主客户端，直接 CDP 验收成功不等于插件安装完成。

## 组件识别

自动模式按以下顺序命名：

1. `data-layout-component` 或兼容的 `data-kivo-component` 显式标记。
2. Vue 3 组件根节点的可用元数据。
3. `data-slot`。
4. 实际 DOM 标签和 ID。

Go/templ 及其他渲染方案均可按需输出标记，不需要选择后端框架：

```html
<section data-layout-component="ProjectList">…</section>
```

Vue 3 已使用 3.5.22 的开发／生产 runtime 验收。缺少组件元数据时明确提示信息不可用，继续保留 DOM 和显式标记检查；「仅 DOM」模式忽略组件元数据。层级始终代表实际 HTML 包含关系，Teleport 显示在实际挂载位置，不伪造框架逻辑组件树。不读取 props 或响应式状态，也不接管 Vue DevTools hook。

默认树包含可见组件、语义元素和 flex／grid 容器，开启「普通 DOM」可查看其余可见 HTML 元素。当前不展开业务 Shadow Root、iframe 内部或 SVG 内部，也不能注入浏览器保护页面。

## 权限与本地数据

扩展使用 `activeTab`、`scripting` 和 `storage`。添加或启用自动加载规则时按需申请 HTTP(S) 主机权限；浏览器授权覆盖该协议与主机的全部端口，LayScope 规则仍精确区分端口。

规则保存在扩展的本地存储，站点偏好保存在该 origin 的 `localStorage`。检查过程不添加统计或远程请求；仅开发用的 Vue 验收准备命令会单独下载测试 runtime。

## 切换到 LayScope

LayScope 使用独立的目录、插件／技能 ID、运行时与存储命名空间。按全新工具安装，不读取或迁移旧工具的规则、主机授权和站点偏好，也不删除旧数据。

切换前先关闭或停用旧工具，并刷新原来已注入检查器的页面，避免两套检查器同时运行。Chrome／Edge 重新加载本项目的 `dist/chromium/`；Codex 使用新的 `layscope` 插件条目和技能。自动加载规则需要在 LayScope 中重新设置并授权。

后续更新 LayScope 时保持自己的安装来源路径，在扩展管理页重新加载，再重新打开弹层；页面实例提示版本过期时点击「更新实例」，或刷新页面。仅重新构建和刷新业务页不会更新扩展已缓存的后台代码。

## 开发与验证

```sh
npm run dev          # http://127.0.0.1:8094/
npm run fixture:vue  # 将固定版本 Vue runtime 准备到系统临时目录
```

本地服务的 `/` 提供生命周期、功能和深层级验收，`/vue/` 与 `/vue-production/` 使用真实 Vue runtime；`/popup/`、`/rules/` 提供扩展 API 测试替身预览，不替代真实浏览器扩展验收。Vue 准备脚本校验归档 SHA-512，不新增项目依赖。

开发资料：[工程规范](CONVENTIONS.md)、[共享核心](packages/core/README.md)、[Chrome／Edge 接入](adapters/chromium/README.md)、[Codex Browser 接入](adapters/codex/README.md)。

## 开源协议

本项目采用 [MIT License](LICENSE)，版权归 2026 LayScope contributors。两端构建产物均包含协议全文；单独下载的 Vue 测试 runtime 保留其自身协议。
