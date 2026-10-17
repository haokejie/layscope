# LayScope · Codex 内置 Browser 插件

[中文使用说明](../../README.md) · [English guide](../../README.en.md) · [MIT](../../LICENSE)

此目录用于维护 Codex 插件入口和共享核心的浏览器接入方式。

运行 `npm run build` 生成 `dist/codex` 插件包。插件使用 [OpenAI 官方插件格式](https://developers.openai.com/plugins/build/plugins) 的根 `plugin.json` 与 `skills/`，不需要本地 MCP 服务或浏览器端口配置。安装由用户管理。

## 安装与使用

本接入运行在 Codex 内置 Browser，与 Chrome／Edge 的浏览器扩展分开安装。需要支持本地插件的客户端和带 CDP capability 的浏览器工具。

1. 从 [GitHub Releases](https://github.com/haokejie/layscope/releases) 下载并解压 `layscope-codex-vX.Y.Z.zip`，得到直接包含 `plugin.json`、`skills/` 和 `LICENSE` 的目录；也可在源码根目录运行 `npm ci`、`npm run build`，使用 `dist/codex/`。
2. 按[官方本地 marketplace 说明](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)，在使用插件的仓库中添加或合并 `.agents/plugins/marketplace.json`。将上一步下载或构建得到的目录内容复制到该仓库的 `plugins/layscope/`，保留其中的 `plugin.json`、`skills/` 和 `LICENSE`。
3. marketplace 中新增以下插件条目；若文件已有其他内容，只合并 `plugins` 条目，不覆盖已有来源和设置：

```json
{
  "name": "local-tools",
  "interface": {"displayName": "Local Tools"},
  "plugins": [
    {
      "name": "layscope",
      "source": {"source": "local", "path": "./plugins/layscope"},
      "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"},
      "category": "Developer Tools"
    }
  ]
}
```

4. 按客户端要求重启或刷新插件来源，在插件目录中安装并启用 **LayScope**，在新会话里要求使用 LayScope 检查当前 Browser 页面。

路径相对于 marketplace 所属仓库根目录，不是 `.agents/plugins/` 目录。插件 ID、技能名和目录均为 `layscope`；展示名通过插件 interface 和技能 `agents/openai.yaml` 设置为 LayScope。按新插件安装，不复用旧工具身份或迁移其配置。构建产物包含 MIT 协议。

可直接说“用 LayScope 展开面板，先不显示布局”，或“检查完成后移除 LayScope”。安装入口与缓存行为依赖宿主版本；这里只提供构建包和接入步骤，不会自动安装或更改用户插件配置。

## 运行机制

技能读取自身附带的 `skills/layscope/assets/core-function.js`，通过当前浏览器工具提供的 CDP capability 在顶层页面的默认执行上下文执行 `Runtime.evaluate`，以便读取 Vue 3 元数据。此核心与 Chromium MAIN 世界产物逐字节一致，不修改业务项目。已在内置 Browser 实测此加载路径、界面关闭与重开、完全移除。

在开发仓库中可直接使用构建产物验收；CDP 加载成功只证明浏览器接入。用户已确认独立版手动验收完成并授权 Kivo 切换；安装后的技能发现与跨会话调用未由工具重新核实。

`load` 支持静默加载与初始布局选项，`open`／`close` 只控制面板，实时布局开关独立。共享核心保存站点入口显隐偏好，刷新后再次加载继续沿用；此插件仍为显式加载，不新增内置 Browser 原生常驻自动加载。

自动识别 Go/templ 组件标记和可用的 Vue 3 开发元数据，显式标记优先；面板设置提供按站点记忆的“仅 DOM”，公开命令保持不变。识别范围、真实 DOM 层级和生产构建提示见[核心说明](../../packages/core/README.md#组件识别)。

具体命令与限制见 [SKILL.md](skills/layscope/SKILL.md)；模块边界见[开发规范](../../CONVENTIONS.md#模块边界)。
