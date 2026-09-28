#!/usr/bin/env node
/* ZCode 皮肤 换装/还原（必须在 ZCode 完全退出后运行）
   用法：node swap-skin.mjs install | restore */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function findApp() {
  const flag = process.argv.indexOf("--app");
  if (flag >= 0 && process.argv[flag + 1]) return path.resolve(process.argv[flag + 1]);
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
    "未找到 ZCode 安装目录。请用 --app 参数指定，例如：\n  node swap-skin.mjs install --app \"D:\\zcode\""
  );
  process.exit(1);
}

const APP_DIR = findApp();
const RES = path.join(APP_DIR, "resources");
const ASAR = path.join(RES, "app.asar");
const UNPACKED = ASAR + ".unpacked";
const BACKUP = ASAR + ".zcode-skin.bak";
const BACKUP_UNP = BACKUP + ".unpacked";
const STAGED = ASAR + ".zcode-skin.staged";
const STAGED_UNP = STAGED + ".unpacked";
const PREV = ASAR + ".zcode-skin.prev";
const PREV_UNP = PREV + ".unpacked";

function die(msg) {
  console.error(msg);
  process.exit(1);
}

// 确认 ZCode 已退出
try {
  const out = execSync('tasklist /FI "IMAGENAME eq ZCode.exe" /NH', { encoding: "utf8" });
  if (/ZCode\.exe/i.test(out)) die("ZCode 还在运行，请先完全退出（包括托盘图标）再运行本脚本。");
} catch (e) {
  if (e && e.status) die("ZCode 还在运行，请先完全退出（包括托盘图标）再运行本脚本。");
}

const action = process.argv[2];

if (action === "install") {
  if (!fs.existsSync(STAGED)) die("找不到暂存包，请先运行: node apply-skin.mjs");
  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(ASAR, BACKUP);
    if (fs.existsSync(UNPACKED)) fs.cpSync(UNPACKED, BACKUP_UNP, { recursive: true });
    console.log("已备份原始包");
  }
  fs.rmSync(PREV, { force: true });
  fs.rmSync(PREV_UNP, { recursive: true, force: true });
  fs.renameSync(ASAR, PREV);
  fs.renameSync(STAGED, ASAR);
  if (fs.existsSync(UNPACKED)) fs.renameSync(UNPACKED, PREV_UNP);
  if (fs.existsSync(STAGED_UNP)) fs.renameSync(STAGED_UNP, UNPACKED);
  console.log("安装完成！现在可以启动 ZCode 了。Ctrl+Alt+1 切换女仆工坊皮肤。");
} else if (action === "restore") {
  if (!fs.existsSync(BACKUP)) die("找不到备份包，无法还原。");
  if (fs.existsSync(ASAR)) {
    fs.rmSync(ASAR, { force: true });
  }
  fs.copyFileSync(BACKUP, ASAR);
  if (fs.existsSync(BACKUP_UNP)) {
    fs.rmSync(UNPACKED, { recursive: true, force: true });
    fs.cpSync(BACKUP_UNP, UNPACKED, { recursive: true });
  }
  console.log("已还原官方界面。");
} else {
  die("用法: node swap-skin.mjs install | restore");
}
