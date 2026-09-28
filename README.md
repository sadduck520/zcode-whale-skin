# ZCode 鲸鱼娘皮肤 · dsh-deep-whale 移植版

给 ZCode 桌面端换上鲸鱼娘主题皮肤的移植项目，复刻自 [Small-tailqwq/dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale)（DeepSeek Harness 的鲸鱼娘皮肤系列）。

两套皮肤，随时切换：

| 快捷键 | 皮肤 | 效果 |
|---|---|---|
| `Ctrl+Alt+1` | 深海女仆工坊 | 两位鲸鱼娘女仆立绘 + 宫殿昼夜背景 + 深海蓝蕾丝配色 |
| `Ctrl+Alt+2` | 虎鲸链路 | 机能风直角界面 + 虎鲸娘场景立绘，亮色机能 / 暗色治愈 |
| `Ctrl+Alt+0` | 默认 | 恢复官方界面 |

亮暗色模式（跟随系统或应用内设置）自动切换对应素材。皮肤会自动适配对话区宽度：窗口太窄时立绘自动隐藏，避免遮挡内容。

## 环境要求

- Windows
- 已安装 ZCode 桌面端
- [Node.js](https://nodejs.org/) ≥ 18（脚本通过 npx 自动调用 @electron/asar）

## 安装

分两步：**准备**（生成打了补丁的应用包）和**换装**（在 ZCode 关闭状态下替换文件）。

1. 运行准备脚本（ZCode 开着也行，这一步不改任何文件）：

```sh
node apply-skin.mjs
```

如果 ZCode 装在非默认位置：

```sh
node apply-skin.mjs --app "ZCode 安装目录"
```

2. **完全退出 ZCode**（包括托盘图标），双击 `INSTALL-SKIN.cmd`
3. 重新打开 ZCode，按 `Ctrl+Alt+1` 启用皮肤（开关状态会记住）

## 更新与还原

- **ZCode 自动更新后皮肤失效**：重跑 `node apply-skin.mjs`，再运行一次 `INSTALL-SKIN.cmd`
- **还原官方界面**：完全退出 ZCode 后双击 `RESTORE-SKIN.cmd`（原始包备份在 `resources\app.asar.zcode-skin.bak`）
- **排查界面问题**：`DEBUG-LAUNCH.cmd` 会以远程调试模式启动 ZCode，便于用 DevTools 检查

## 原理

ZCode 桌面端是 Electron 应用且未开启 asar 完整性校验，本项目通过修改本地 `resources/app.asar` 实现：解包 → 在渲染进程 `index.html` 注入皮肤 CSS/JS → 重打包。皮肤通过覆盖应用的 Tailwind v4 语义 CSS 变量全局换肤；立绘舞台垫在内容层之下（`pointer-events: none`），并按对话区边界自适应裁剪。不修改任何应用逻辑。

## 故障排除

- **INSTALL 提示 ZCode 还在运行**：检查托盘图标和后台进程
- **切换快捷键没反应**：焦点需在应用窗口内；重启一次应用
- **应用更新后皮肤消失**：正常现象，重跑安装流程

## 许可

- `skin/` 下的代码与本仓库脚本：[MIT](LICENSE)
- `skin/assets/` 下的立绘素材：[CC BY-NC-SA 4.0](ATTRIBUTION.md)，仅供个人非商业使用，**禁止商用**，再分发需保留署名

## 免责声明

本项目为非官方第三方美化，通过修改应用本地资源实现，与 ZCode 官方无关。修改应用文件存在风险，请自行备份、风险自担。
