#!/usr/bin/env node
/* ZCode 鲸鱼娘皮肤 · 准备脚本
   流程：备份原 asar → 解包到临时目录 → 注入皮肤 → 打包到「暂存区」
   本脚本不改动正在运行的 ZCode；真正的文件替换由 INSTALL-SKIN.cmd
   （在 ZCode 完全退出后运行）完成。
   ZCode 自动更新后重新运行本脚本 + INSTALL 脚本即可恢复皮肤。
   用法：node apply-skin.mjs [--app "ZCode 安装目录"] */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function findApp() {
  const flag = process.argv.indexOf("--app");
  if (flag >= 0 && process.argv[flag + 1]) {
    const p = path.resolve(process.argv[flag + 1]);
    if (fs.existsSync(path.join(p, "resources", "app.asar"))) return p;
    console.error("--app 指定的目录里没找到 resources\\app.asar：" + p);
    process.exit(1);
  }
  const candidates = [
    "D:/zcode",
    path.join(process.env.PROGRAMFILES || "", "ZCode"),
    path.join(process.env["ProgramFiles(x86)"] || "", "ZCode"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "ZCode"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(path.join(c, "resources", "app.asar"))) return c;
  }
  console.error(
    "未找到 ZCode 安装目录。请用 --app 参数指定，例如：\n" +
      '  node apply-skin.mjs --app "D:\\zcode"'
  );
  process.exit(1);
}

const APP_DIR = findApp();
const RES = path.join(APP_DIR, "resources");
const ASAR = path.join(RES, "app.asar");
const BACKUP = path.join(RES, "app.asar.zcode-skin.bak");
const STAGED = path.join(RES, "app.asar.zcode-skin.staged");
const SKIN_SRC = path.join(import.meta.dirname, "skin");
const BUILD = path.join(import.meta.dirname, ".build");

function asar(args) {
  const r = spawnSync("npx", ["--yes", "@electron/asar", ...args], { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error("asar 命令失败: " + args.join(" "));
    process.exit(1);
  }
}

// 1. 备份原包。区分两种"当前包比备份新"：
//    当前包含 zcode-skin = 是我们装的旧皮肤，备份不动；
//    当前包不含皮肤 = ZCode 自动更新过，刷新备份。
function asarHasSkin(archive) {
  try {
    const buf = fs.readFileSync(archive);
    const hSize = buf.readUInt32LE(4);
    const hBuf = buf.slice(8, 8 + hSize);
    const strLen = hBuf.readUInt32LE(4);
    const header = JSON.parse(hBuf.slice(8, 8 + strLen).toString());
    const rend = ((header.files || {}).out || {}).files;
    return !!(rend && rend.renderer && rend.renderer.files && rend.renderer.files["zcode-skin"]);
  } catch (e) {
    return false;
  }
}
const currentSkinned = asarHasSkin(ASAR);
const needRefresh =
  !fs.existsSync(BACKUP) || (!currentSkinned && fs.statSync(ASAR).mtimeMs > fs.statSync(BACKUP).mtimeMs);
if (needRefresh) {
  fs.copyFileSync(ASAR, BACKUP);
  const unpackedDir = ASAR + ".unpacked";
  if (fs.existsSync(unpackedDir)) {
    fs.rmSync(BACKUP + ".unpacked", { recursive: true, force: true });
    fs.cpSync(unpackedDir, BACKUP + ".unpacked", { recursive: true });
  }
  console.log("已备份/刷新原始 app.asar");
} else {
  console.log("备份已存在且为最新，跳过（当前包" + (currentSkinned ? "已含旧版皮肤" : "无更新") + "）");
}

// 2. 始终从备份解包（备份永远是纯净原包；当前 app.asar 可能已装着旧版皮肤）
fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(BUILD, { recursive: true });
asar(["extract", BACKUP, path.join(BUILD, "app")]);
const appDir = path.join(BUILD, "app");

// 3. 拷入皮肤文件 + 补 index.html 加载点（幂等）
fs.cpSync(SKIN_SRC, path.join(appDir, "out", "renderer", "zcode-skin"), { recursive: true });
const indexPath = path.join(appDir, "out", "renderer", "index.html");
let html = fs.readFileSync(indexPath, "utf8");
const MARK = "<!-- zcode-skin -->";
if (!html.includes(MARK)) {
  const inject =
    '<link rel="stylesheet" href="./zcode-skin/skin.css" /><script src="./zcode-skin/skin.js"></script>' + MARK;
  html = html.replace("</head>", inject + "\n</head>");
  fs.writeFileSync(indexPath, html);
  console.log("index.html 已注入皮肤加载点");
} else {
  console.log("index.html 已包含皮肤加载点，跳过");
}

// 4. 从备份 header 还原 unpacked 规则（native 模块等不能打进 asar）
function collectUnpackPatterns() {
  const buf = fs.readFileSync(BACKUP);
  const hSize = buf.readUInt32LE(4);
  const hBuf = buf.slice(8, 8 + hSize);
  const strLen = hBuf.readUInt32LE(4);
  const header = JSON.parse(hBuf.slice(8, 8 + strLen).toString());
  const dirs = new Set();
  (function walk(node, prefix) {
    for (const [name, child] of Object.entries(node.files || {})) {
      const p = prefix ? prefix + "/" + name : name;
      if (child.files) walk(child, p);
      else if (child.unpacked) {
        const d = path.dirname(p).split(path.sep).join("/");
        dirs.add(d === "." ? p + "" : d + "/**");
      }
    }
  })(header, "");
  const tops = new Set();
  for (const d of dirs) {
    const seg = d.replace("/**", "").split("/");
    tops.add(seg.slice(0, 2).join("/") + "/**");
  }
  return [...tops];
}
const patterns = collectUnpackPatterns();
const unpackGlob = patterns.length > 1 ? "{" + patterns.join(",") + "}" : patterns[0];
console.log("unpacked 规则: " + unpackGlob);

// 5. 重打包到暂存区（不碰正在运行的 app.asar）
fs.rmSync(STAGED, { force: true });
fs.rmSync(STAGED + ".unpacked", { recursive: true, force: true });
asar(["pack", appDir, STAGED, "--unpack", unpackGlob]);
fs.rmSync(BUILD, { recursive: true, force: true });

console.log("暂存包已生成: " + STAGED);
console.log("下一步：完全退出 ZCode（含托盘），然后运行 INSTALL-SKIN.cmd 完成安装。");
