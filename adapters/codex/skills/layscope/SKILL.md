---
name: layscope
description: 在 Codex 内置 Browser 中用 LayScope 查看页面布局边界、组件名称与可折叠层级，支持悬停预览、选择清除、拖拽和完整移除。用户要求查看页面布局结构或操作此检查器时使用。
---

# LayScope

LayScope 是页面布局与组件结构检查工具；此技能负责 Codex 内置 Browser 接入，Chrome／Edge 浏览器扩展为独立安装入口。插件 ID、技能名和目录均为 `layscope`，只管理自己的运行时和站点偏好，不读取或迁移其他工具配置。

使用此技能自带的 `assets/core-function.js`，它与 Chrome / Edge 扩展使用同一核心。不要在业务页面添加脚本或修改 CSP。

1. 使用当前会话支持的浏览器工具，复用用户指定标签页；默认 Codex 内置 Browser。遵循工具当前初始化说明。新标签页先导航到目标 HTTP(S) 页面。
2. 获取该标签页的 `cdp` capability 并读取其 documentation。使用顶层页面的默认执行上下文，以读取 Vue 3 元数据；不要将新版核心装入隔离世界。此插件不单独建立调试连接，也不猜测端口。若没有 CDP 能力，报告实际限制，不用只读 evaluate 绕过限制。
3. 在工具的 Node 环境读取本技能目录下 `assets/core-function.js`（函数表达式），通过 CDP `Runtime.evaluate` 执行 `${source}(${JSON.stringify(command)}, ${JSON.stringify(options)})`，参数 `returnByValue: true`。命令为 `load`、`open`、`close`、`toggle`、`set-layout`、`set-launcher`、`destroy`、`status`。options 默认 `{}`；load 可传布尔字段 layoutVisible（默认 false）、launcherVisible（默认读取此站点偏好，未设置时 true）；set-layout／set-launcher 必须传对应布尔字段且先加载实例。显式设置 launcherVisible 会保存站点偏好，重复 load 不覆盖。检查 `exceptionDetails` 并报告错误。
4. `open`／`close`／`toggle` 只控制面板，保留布局值；手动首次 open 的布局和选取均关闭。`load` 静默创建收起的实例，只在首次创建应用布局初始值，重复调用保留现场状态。面板内“显示布局”实时控制布局；收起面板或关闭布局均结束选取。仅在明确要求选取时操作对应按钮，不自动拦截业务点击。
5. `status` 返回 `panelOpen`、`layoutVisible`、`launcherVisible`、`picking`；兼容 `state: open/closed` 仅代表面板。隐藏悬浮入口后 Alt+Shift+L、open／toggle 仍可打开面板，入口保持隐藏，用户可在面板重新勾选“显示悬浮入口”。旧实例只能查询／移除后重新加载。`destroy` 完整释放，后续 status 为 absent；页面导航自动清理。
6. 用 DOM / 截图确认实际状态；不将成功发送命令等同于成功加载。临时验收结束使用 `destroy`；用户明确要求保留时说明保留的检查器状态。

核心通过开放 Shadow DOM 隔离 UI，无第三方请求或账号。入口偏好仅保存在当前浏览器该站点的 localStorage，刷新后再次显式加载会沿用；完整移除保留偏好。精确组件名是可选元数据，不要求逐页接入。

自动识别显式组件标记和可用的 Vue 3 元数据，显式标记优先；Vue 内部 DOM 的详情显示所属组件，多根节点与 Teleport 仍按实际 DOM 定位。面板设置提供按站点记忆的自动／仅 DOM 模式。检测到 Vue 3 但组件信息不可用时明确提示；不读取或修改组件状态。status.recognition 返回 mode、sources 与 vue 可用性。

本插件通过当前会话显式加载，不提供内置 Browser 的原生常驻自动加载。规则持久化与主机授权只属于 Chromium 接入端。
